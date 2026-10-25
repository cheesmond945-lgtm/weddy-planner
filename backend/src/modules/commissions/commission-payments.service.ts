import { HttpException, Injectable } from '@nestjs/common';
import { createHmac, randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { ymd, ymdVN } from '../orders/order-mapping';

/*
 * NCC thanh toán hoa hồng qua VNPay.
 * - Chế độ thật (có VNPAY_TMN_CODE và VNPAY_HASH_SECRET, và PAYMENT_MODE khác "simulate"): tạo URL thanh toán VNPay ký HMAC-SHA512,
 *   trình duyệt NCC được chuyển sang trang VNPay, VNPay chuyển về VNPAY_RETURN_URL kèm kết quả; FE gọi confirm, BE kiểm tra chữ ký,
 *   mã phản hồi và số tiền rồi ghi nhận Đã thanh toán với mã giao dịch của VNPay (vnp_TransactionNo).
 * - Chế độ giả lập (mặc định, như đặt cọc): trang "VNPay sandbox" giả trong FE; mã giao dịch do hệ thống sinh.
 * Chưa có IPN (VNPay gọi server-to-server): khi triển khai thật cần thêm để không mất kết quả nếu NCC đóng trình duyệt giữa chừng.
 */
const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const INTENT_TTL_MS = 15 * 60 * 1000;
const monthVN = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);

/** Mã hóa như VNPay: encodeURIComponent, dấu cách thành "+". */
const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, '+');
const signedQuery = (params: Record<string, string>) =>
  Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join('&');
const vnpDate = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().replace(/[-:T]/g, '').slice(0, 14);

interface Intent {
  statementId: string;
  userId: string;
  amount: number;
  code: string;
  vendorName: string;
  expires: number;
}

@Injectable()
export class CommissionPaymentsService {
  /** Lượt thanh toán giả lập đang chờ (mất khi khởi động lại; chỉ dùng cho chế độ giả lập). */
  private readonly intents = new Map<string, Intent>();

  constructor(private readonly prisma: PrismaService) {}

