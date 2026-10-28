import { createHmac, timingSafeEqual } from 'node:crypto';

/*
 * Cổng thanh toán VNPay (bản 2.1.0), dùng chung cho đặt cọc của cặp đôi và hoa hồng của NCC.
 * Bật khi có VNPAY_TMN_CODE, VNPAY_HASH_SECRET và PAYMENT_MODE khác "simulate"; ngược lại các luồng dùng chế độ giả lập.
 *
 * Kết quả về theo hai đường, cả hai đều phải kiểm chữ ký và ghi nhận chống trùng:
 * - Return URL: VNPay chuyển trình duyệt người trả về FE (chạy được với localhost), FE gửi các tham số vnp_* cho BE.
 * - IPN: máy chủ VNPay gọi GET /api/payments/vnpay/ipn (cần địa chỉ công khai; khai báo URL này với VNPay khi deploy).
 *
 * Mã giao dịch (vnp_TxnRef) = tiền tố loại + id bảng (32 ký tự hex) + thời điểm (base36), để biết đây là đặt cọc hay hoa hồng.
 */

export type TxnKind = 'DEPOSIT' | 'COMMISSION';
const PREFIX: Record<TxnKind, string> = { DEPOSIT: 'D', COMMISSION: 'C' };

/** Thời hạn thanh toán trên VNPay (cùng thời hạn phiên giả lập) */
export const PAYMENT_TTL_MS = 15 * 60 * 1000;

export const vnpayLive = () =>
  (process.env.PAYMENT_MODE ?? 'simulate') !== 'simulate' && !!process.env.VNPAY_TMN_CODE && !!process.env.VNPAY_HASH_SECRET;

export const frontendUrl = () => (process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173').trim().replace(/\/$/, '');

/** Mã hóa như VNPay: encodeURIComponent, dấu cách thành "+". */
const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, '+');
/** Chuỗi ký: các tham số sắp theo tên, đã mã hóa, nối bằng "&". */
const signedQuery = (params: Record<string, string>) =>
  Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join('&');
const sign = (query: string) => createHmac('sha512', process.env.VNPAY_HASH_SECRET!).update(Buffer.from(query, 'utf-8')).digest('hex');

/** yyyyMMddHHmmss theo giờ Việt Nam */
const vnpDate = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().replace(/[-:T]/g, '').slice(0, 14);

/** VNPay cần IP dạng IPv4: bỏ tiền tố "::ffff:" của IPv6, máy chạy cục bộ ("::1") thì dùng 127.0.0.1. */
const ipv4Of = (ip: string | undefined) => {
  const v = (ip ?? '').replace(/^::ffff:/, '');
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(v) ? v : '127.0.0.1';
};

/** Phương thức FE chọn -> vnp_BankCode (để trống thì VNPay cho người dùng tự chọn). */
const BANK_CODE: Record<string, string> = { VNPAY_QR: 'VNPAYQR', VNPAY_ATM: 'VNBANK', INTERNATIONAL_CARD: 'INTCARD' };

export const txnRefOf = (kind: TxnKind, id: string) => `${PREFIX[kind]}${id.replace(/-/g, '')}${Date.now().toString(36)}`;

