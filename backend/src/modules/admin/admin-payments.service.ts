import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { notify } from '../chat/chat-messages';
import { lateDaysOf, ymd, ymdVN } from '../orders/order-mapping';
import { fail, matches, monthVN, UUID } from './admin-common';

export interface RecordPaymentDto {
  transactionCode?: string;
  /** Ngày giao dịch chuyển khoản "YYYY-MM-DD" (giờ Việt Nam) */
  paidAt?: string;
  /** Mở khóa tài khoản NCC (nếu đang bị khóa) sau khi ghi nhận */
  unlock?: boolean;
}

export interface StatementQueryDto {
  q?: string;
  status?: string;
  /** Năm (YYYY) và tháng (1-12) của kỳ; dùng riêng từng cái hoặc cùng nhau */
  year?: string | number;
  month?: string | number;
  period?: string;
  page?: string | number;
  pageSize?: string | number;
}

/** Bảng kê hoa hồng của mọi nhà cung cấp (commission_statements + commissions), Admin ghi nhận đã thanh toán. */
@Injectable()
export class AdminPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private load(where: object = {}) {
    return this.prisma.commission_statements.findMany({
      where,
      include: { commissions: { select: { order_amount: true } }, vendor_profiles: { select: { id: true, user_id: true, business_name: true, service_categories: true } } },
    });
  }

  /** Mã bảng kê DS<MM><YYYY>-<số thứ tự trong kỳ>, số thứ tự theo ngày tạo (ổn định). */
  private dtos(rows: Awaited<ReturnType<AdminPaymentsService['load']>>) {
    const today = ymdVN(new Date());
    const seq = new Map<string, number>();
    const byPeriod = new Map<string, typeof rows>();
    for (const r of rows) {
      const p = ymd(r.period_month).slice(0, 7);
      byPeriod.set(p, [...(byPeriod.get(p) ?? []), r]);
    }
    for (const list of byPeriod.values()) {
      [...list].sort((a, b) => (a.created_date?.getTime() ?? 0) - (b.created_date?.getTime() ?? 0) || a.id.localeCompare(b.id)).forEach((r, i) => seq.set(r.id, i + 1));
    }
    return rows.map((r) => {
      const period = ymd(r.period_month).slice(0, 7);
      const due = ymd(r.due_date);
      const paid = r.status === 'Paid';
      const cat = r.vendor_profiles?.service_categories ?? null;
      return {
        id: r.id,
        code: `DS${period.slice(5)}${period.slice(0, 4)}-${String(seq.get(r.id)).padStart(3, '0')}`,
        vendor: { id: r.vendor_profiles?.id ?? '', name: r.vendor_profiles?.business_name ?? '' },
        category: { id: cat?.id ?? '', slug: categorySlug(cat?.name ?? null), name: cat?.name ?? '' },
        period,
        orderCount: r.total_orders,
        revenue: r.commissions.reduce((s, c) => s + Number(c.order_amount), 0),
        commissionAmount: Number(r.total_amount),
        dueDate: due,
        status: paid ? 'PAID' : 'UNPAID',
        isOverdue: !paid && due < today,
        /** Đã thanh toán sau hạn bao nhiêu ngày (null: chưa trả hoặc trả đúng hạn) */
        lateDays: paid ? lateDaysOf(r.due_date, r.paid_date) : null,
        paidAt: r.paid_date?.toISOString() ?? null,
        transactionCode: r.transaction_code,
      };
    });
  }

  async list(q: StatementQueryDto) {
    const all = this.dtos(await this.load());
    const year = Math.trunc(Number(q.year)) || 0;
    const month = Math.trunc(Number(q.month)) || 0;
    const filtered = all
      .filter(
        (s) =>
          matches(q.q, s.code, s.vendor.name) &&
          (!q.status || s.status === q.status) &&
          (!q.period || s.period === q.period) &&
          (!year || s.period.startsWith(`${year}-`)) &&
          (!month || s.period.slice(5) === String(month).padStart(2, '0')),
      )
      .sort((a, b) => b.period.localeCompare(a.period) || a.vendor.name.localeCompare(b.vendor.name, 'vi'));
    const page = Math.max(1, Math.trunc(Number(q.page)) || 1);
    const size = Math.min(5000, Math.max(1, Math.trunc(Number(q.pageSize)) || 10));
    const sum = (f: (s: (typeof all)[number]) => boolean) => filtered.filter(f).reduce((a, s) => a + s.commissionAmount, 0);
    return {
      stats: { total: sum(() => true), paid: sum((s) => s.status === 'PAID'), unpaid: sum((s) => s.status === 'UNPAID') },
      items: filtered.slice((page - 1) * size, page * size),
      total: filtered.length,
      periods: [...new Set(all.map((s) => s.period))].sort().reverse(),
      /** Các năm có bảng kê (cho ô chọn năm), mới nhất trước */
      years: [...new Set(all.map((s) => Number(s.period.slice(0, 4))))].sort((a, b) => b - a),
    };
  }

  /**
   * Chi tiết một bảng kê: nhà cung cấp, thông tin kỳ, thanh toán và từng đơn được tính hoa hồng.
   * Đơn hoàn thành ở tháng khác với kỳ của bảng kê là đơn được tính dồn (originPeriod = tháng hoàn thành thực tế).
   */
  async detail(id: string) {
    const row = UUID.test(id)
      ? await this.prisma.commission_statements.findUnique({
          where: { id },
          include: {
            commissions: { include: { orders: { select: { id: true, order_code: true, customer_name: true, event_date: true, completed_date: true, total_amount: true } } }, orderBy: { created_date: 'asc' } },
            vendor_profiles: { include: { service_categories: true, users: { select: { full_name: true, email: true, phone_number: true, status: true } } } },
          },
        })
      : null;
    if (!row) return fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
    const base = (await this.dtos(await this.load())).find((s) => s.id === id)!;
    const v = row.vendor_profiles;
    if (!v) return fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
    const period = base.period;
    const [y, m] = period.split('-').map(Number);
    // Dòng hoa hồng thiếu đơn (dữ liệu hỏng) thì bỏ qua
    const lines = row.commissions.flatMap((c) => (c.orders ? [{ ...c, orders: c.orders }] : [])).map((c) => {
      const done = c.orders.completed_date;
      const completedMonth = done ? ymdVN(done).slice(0, 7) : null;
      return {
        id: c.id,
        orderId: c.orders.id,
        orderCode: c.orders.order_code,
        customerName: c.orders.customer_name,
        eventDate: ymd(c.orders.event_date),
        completedAt: done?.toISOString() ?? null,
        orderAmount: Number(c.order_amount),
        rate: Number(c.rate),
        commissionAmount: Number(c.amount),
        originPeriod: completedMonth && completedMonth !== period ? completedMonth : null,
      };
    });
    const revenue = lines.reduce((s, l) => s + l.orderAmount, 0);
    return {
      ...base,
      closingDate: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
      createdAt: row.created_date?.toISOString() ?? '',
      /** Tỷ lệ hoa hồng bình quân theo doanh thu (các dòng có thể khác tỷ lệ nếu lĩnh vực đổi tỷ lệ giữa chừng) */
      averageRate: revenue ? Math.round((base.commissionAmount / revenue) * 10000) / 100 : 0,
      vendorInfo: {
        id: v.id,
        businessName: v.business_name,
        representativeName: v.representative_name || null,
        taxCode: v.tax_code,
        address: [v.address, v.ward, v.city].filter(Boolean).join(', ') || null,
        ownerName: v.users?.full_name ?? null,
        email: v.users?.email ?? null,
        phone: v.users?.phone_number ?? null,
        /** Tài khoản NCC đang bị khóa (vd quá hạn hoa hồng): ghi nhận thanh toán có thể mở khóa luôn */
        accountLocked: v.users?.status === 'Locked',
      },
      lines,
    };
  }

  /**
   * Admin ghi nhận đã thanh toán khi NCC chuyển khoản ngoài hệ thống (vd tài khoản bị khóa nên không thanh toán qua VNPay được):
   * nhập mã và ngày giao dịch; `unlock` thì mở khóa tài khoản NCC. Báo NCC kết quả.
   */
  async recordPayment(id: string, body: RecordPaymentDto) {
    const row = UUID.test(id)
      ? await this.prisma.commission_statements.findUnique({ where: { id }, include: { vendor_profiles: { select: { user_id: true, users: { select: { status: true } } } } } })
      : null;
    if (!row) return fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
    if (row.status === 'Paid') return fail('COMMISSION_ALREADY_PAID', 'Bảng kê đã được thanh toán.', 409);
    const period = ymd(row.period_month).slice(0, 7);
    if (period >= monthVN(new Date()) || Number(row.total_amount) <= 0) {
      return fail('COMMISSION_NOT_PAYABLE', 'Bảng kê chưa chốt hoặc chưa có hoa hồng nên chưa ghi nhận thanh toán được.', 409);
    }

    const errors: Record<string, string> = {};
    const code = body.transactionCode?.trim() ?? '';
    if (!code) errors.transactionCode = 'Nhập mã giao dịch.';
    else if (code.length > 100) errors.transactionCode = 'Tối đa 100 ký tự.';
    // Chỉ có ngày: lưu 12:00 giờ Việt Nam để ngày hiển thị không lệch theo múi giờ
    const day = /^\d{4}-\d{2}-\d{2}$/.test(body.paidAt ?? '') ? body.paidAt! : '';
    const paidAt = day ? new Date(`${day}T12:00:00+07:00`) : null;
    if (!paidAt || Number.isNaN(paidAt.getTime())) errors.paidAt = 'Chọn ngày giao dịch.';
    else if (day > ymdVN(new Date())) errors.paidAt = 'Ngày giao dịch không được ở tương lai.';
    else if (day.slice(0, 7) < period) errors.paidAt = 'Ngày giao dịch không được trước kỳ hoa hồng.';
    if (!errors.transactionCode && (await this.prisma.commission_statements.findUnique({ where: { transaction_code: code }, select: { id: true } }))) {
      errors.transactionCode = 'Mã giao dịch đã được dùng cho bảng kê khác.';
    }
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin thanh toán chưa hợp lệ.', 400, errors);

    const userId = row.vendor_profiles?.user_id ?? null;
    const unlock = !!body.unlock && !!userId && row.vendor_profiles?.users?.status === 'Locked';
    await this.prisma.$transaction([
      this.prisma.commission_statements.update({ where: { id }, data: { status: 'Paid', transaction_code: code, paid_date: paidAt! } }),
      ...(unlock ? [this.prisma.users.update({ where: { id: userId! }, data: { status: 'Active' } })] : []),
    ]);
    if (userId) {
      await notify(this.prisma, {
        userId,
        type: 'CommissionPaid',
        title: 'Đã ghi nhận thanh toán hoa hồng',
        content: `WebPlan đã ghi nhận hoa hồng ${Number(row.total_amount).toLocaleString('vi-VN')}đ của kỳ ${period.slice(5)}/${period.slice(0, 4)} (mã giao dịch ${code}).${unlock ? ' Tài khoản của bạn đã được mở khóa.' : ''}`,
        referenceType: 'CommissionStatement',
        referenceId: id,
      });
    }
    return this.detail(id);
  }
}