  private get live() {
    return (process.env.PAYMENT_MODE ?? 'simulate') !== 'simulate' && !!process.env.VNPAY_TMN_CODE && !!process.env.VNPAY_HASH_SECRET;
  }
  private get frontend() {
    return (process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN?.split(',')[0] ?? 'http://localhost:5173').trim().replace(/\/$/, '');
  }
  private get returnUrl() {
    return process.env.VNPAY_RETURN_URL ?? `${this.frontend}/vendor/commissions/vnpay-return`;
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

    const txnRef = `${row.id.replace(/-/g, '')}${Date.now().toString(36)}`;
    const code = `DS${period.slice(5)}${period.slice(0, 4)}`;
    if (!this.live) {
      this.intents.set(txnRef, { statementId: row.id, userId, amount, code, vendorName: vendor.business_name, expires: Date.now() + INTENT_TTL_MS });
      return { mode: 'SIMULATE' as const, paymentUrl: `${this.frontend}/vendor/commissions/vnpay-sandbox?ref=${txnRef}` };
    }
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: process.env.VNPAY_TMN_CODE!,
      vnp_Amount: String(Math.round(amount * 100)),
      vnp_CreateDate: vnpDate(new Date()),
      vnp_CurrCode: 'VND',
      vnp_IpAddr: ip || '127.0.0.1',
      vnp_Locale: 'vn',
      vnp_OrderInfo: `Thanh toan hoa hong ${code}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: this.returnUrl,
      vnp_TxnRef: txnRef,
    };
    const query = signedQuery(params);
    const hash = createHmac('sha512', process.env.VNPAY_HASH_SECRET!).update(Buffer.from(query, 'utf-8')).digest('hex');
    const base = process.env.VNPAY_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    return { mode: 'LIVE' as const, paymentUrl: `${base}?${query}&vnp_SecureHash=${hash}` };
  }

  /** Thông tin lượt giả lập cho trang "VNPay sandbox" (chỉ chế độ giả lập, chỉ của chính NCC đó). */
  intent(userId: string, ref: string) {
    const it = this.intents.get(ref);
    if (this.live || !it || it.userId !== userId || it.expires < Date.now()) return fail('PAYMENT_INTENT_NOT_FOUND', 'Phiên thanh toán không tồn tại hoặc đã hết hạn.', 404);
    return { code: it.code, amount: it.amount, vendorName: it.vendorName, expiresAt: new Date(it.expires).toISOString() };
  }

  /** Kết quả quay về từ VNPay (hoặc trang giả lập): kiểm tra rồi ghi nhận Đã thanh toán. */
  async confirm(userId: string, q: Record<string, string>) {
    const ref = q.vnp_TxnRef ?? '';
    let statementId: string;
    let amount: number;
    let transactionNo: string;
    let paidAt = new Date();

    if (this.live) {
      const { vnp_SecureHash, vnp_SecureHashType: _t, ...rest } = q;
      const data = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('vnp_')));
      const expected = createHmac('sha512', process.env.VNPAY_HASH_SECRET!).update(Buffer.from(signedQuery(data), 'utf-8')).digest('hex');
      if (!vnp_SecureHash || vnp_SecureHash.toLowerCase() !== expected) return fail('PAYMENT_SIGNATURE_INVALID', 'Kết quả thanh toán không hợp lệ (sai chữ ký).', 400);
      if (q.vnp_ResponseCode !== '00' || (q.vnp_TransactionStatus && q.vnp_TransactionStatus !== '00')) return { status: 'FAILED' as const, message: q.vnp_ResponseCode === '24' ? 'Bạn đã hủy thanh toán.' : 'Thanh toán không thành công.' };
      const m = /^([0-9a-f]{32})/.exec(ref);
      if (!m) return fail('PAYMENT_INTENT_NOT_FOUND', 'Mã giao dịch không hợp lệ.', 400);
      statementId = `${m[1].slice(0, 8)}-${m[1].slice(8, 12)}-${m[1].slice(12, 16)}-${m[1].slice(16, 20)}-${m[1].slice(20)}`;
      amount = Number(q.vnp_Amount) / 100;
      transactionNo = q.vnp_TransactionNo || ref;
      const pd = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(q.vnp_PayDate ?? '');
      if (pd) paidAt = new Date(`${pd[1]}-${pd[2]}-${pd[3]}T${pd[4]}:${pd[5]}:${pd[6]}+07:00`);
    } else {
      const it = this.intents.get(ref);
      if (!it || it.userId !== userId || it.expires < Date.now()) return fail('PAYMENT_INTENT_NOT_FOUND', 'Phiên thanh toán không tồn tại hoặc đã hết hạn.', 404);
      if (q.vnp_ResponseCode !== '00') {
        this.intents.delete(ref);
        return { status: 'FAILED' as const, message: 'Bạn đã hủy thanh toán.' };
      }
      this.intents.delete(ref);
      statementId = it.statementId;
      amount = it.amount;
      transactionNo = `GD${ymdVN(paidAt).replaceAll('-', '')}${String(randomInt(0, 100000)).padStart(5, '0')}`;
    }

    const row = await this.prisma.commission_statements.findUnique({ where: { id: statementId }, include: { vendor_profiles: { select: { user_id: true } } } });
    if (!row || row.vendor_profiles.user_id !== userId) return fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
    const code = `DS${ymd(row.period_month).slice(5, 7)}${ymd(row.period_month).slice(0, 4)}`;
    if (row.status === 'Paid') return { status: 'PAID' as const, statementId: code, transactionCode: row.transaction_code, message: 'Bảng kê đã được ghi nhận thanh toán.' };
    if (Math.round(Number(row.total_amount)) !== Math.round(amount)) return fail('PAYMENT_AMOUNT_MISMATCH', 'Số tiền thanh toán không khớp bảng kê.', 409);

    // Mã giao dịch phải duy nhất: nếu trùng thì thêm hậu tố
    const taken = await this.prisma.commission_statements.findUnique({ where: { transaction_code: transactionNo }, select: { id: true } });
    const txCode = taken ? `${transactionNo}-${row.id.slice(0, 4)}` : transactionNo;
    await this.prisma.commission_statements.update({ where: { id: row.id }, data: { status: 'Paid', transaction_code: txCode, paid_date: paidAt } });
    await notify(this.prisma, {
      userId,
      type: 'CommissionPaid',
      title: 'Đã ghi nhận thanh toán hoa hồng',
      content: `WebPlan đã nhận hoa hồng ${Number(row.total_amount).toLocaleString('vi-VN')}đ của kỳ ${ymd(row.period_month).slice(0, 7)} (mã giao dịch ${txCode}).`,
      referenceType: 'CommissionStatement',
      referenceId: row.id,
    });
    return { status: 'PAID' as const, statementId: code, transactionCode: txCode, message: 'Thanh toán thành công.' };
  }
}
