/*
 * Số điện thoại di động Việt Nam: 10 số, đầu 03, 05, 07, 08 hoặc 09 (đầu số sau đợt chuyển 11 số về 10 số năm 2018).
 * Nhận cả cách viết có khoảng trắng, dấu chấm, gạch ngang, ngoặc hoặc đầu +84 / 84; lưu dạng chuẩn "0xxxxxxxxx".
 * Module thuần, dùng chung cho tài khoản, đăng ký hợp tác và số điện thoại khách trên đơn.
 */
export const VN_PHONE_RE = /^0(3|5|7|8|9)\d{8}$/;
export const PHONE_MESSAGE = 'Số điện thoại di động gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.';

/** Bỏ ký tự phân cách và đổi +84 / 84 về 0: "+84 912.345.678" -> "0912345678". Không phải số thì trả nguyên văn đã bỏ khoảng trắng hai đầu. */
export function normalizePhone(raw: string | null | undefined) {
  const s = (raw ?? '').trim();
  const digits = s.replace(/[\s.\-()]/g, '');
  if (/^\+?84\d{9}$/.test(digits)) return `0${digits.replace(/^\+?84/, '')}`;
  return digits;
}

export const isVnPhone = (raw: string | null | undefined) => VN_PHONE_RE.test(normalizePhone(raw));
