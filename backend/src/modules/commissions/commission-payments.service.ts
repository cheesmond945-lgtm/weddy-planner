import { HttpException, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PAYMENT_TTL_MS, buildPaymentUrl, frontendUrl, parseTxnRef, txnRefOf, verifyResult, vnpayLive, type IpnCode, type VnpayResult } from '../../integrations/vnpay/vnpay';
import { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { ymd, ymdVN } from '../orders/order-mapping';

/*
 * NCC thanh toán hoa hồng qua VNPay (integrations/vnpay).
 * - Chế độ thật: tạo URL VNPay đã ký; VNPay chuyển NCC về VNPAY_RETURN_URL, FE gửi kết quả cho confirm; VNPay còn gọi IPN
 *   (PaymentsGatewayController). Hai đường cùng ghi nhận qua markPaid, chỉ ghi một lần.
 * - Chế độ giả lập (mặc định, như đặt cọc): trang "VNPay sandbox" giả trong FE; mã giao dịch do hệ thống sinh.
 */
const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const monthVN = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);

interface Intent {
  statementId: string;
  userId: string;
  amount: number;
  code: string;
  vendorName: string;
  expires: number;
}

type Outcome = { status: 'PAID'; statementId: string; transactionCode: string | null; message: string } | { status: 'FAILED'; message: string };

@Injectable()
export class CommissionPaymentsService {
  /** Lượt thanh toán giả lập đang chờ (mất khi khởi động lại; chỉ dùng cho chế độ giả lập). */
  private readonly intents = new Map<string, Intent>();

  constructor(private readonly prisma: PrismaService) {}

  private get returnUrl() {
    return process.env.VNPAY_RETURN_URL || `${frontendUrl()}/vendor/commissions/vnpay-return`;
  }

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

  /** Tạo lượt thanh toán: trả URL để chuyển trình duyệt NCC tới (VNPay thật hoặc trang giả lập). */
  async pay(userId: string, id: string, ip: string) {
    const { vendor, row, period } = await this.statementOf(userId, id);
    if (row.status === 'Paid') return fail('COMMISSION_ALREADY_PAID', 'Bảng kê đã được thanh toán.', 409);
    const amount = Number(row.total_amount);
    if (period >= monthVN() || amount <= 0) return fail('COMMISSION_NOT_PAYABLE', 'Bảng kê chưa chốt hoặc chưa có hoa hồng nên chưa thanh toán được.', 409);

    const txnRef = txnRefOf('COMMISSION', row.id);
    const code = `DS${period.slice(5)}${period.slice(0, 4)}`;
    if (!vnpayLive()) {
      this.intents.set(txnRef, { statementId: row.id, userId, amount, code, vendorName: vendor.business_name ?? '', expires: Date.now() + PAYMENT_TTL_MS });
      return { mode: 'SIMULATE' as const, paymentUrl: `${frontendUrl()}/vendor/commissions/vnpay-sandbox?ref=${txnRef}` };
    }
    return { mode: 'LIVE' as const, paymentUrl: buildPaymentUrl({ txnRef, amount, orderInfo: `Thanh toan hoa hong ${code}`, ip, returnUrl: this.returnUrl }) };
  }

  /** Thông tin lượt giả lập cho trang "VNPay sandbox" (chỉ chế độ giả lập, chỉ của chính NCC đó). */
  intent(userId: string, ref: string) {
    const it = this.intents.get(ref);
    if (vnpayLive() || !it || it.userId !== userId || it.expires < Date.now()) return fail('PAYMENT_INTENT_NOT_FOUND', 'Phiên thanh toán không tồn tại hoặc đã hết hạn.', 404);
    return { code: it.code, amount: it.amount, vendorName: it.vendorName, expiresAt: new Date(it.expires).toISOString() };
  }

