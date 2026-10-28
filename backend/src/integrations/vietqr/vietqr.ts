/*
 * Thanh toán VietQR + SePay, dùng chung cho đặt cọc của cặp đôi và hoa hồng của NCC (cùng một tài khoản nhận).
 * Cấu hình: VIETQR_BANK_BIN, VIETQR_ACCOUNT_NO, VIETQR_ACCOUNT_NAME, SEPAY_TOKEN.
 *
 * - Mã QR dựng bằng Quick Link của img.vietqr.io (số tiền và nội dung đã điền sẵn).
 * - Nội dung chuyển khoản bắt buộc bắt đầu bằng "SEVQR " (yêu cầu của SePay với VietinBank), sau đó phân biệt hai luồng:
 *   "EVERLY" + mã đơn (cọc), "EVHH" + 8 ký tự đầu của id bảng kê (hoa hồng). Tổng tối đa 25 ký tự, in hoa, không dấu.
 * - Xác nhận đã nhận tiền bằng cách hỏi SePay (sepay.ts), không tin kết quả do trình duyệt báo.
 */

/** Thời hạn hiển thị một mã QR trên giao diện (sau đó vẫn bấm kiểm tra lại được). */
export const PAYMENT_TTL_MS = 15 * 60 * 1000;

/** Tiền tố bắt buộc của nội dung chuyển khoản (SePay) */
export const SEPAY_PREFIX = 'SEVQR ';
export const MAX_CONTENT_LENGTH = 25;
export const DEPOSIT_PREFIX = 'EVERLY';
export const COMMISSION_PREFIX = 'EVHH';

export interface VietqrConfig {
  bankBin: string;
  accountNo: string;
  accountName: string;
  sepayToken: string;
}

/** Đủ 4 biến cấu hình thì trả cấu hình, thiếu thì null. */
export function vietqrConfig(): VietqrConfig | null {
  const c = {
    bankBin: process.env.VIETQR_BANK_BIN?.trim() ?? '',
    accountNo: process.env.VIETQR_ACCOUNT_NO?.trim() ?? '',
    accountName: process.env.VIETQR_ACCOUNT_NAME?.trim() ?? '',
    sepayToken: process.env.SEPAY_TOKEN?.trim() ?? '',
  };
  return c.bankBin && c.accountNo && c.accountName && c.sepayToken ? c : null;
}

/** Nội dung chuyển khoản đầy đủ; vượt 25 ký tự thì không dùng được nên báo lỗi sớm thay vì tạo QR sai. */
function withPrefix(code: string) {
  const content = `${SEPAY_PREFIX}${code}`.toUpperCase();
  if (content.length > MAX_CONTENT_LENGTH) throw new Error(`Nội dung chuyển khoản dài ${content.length} ký tự, tối đa ${MAX_CONTENT_LENGTH}.`);
  return content;
}
export const depositContent = (orderCode: string) => withPrefix(`${DEPOSIT_PREFIX}${orderCode}`);
/** Mã bảng kê dùng trong nội dung chuyển khoản: 8 ký tự hex đầu của id (mã DS<MM><YYYY> trùng giữa các NCC nên không dùng được). */
export const commissionContent = (statementId: string) => withPrefix(`${COMMISSION_PREFIX}${statementId.replace(/-/g, '').slice(0, 8)}`);

/** Ngân hàng thường bỏ dấu cách và ký tự đặc biệt trong nội dung: so khớp trên chuỗi chữ hoa, chỉ giữ chữ và số. */
export const normalizeContent = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
/** Khóa so khớp: bỏ tiền tố SEVQR vì ngân hàng/SePay có thể cắt hoặc chèn thêm chữ quanh nó. */
export const matchKey = (content: string) => normalizeContent(content).replace(/^SEVQR/, '');

export interface PayInfo {
  qrUrl: string;
  amount: number;
  content: string;
  bankBin: string;
  accountNo: string;
  accountName: string;
  expiresAt: string;
}

export function buildPayInfo(cfg: VietqrConfig, o: { amount: number; content: string }): PayInfo {
  const qs = new URLSearchParams({ amount: String(Math.round(o.amount)), addInfo: o.content, accountName: cfg.accountName });
  return {
    qrUrl: `https://img.vietqr.io/image/${cfg.bankBin}-${cfg.accountNo}-compact2.png?${qs}`,
    amount: Math.round(o.amount),
    content: o.content,
    bankBin: cfg.bankBin,
    accountNo: cfg.accountNo,
    accountName: cfg.accountName,
    expiresAt: new Date(Date.now() + PAYMENT_TTL_MS).toISOString(),
  };
}
