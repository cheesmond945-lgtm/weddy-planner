import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { lateDaysOf, ymd, ymdVN } from '../orders/order-mapping';

/*
 * Hoa hồng NCC trả Forever (docs/api/commissions.md), theo mô hình của CSDL:
 * - Một bảng kê cho mỗi NCC mỗi tháng; đơn vào kỳ của THÁNG HOÀN THÀNH (khi NCC thu đủ phần còn lại).
 * - Đơn bị hủy sau cọc (NCC giữ cọc) vào kỳ của tháng hủy, hoa hồng tính trên TIỀN CỌC: rate × cọc + rate × còn lại = rate × tổng.
 * - Tỷ lệ lấy từ service_categories.commission_rate, lưu cố định vào từng dòng (commissions.rate).
 * - Bảng kê có ba trạng thái Unpaid/Overdue/Paid (Overdue: quá hạn chưa nộp, lưu trong CSDL); Paid do Admin hoặc VietQR ghi nhận (mã giao dịch, ngày trả); không có minh chứng NCC tự gửi.
 */
const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const codeOf = (period: string) => `DS${period.slice(5, 7)}${period.slice(0, 4)}`;
const monthVN = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);
const lastDay = (period: string) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, include: { service_categories: true } });
    return v ?? fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
  }

  private summaryOf(s: { period: string; total_orders: number | null; due_date: Date | null; status: string | null; paid_date: Date | null }, base: number, commission: number) {
    const current = s.period === monthVN();
    const paid = s.status === 'Paid';
    const today = ymdVN(new Date());
    return {
      id: codeOf(s.period),
      code: codeOf(s.period),
      period: s.period,
      status: current && !paid ? 'OPEN' : paid ? 'PAID' : 'UNPAID',
      orderCount: s.total_orders ?? 0,
      supplementCount: 0,
      baseAmount: base,
      commissionAmount: commission,
      paidAmount: paid ? commission : 0,
      pendingAmount: 0,
      closingDate: lastDay(s.period),
      dueDate: ymd(s.due_date),
      // Overdue là trạng thái lưu trong CSDL (job chuyển mỗi giờ); so ngày để đúng ngay cả khi job chưa chạy
      isOverdue: !current && !paid && (s.status === 'Overdue' || ymd(s.due_date) < today),
      /** Đã thanh toán sau hạn bao nhiêu ngày (null: chưa trả hoặc trả đúng hạn) */
      lateDays: paid ? lateDaysOf(s.due_date, s.paid_date) : null,
    };
  }

  async list(userId: string) {
    const v = await this.vendorOf(userId);
    const rows = await this.prisma.commission_statements.findMany({ where: { vendor_id: v.id }, include: { commissions: true }, orderBy: { period_month: 'desc' } });
    const out = rows.map((r) =>
      this.summaryOf({ period: ymd(r.period_month).slice(0, 7), total_orders: r.total_orders, due_date: r.due_date, status: r.status, paid_date: r.paid_date }, r.commissions.reduce((s, c) => s + Number(c.order_amount), 0), Number(r.total_amount)),
    );
    const now = monthVN();
    if (!out.some((s) => s.period === now)) {
      const [y, m] = now.split('-').map(Number);
      out.unshift(this.summaryOf({ period: now, total_orders: 0, due_date: new Date(Date.UTC(y, m, 25)), status: 'Unpaid', paid_date: null }, 0, 0));
    }
    return out;
  }

  async get(userId: string, id: string) {
    const v = await this.vendorOf(userId);
    const m = /^DS(\d{2})(\d{4})$/.exec(id);
    if (!m) return fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
    const period = `${m[2]}-${m[1]}`;
    const row = await this.prisma.commission_statements.findUnique({
      where: { vendor_id_period_month: { vendor_id: v.id, period_month: new Date(`${period}-01`) } },
      relationLoadStrategy: 'join',
      include: { commissions: { include: { orders: { include: { payments: true } } }, orderBy: { created_date: 'asc' } } },
    });
    const summary = row
      ? this.summaryOf({ period, total_orders: row.total_orders, due_date: row.due_date, status: row.status, paid_date: row.paid_date }, row.commissions.reduce((s, c) => s + Number(c.order_amount), 0), Number(row.total_amount))
      : period === monthVN()
        ? (await this.list(userId)).find((s) => s.period === period)!
        : fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);

    const cat = { id: v.service_categories?.id ?? '', slug: categorySlug(v.service_categories?.name ?? null), name: v.service_categories?.name ?? '' };
    // Dòng hoa hồng thiếu đơn (dữ liệu hỏng) thì bỏ qua
    const lines = (row?.commissions ?? []).flatMap((c) => (c.orders ? [{ ...c, orders: c.orders }] : [])).map((c) => {
      const o = c.orders;
      const total = Number(o.total_amount);
      const deposit = Number(o.deposit_amount);
      const payments: { paymentId: string; installmentName: string; paidAt: string; method: 'VIETQR' | 'BANK_TRANSFER' | 'CASH'; amount: number }[] = [];
      // Dòng Deposit: chỉ khoản cọc. Dòng Final: phần còn lại (dòng Final cũ tính trên cả tổng đơn thì hiện cả hai khoản)
      const depositIn = c.kind === 'Deposit' || Number(c.order_amount) >= total;
      const finalIn = c.kind === 'Final';
      if (depositIn && o.payments?.status === 'Paid' && o.payments.paid_date) {
        payments.push({ paymentId: o.payments.id, installmentName: 'Đợt 1 – Đặt cọc', paidAt: o.payments.paid_date.toISOString(), method: 'VIETQR', amount: deposit });
      }
      if (finalIn && o.completed_date) {
        payments.push({ paymentId: `final-${o.id}`, installmentName: 'Đợt 2 – Thanh toán còn lại', paidAt: o.completed_date.toISOString(), method: 'CASH', amount: total - deposit });
      }
      return {
        id: c.id,
        kind: 'ORDER',
        /** Deposit: hoa hồng trên tiền cọc (ghi lúc khách cọc). Final: trên phần còn lại (ghi lúc hoàn thành) */
        commissionKind: c.kind,
        /** Ngày ghi nhận dòng hoa hồng (giờ VN): ngày khách cọc hoặc ngày hoàn thành */
        recordedDate: c.created_date ? ymdVN(c.created_date) : null,
        orderId: o.id,
        orderCode: o.order_code,
        customerName: o.customer_name,
        eventDate: ymd(o.event_date),
        /** Ngày đơn hoàn thành (NCC xác nhận thu đủ hoặc hệ thống tự hoàn thành), giờ VN */
        completedDate: o.completed_date ? ymdVN(o.completed_date) : null,
        /** Trạng thái hiện tại của đơn: Deposited (đã cọc, chưa xong), Completed, Cancelled (đã hủy sau cọc, hoa hồng cọc vẫn giữ) */
        orderStatus: o.status === 'Cancelled' ? 'Cancelled' : o.status === 'Completed' ? 'Completed' : 'Deposited',
        cancelledDate: o.cancelled_date ? ymdVN(o.cancelled_date) : null,
        category: cat,
        rate: Number(c.rate),
        baseAmount: Number(c.order_amount),
        commissionAmount: Number(c.amount),
        payments,
        // Dòng được ghi nhận ở tháng khác kỳ này là dòng được tính dồn (bảng kê tháng đó đã thanh toán)
        originPeriod: (() => {
          const at = c.created_date;
          return at && ymdVN(at).slice(0, 7) !== period ? ymdVN(at).slice(0, 7) : null;
        })(),
      };
    });

    const paid = row?.status === 'Paid';
    return {
      ...summary,
      lines,
      payments: paid
        ? [{ id: row!.id, amount: Number(row!.total_amount), proofFile: null, note: row!.transaction_code ? `Mã giao dịch ${row!.transaction_code}` : null, submittedAt: (row!.paid_date ?? row!.created_date)?.toISOString() ?? '', status: 'CONFIRMED', reviewedAt: (row!.paid_date ?? row!.created_date)?.toISOString() ?? '', reviewNote: null }]
        : [],
      transfer: {
        accountName: process.env.WEBPLAN_ACCOUNT_NAME ?? 'FOREVER DEMO',
        bankName: process.env.WEBPLAN_BANK_NAME ?? 'Ngân hàng mẫu',
        accountNumber: process.env.WEBPLAN_ACCOUNT_NUMBER ?? 'DEMO-000000 · Không dùng chuyển tiền',
        content: `${summary.code} — ${v.business_name}`,
      },
    };
  }

  /** CSDL không lưu minh chứng NCC gửi; Admin là người ghi nhận khoản đã trả (mã giao dịch, ngày trả). */
  submitPayment() {
    throw new HttpException({ code: 'COMMISSION_NOT_PAYABLE', message: 'Thanh toán hoa hồng do quản trị viên Forever ghi nhận sau khi nhận chuyển khoản.' }, 409);
  }
}
