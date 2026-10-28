import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ymd } from '../orders/order-mapping';
import { UUID, fail, paymentMode, ymdVn } from '../orders/order-rules';

/*
 * Hoa hồng NCC trả WebPlan (docs/api/commissions.md, docs/database.md mục 9.8):
 * - Một bảng kê cho mỗi NCC mỗi tháng; đơn vào kỳ của THÁNG HOÀN THÀNH (tạo khi đơn Completed, xem orders/order-lifecycle.ts).
 * - Tỷ lệ lấy từ service_categories.commission_rate, chụp vào từng dòng (commissions.rate).
 * - Chỉ hai trạng thái lưu Unpaid/Paid. "Đang tạm tính" và "Quá hạn" không lưu, giao diện tính từ ngày hiện tại.
 * - NCC nộp MỘT lần cho cả bảng kê (VNPay). Chưa tích hợp VNPay: chế độ thử (PAYMENT_MODE=simulate) ghi nhận nộp thành công ngay.
 */

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, include: { service_categories: true } });
    return v ?? fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
  }

  private statementDto(s: { id: string; period_month: Date; total_orders: number; total_amount: unknown; due_date: Date; status: string; paid_date: Date | null; transaction_code: string | null; created_date: Date }) {
    return {
      id: s.id,
      periodMonth: ymd(s.period_month).slice(0, 7),
      totalOrders: s.total_orders,
      totalAmount: Number(s.total_amount),
      dueDate: ymd(s.due_date),
      status: s.status,
      paidDate: s.paid_date ? s.paid_date.toISOString() : null,
      transactionCode: s.transaction_code,
      createdDate: s.created_date.toISOString(),
    };
  }

  /** Tỷ lệ hiện hành của NCC và mọi bảng kê, mới nhất trước. Tháng hiện tại chưa có bảng kê thì giao diện tự dựng dòng 0 đồng. */
  async list(userId: string) {
    const v = await this.vendorOf(userId);
    const rows = await this.prisma.commission_statements.findMany({ where: { vendor_id: v.id }, orderBy: { period_month: 'desc' } });
    return {
      rate: v.service_categories ? { percent: Number(v.service_categories.commission_rate), categoryName: v.service_categories.name } : null,
      statements: rows.map((r) => this.statementDto(r)),
    };
  }

  private async ownedStatement(userId: string, id: string) {
    const v = await this.vendorOf(userId);
    const st = UUID.test(id) ? await this.prisma.commission_statements.findFirst({ where: { id, vendor_id: v.id } }) : null;
    return st ?? fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
  }

  /** Hoa hồng từng đơn của một bảng kê, mới hoàn tất trước. */
  async lines(userId: string, id: string) {
    const st = await this.ownedStatement(userId, id);
    const rows = await this.prisma.commissions.findMany({
      where: { statement_id: st.id },
      include: { orders: { select: { id: true, order_code: true, customer_name: true, completed_date: true } } },
    });
    return rows
      .map((c) => ({
        id: c.id,
        orderId: c.orders.id,
        orderCode: c.orders.order_code,
        customerName: c.orders.customer_name,
        completedDate: (c.orders.completed_date ?? c.created_date).toISOString(),
        orderAmount: Number(c.order_amount),
        rate: Number(c.rate),
        amount: Number(c.amount),
      }))
      .sort((a, b) => b.completedDate.localeCompare(a.completedDate));
  }

  /**
   * Nộp một lần cho cả bảng kê: Unpaid, kỳ đã kết thúc (tháng hiện tại giờ VN lớn hơn tháng của bảng kê), tổng > 0.
   * Chế độ thử (PAYMENT_MODE=simulate): ghi nhận thành công ngay, trả { paymentUrl: null, statement }. VNPay thật chưa có: 501.
   */
  async pay(userId: string, id: string) {
    if (paymentMode() !== 'simulate') {
      return fail('PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình cổng thanh toán VNPay. Đặt PAYMENT_MODE=simulate để dùng thanh toán thử.', 501);
    }
    const st = await this.ownedStatement(userId, id);
    if (st.status === 'Paid') return fail('COMMISSION_ALREADY_PAID', 'Bảng kê đã nộp.', 409);
    const period = ymd(st.period_month).slice(0, 7);
    if (period >= ymdVn(new Date()).slice(0, 7) || !(Number(st.total_amount) > 0)) {
      return fail('COMMISSION_NOT_PAYABLE', 'Chỉ nộp được bảng kê của kỳ đã kết thúc và có hoa hồng.', 409);
    }
    const r = await this.prisma.commission_statements.updateMany({
      where: { id: st.id, status: 'Unpaid' },
      data: { status: 'Paid', paid_date: new Date(), transaction_code: `HH${randomInt(10_000_000, 99_999_999)}` },
    });
    if (!r.count) return fail('COMMISSION_ALREADY_PAID', 'Bảng kê đã nộp.', 409);
    const done = await this.prisma.commission_statements.findUniqueOrThrow({ where: { id: st.id } });
    return { paymentUrl: null, statement: this.statementDto(done) };
  }
}
