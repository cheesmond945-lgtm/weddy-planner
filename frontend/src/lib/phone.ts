/**
 * Số điện thoại di động Việt Nam (cùng quy tắc với backend/src/common/phone.ts): 10 số, đầu 03, 05, 07, 08 hoặc 09.
 * Nhận cả cách viết có khoảng trắng, dấu chấm, gạch ngang, ngoặc hoặc đầu +84 / 84.
 */
export const VN_PHONE_RE = /^0(3|5|7|8|9)\d{8}$/
export const PHONE_MESSAGE = 'Số điện thoại di động gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.'

/** "+84 912.345.678" -> "0912345678" */
export function normalizePhone(raw: string | null | undefined) {
  const digits = (raw ?? '').trim().replace(/[\s.\-()]/g, '')
  return /^\+?84\d{9}$/.test(digits) ? `0${digits.replace(/^\+?84/, '')}` : digits
}

export const isVnPhone = (raw: string | null | undefined) => VN_PHONE_RE.test(normalizePhone(raw))
