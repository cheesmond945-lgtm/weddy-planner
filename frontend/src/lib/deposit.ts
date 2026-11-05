/**
 * Tiền cọc của đơn: MỘT công thức duy nhất cho form (ước tính), mock và tài liệu (docs/api/orders.md); backend tính chính thức giống hệt.
 *
 * Quy tắc: tổng × tỷ lệ / 100, làm tròn gần nhất đến 1.000đ, TỐI THIỂU 100.000đ (cọc 0đ thì khách không thanh toán được qua VietQR).
 * Chờ nhóm xác nhận (docs/CHOT_NGHIEP_VU_NCC.md mục "Chưa chốt").
 * Tiền cọc lớn hơn hoặc bằng tổng đơn thì đơn quá nhỏ để đặt cọc: không cho Gửi đơn (vẫn Lưu nháp).
 */
export const DEPOSIT_ROUNDING = 1_000
export const DEPOSIT_MIN = 100_000
/** Tỷ lệ cọc tối thiểu khi gửi đơn (%), như backend (order-rules.ts). Đợt 1 cọc qua VietQR, đợt 2 tiền mặt trả NCC. */
export const DEPOSIT_PERCENT_MIN = 10

export function depositOf(total: number, percent: number): number {
  if (!(percent > 0 && percent < 100) || !(total > 0)) return 0
  const rounded = Math.round((total * percent) / 100 / DEPOSIT_ROUNDING) * DEPOSIT_ROUNDING
  return Math.max(DEPOSIT_MIN, rounded)
}

/** Tổng đơn quá nhỏ để đặt cọc: tiền cọc (đã làm tròn, tối thiểu) không nhỏ hơn tổng đơn. */
export const isDepositTooLarge = (total: number, percent: number) => total > 0 && percent > 0 && percent < 100 && depositOf(total, percent) >= total

/** Lỗi tỷ lệ cọc (số nguyên từ 10 đến 99); đúng thì undefined. Ô trống hoặc chữ (giá trị 0 / NaN) cũng là lỗi. */
export function depositPercentError(percent: number): string | undefined {
  if (!Number.isFinite(percent) || percent === 0) return `Nhập tỷ lệ cọc từ ${DEPOSIT_PERCENT_MIN} đến 99 (%).`
  if (!Number.isInteger(percent) || percent < DEPOSIT_PERCENT_MIN || percent >= 100) return `Tỷ lệ cọc là số nguyên từ ${DEPOSIT_PERCENT_MIN} đến 99 (%).`
  return undefined
}