  /** Kết quả quay về từ VNPay (hoặc trang giả lập) trên trình duyệt NCC: kiểm tra rồi ghi nhận Đã thanh toán. */
  async confirm(userId: string, q: Record<string, string>): Promise<Outcome> {
    const ref = q.vnp_TxnRef ?? '';
    if (vnpayLive()) {
      const r = verifyResult(q);
      if (!r.valid) return fail('PAYMENT_SIGNATURE_INVALID', 'Kết quả thanh toán không hợp lệ (sai chữ ký).', 400);
      if (!r.success) return { status: 'FAILED', message: r.message };
      const t = parseTxnRef(ref);
      if (t?.kind !== 'COMMISSION') return fail('PAYMENT_INTENT_NOT_FOUND', 'Mã giao dịch không hợp lệ.', 400);
      const row = await this.load(t.id);
      if (!row || row.vendor_profiles?.user_id !== userId) return fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
      const res = await this.markPaid(row, r);
      if (res === 'AMOUNT_MISMATCH') return fail('PAYMENT_AMOUNT_MISMATCH', 'Số tiền thanh toán không khớp bảng kê.', 409);
      return this.paidOutcome(t.id, res === 'ALREADY' ? 'Bảng kê đã được ghi nhận thanh toán.' : 'Thanh toán thành công.');
    }

    const it = this.intents.get(ref);
    if (!it || it.userId !== userId || it.expires < Date.now()) return fail('PAYMENT_INTENT_NOT_FOUND', 'Phiên thanh toán không tồn tại hoặc đã hết hạn.', 404);
    this.intents.delete(ref);
    if (q.vnp_ResponseCode !== '00') return { status: 'FAILED', message: 'Bạn đã hủy thanh toán.' };
    const row = await this.load(it.statementId);
    if (!row) return fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
    const now = new Date();
    const simulated: VnpayResult = {
      valid: true,
      success: true,
      txnRef: ref,
      amount: it.amount,
      transactionNo: `GD${ymdVN(now).replaceAll('-', '')}${String(randomInt(0, 100000)).padStart(5, '0')}`,
      paidAt: now,
      message: '',
    };
    const res = await this.markPaid(row, simulated);
    if (res === 'AMOUNT_MISMATCH') return fail('PAYMENT_AMOUNT_MISMATCH', 'Số tiền thanh toán không khớp bảng kê.', 409);
    return this.paidOutcome(row.id, res === 'ALREADY' ? 'Bảng kê đã được ghi nhận thanh toán.' : 'Thanh toán thành công.');
  }

  /** IPN của VNPay cho giao dịch hoa hồng (chữ ký đã kiểm ở PaymentsGatewayController). */
  async ipn(statementId: string, r: VnpayResult): Promise<IpnCode> {
    const row = await this.load(statementId);
    if (!row) return '01';
    if (row.status === 'Paid') return '02';
    if (Math.round(Number(row.total_amount)) !== Math.round(r.amount)) return '04';
    // Giao dịch thất bại: không ghi gì, chỉ xác nhận đã nhận thông báo
    if (!r.success) return '00';
    const res = await this.markPaid(row, r);
    return res === 'ALREADY' ? '02' : res === 'AMOUNT_MISMATCH' ? '04' : '00';
  }

  private load(id: string) {
    return this.prisma.commission_statements.findUnique({ where: { id }, include: { vendor_profiles: { select: { user_id: true, business_name: true } } } });
  }

  private async paidOutcome(id: string, message: string): Promise<Outcome> {
    const row = (await this.load(id))!;
    return { status: 'PAID', statementId: `DS${ymd(row.period_month).slice(5, 7)}${ymd(row.period_month).slice(0, 4)}`, transactionCode: row.transaction_code, message };
  }

  /**
   * Ghi nhận bảng kê Đã thanh toán và báo NCC, Admin. Trang quay về và IPN có thể đến cùng lúc:
   * chỉ cập nhật khi bảng kê còn Unpaid, bên đến sau nhận ALREADY và không gửi thông báo lần hai.
   */
  private async markPaid(row: NonNullable<Awaited<ReturnType<CommissionPaymentsService['load']>>>, r: VnpayResult): Promise<'PAID' | 'ALREADY' | 'AMOUNT_MISMATCH'> {
    if (row.status === 'Paid') return 'ALREADY';
    if (Math.round(Number(row.total_amount)) !== Math.round(r.amount)) return 'AMOUNT_MISMATCH';
    // Mã giao dịch phải duy nhất: nếu trùng thì thêm hậu tố
    const taken = await this.prisma.commission_statements.findUnique({ where: { transaction_code: r.transactionNo }, select: { id: true } });
    const txCode = taken && taken.id !== row.id ? `${r.transactionNo}-${row.id.slice(0, 4)}` : r.transactionNo;
    const { count } = await this.prisma.commission_statements.updateMany({ where: { id: row.id, status: 'Unpaid' }, data: { status: 'Paid', transaction_code: txCode, paid_date: r.paidAt } });
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