/** vnp_TxnRef -> loại giao dịch và id (uuid) của bảng tương ứng (đơn hàng / bảng kê). */
export function parseTxnRef(ref: string): { kind: TxnKind; id: string } | null {
  const m = /^([DC])([0-9a-f]{32})/.exec(ref ?? '');
  if (!m) return null;
  const h = m[2];
  return { kind: m[1] === 'D' ? 'DEPOSIT' : 'COMMISSION', id: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` };
}

export function buildPaymentUrl(o: { txnRef: string; amount: number; orderInfo: string; ip: string | undefined; returnUrl: string; method?: string }) {
  const now = new Date();
  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: process.env.VNPAY_TMN_CODE!,
    vnp_Amount: String(Math.round(o.amount * 100)),
    vnp_CreateDate: vnpDate(now),
    vnp_ExpireDate: vnpDate(new Date(now.getTime() + PAYMENT_TTL_MS)),
    vnp_CurrCode: 'VND',
    vnp_IpAddr: ipv4Of(o.ip),
    vnp_Locale: 'vn',
    // VNPay khuyến nghị nội dung không dấu
    vnp_OrderInfo: o.orderInfo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'),
    vnp_OrderType: 'other',
    vnp_ReturnUrl: o.returnUrl,
    vnp_TxnRef: o.txnRef,
    ...(o.method && BANK_CODE[o.method] ? { vnp_BankCode: BANK_CODE[o.method] } : {}),
  };
  const query = signedQuery(params);
  const base = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  return `${base}?${query}&vnp_SecureHash=${sign(query)}`;
}

export interface VnpayResult {
  /** Chữ ký hợp lệ */
  valid: boolean;
  /** Giao dịch thành công (mã phản hồi và trạng thái giao dịch đều 00) */
  success: boolean;
  txnRef: string;
  /** Số tiền (đồng) */
  amount: number;
  /** Mã giao dịch tại VNPay */
  transactionNo: string;
  paidAt: Date;
  /** Thông báo cho người dùng khi không thành công */
  message: string;
}

const FAIL_MESSAGE: Record<string, string> = {
  '24': 'Bạn đã hủy thanh toán.',
  '11': 'Đã hết thời gian chờ thanh toán. Vui lòng thử lại.',
  '51': 'Tài khoản không đủ số dư.',
  '65': 'Tài khoản đã vượt hạn mức giao dịch trong ngày.',
  '75': 'Ngân hàng thanh toán đang bảo trì.',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định.',
};

/** Kiểm tra kết quả VNPay trả về (Return URL hoặc IPN): chữ ký HMAC-SHA512 trên các tham số vnp_* (trừ chữ ký). */
export function verifyResult(q: Record<string, string>): VnpayResult {
  const { vnp_SecureHash, vnp_SecureHashType: _type, ...rest } = q;
  const data = Object.fromEntries(Object.entries(rest).filter(([k, v]) => k.startsWith('vnp_') && v !== undefined && v !== ''));
  const expected = Buffer.from(sign(signedQuery(data)));
  const got = Buffer.from((vnp_SecureHash ?? '').toLowerCase());
  const valid = got.length === expected.length && timingSafeEqual(got, expected);
  const success = q.vnp_ResponseCode === '00' && (!q.vnp_TransactionStatus || q.vnp_TransactionStatus === '00');
  const pd = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(q.vnp_PayDate ?? '');
  return {
    valid,
    success,
    txnRef: q.vnp_TxnRef ?? '',
    amount: Number(q.vnp_Amount) / 100,
    transactionNo: q.vnp_TransactionNo || q.vnp_TxnRef || '',
    paidAt: pd ? new Date(`${pd[1]}-${pd[2]}-${pd[3]}T${pd[4]}:${pd[5]}:${pd[6]}+07:00`) : new Date(),
    message: success ? 'Thanh toán thành công.' : (FAIL_MESSAGE[q.vnp_ResponseCode ?? ''] ?? 'Thanh toán không thành công.'),
  };
}

/**
 * Mã trả lời IPN theo quy định VNPay. VNPay gọi lại cho tới khi nhận 00 hoặc 02.
 * 00 ghi nhận xong (kể cả giao dịch thất bại đã được ghi nhận là thất bại), 01 không tìm thấy, 02 đã xử lý trước đó,
 * 04 sai số tiền, 97 sai chữ ký, 99 lỗi khác.
 */
export type IpnCode = '00' | '01' | '02' | '04' | '97' | '99';
export const IPN_MESSAGE: Record<IpnCode, string> = {
  '00': 'Confirm Success',
  '01': 'Order not found',
  '02': 'Order already confirmed',
  '04': 'Invalid amount',
  '97': 'Invalid signature',
  '99': 'Unknow error',
};
