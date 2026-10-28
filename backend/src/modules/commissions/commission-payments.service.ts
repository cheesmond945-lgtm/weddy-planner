import { HttpException, Injectable } from '@nestjs/common';
import { buildPayInfo, commissionContent, vietqrConfig } from '../../integrations/vietqr/vietqr';
import { SepayService } from '../../integrations/vietqr/sepay.service';
import { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { ymd } from '../orders/order-mapping';

/*
 * NCC thanh toán hoa hồng qua VietQR + SePay (integrations/vietqr), cùng tài khoản nhận với tiền cọc.
 * - pay: trả mã QR, số tiền lấy từ commission_statements.total_amount, nội dung "EVHH" + 8 ký tự đầu của id bảng kê.
 * - check: hỏi SePay đã nhận đúng nội dung và số tiền chưa (mỗi giao dịch chỉ dùng một lần), có thì ghi nhận Paid.
 */
const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const monthVN = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);

type Outcome = { status: 'PAID'; statementId: string; transactionCode: string | null; message: string };

@Injectable()
export class CommissionPaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly sepay: SepayService) {}

  private async vendorOf(userId: string) {
    return (await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true, business_name: true } })) ?? fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
  }

  /** Mã bảng kê của FE (DS<MM><YYYY>) -> bảng kê của NCC. */
  private async statementOf(userId: string, id: string) {
    const v = await this.vendorOf(userId);
    const m = /^DS(\d{2})(\d{4})$/.exec(id);
    const row = m ? await this.prisma.commission_statements.findUnique({ where: { vendor_id_period_month: { vendor_id: v.id, period_month: new Date(`${m[2]}-${m[1]}-01`) } } }) : null;
    if (!row) return fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
    return { vendor: v, row, period: `${m![2]}-${m![1]}` };
  }

  private assertPayable(row: { status: string | null; total_amount: unknown }, period: string) {
    if (row.status === 'Paid') return fail('COMMISSION_ALREADY_PAID', 'Bảng kê đã được thanh toán.', 409);
    if (period >= monthVN() || Number(row.total_amount) <= 0) return fail('COMMISSION_NOT_PAYABLE', 'Bảng kê chưa chốt hoặc chưa có hoa hồng nên chưa thanh toán được.', 409);
  }

  /** Mã QR để NCC chuyển khoản hoa hồng. */
  async pay(userId: string, id: string) {
    const cfg = vietqrConfig() ?? fail('PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình cổng thanh toán VietQR.', 501);
    const { row, period } = await this.statementOf(userId, id);
    this.assertPayable(row, period);
    return buildPayInfo(cfg, { amount: Number(row.total_amount), content: commissionContent(row.id) });
  }

  /** Hỏi SePay xem đã nhận đủ hoa hồng chưa; có thì ghi nhận Đã thanh toán (chỉ một lần). */
  async check(userId: string, id: string): Promise<Outcome | { status: 'PENDING'; message: string }> {
    if (!vietqrConfig()) return fail('PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình cổng thanh toán VietQR.', 501);
    const { row, period } = await this.statementOf(userId, id);
    if (row.status === 'Paid') return this.paidOutcome(row.id, 'Bảng kê đã được ghi nhận thanh toán.');
    this.assertPayable(row, period);
    const txn = await this.sepay.findPayment(commissionContent(row.id), Number(row.total_amount));
    if (!txn) return { status: 'PENDING', message: 'Chưa nhận được tiền. Nếu bạn vừa chuyển khoản, vui lòng đợi ít giây.' };
    const full = (await this.load(row.id))!;
    await this.markPaid(full, txn.id, txn.paidAt);
    return this.paidOutcome(row.id, 'Thanh toán thành công.');
  }

  private load(id: string) {
    return this.prisma.commission_statements.findUnique({ where: { id }, include: { vendor_profiles: { select: { user_id: true, business_name: true } } } });
  }

  private async paidOutcome(id: string, message: string): Promise<Outcome> {
    const row = (await this.load(id))!;
    return { status: 'PAID', statementId: `DS${ymd(row.period_month).slice(5, 7)}${ymd(row.period_month).slice(0, 4)}`, transactionCode: row.transaction_code, message };
  }

  /**
   * Ghi nhận bảng kê Đã thanh toán và báo NCC, Admin. Nhiều lần kiểm tra có thể đến cùng lúc:
   * chỉ cập nhật khi bảng kê còn Unpaid, bên đến sau nhận ALREADY và không gửi thông báo lần hai.
   */
  private async markPaid(row: NonNullable<Awaited<ReturnType<CommissionPaymentsService['load']>>>, transactionNo: string, paidAt: Date): Promise<'PAID' | 'ALREADY'> {
    if (row.status === 'Paid') return 'ALREADY';
    // Mã giao dịch phải duy nhất: nếu trùng thì thêm hậu tố
    const taken = await this.prisma.commission_statements.findUnique({ where: { transaction_code: transactionNo }, select: { id: true } });
    const txCode = taken && taken.id !== row.id ? `${transactionNo}-${row.id.slice(0, 4)}` : transactionNo;
    const { count } = await this.prisma.commission_statements.updateMany({ where: { id: row.id, status: 'Unpaid' }, data: { status: 'Paid', transaction_code: txCode, paid_date: paidAt } });
    if (!count) return 'ALREADY';

    const money = `${Number(row.total_amount).toLocaleString('vi-VN')}đ`;
    const period = ymd(row.period_month);
    if (row.vendor_profiles?.user_id) {
      await notify(this.prisma, {
        userId: row.vendor_profiles.user_id,
        type: 'CommissionPaid',
        title: 'Đã ghi nhận thanh toán hoa hồng',
        content: `WebPlan đã nhận hoa hồng ${money} của kỳ ${period.slice(5, 7)}/${period.slice(0, 4)} (mã giao dịch ${txCode}).`,
        referenceType: 'CommissionStatement',
        referenceId: row.id,
      });
    }
    // Báo mọi Admin: NCC đã thanh toán hoa hồng (đối soát ở trang Thanh toán hoa hồng)
    const admins = await this.prisma.users.findMany({ where: { role: 'Admin', status: 'Active' }, select: { id: true } });
    const who = row.vendor_profiles?.business_name || 'Một nhà cung cấp';
    await Promise.all(
      admins.map((a) =>
        notify(this.prisma, {
          userId: a.id,
          type: 'CommissionReceived',
          title: `Đã nhận hoa hồng: ${row.vendor_profiles?.business_name || 'Nhà cung cấp'}`,
          content: `${who} đã thanh toán hoa hồng kỳ ${period.slice(5, 7)}/${period.slice(0, 4)}: ${money} (mã giao dịch ${txCode}).`,
          referenceType: 'CommissionStatement',
          referenceId: row.id,
        }),
      ),
    );
    return 'PAID';
  }
}
