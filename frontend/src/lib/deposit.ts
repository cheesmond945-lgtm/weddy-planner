/**
 * Tiền cọc của đơn: MỘT công thức duy nhất cho form (ước tính), mock và tài liệu (docs/api/orders.md); backend tính chính thức giống hệt.
 *
 * Quy tắc: tổng × tỷ lệ / 100, làm tròn gần nhất đến 100.000đ, TỐI THIỂU 100.000đ (cọc 0đ thì khách không thanh toán được qua VNPay).
 * Chờ nhóm xác nhận (docs/CHOT_NGHIEP_VU_NCC.md mục "Chưa chốt").
 * Tiền cọc lớn hơn hoặc bằng tổng đơn thì đơn quá nhỏ để đặt cọc: không cho Gửi đơn (vẫn Lưu nháp).
 */
export const DEPOSIT_ROUNDING = 100_000
export const DEPOSIT_MIN = 100_000

export function depositOf(total: number, percent: number): number {
  if (!(percent > 0 && percent < 100) || !(total > 0)) return 0
  const rounded = Math.round((total * percent) / 100 / DEPOSIT_ROUNDING) * DEPOSIT_ROUNDING
  return Math.max(DEPOSIT_MIN, rounded)
}

/** Tổng đơn quá nhỏ để đặt cọc: tiền cọc (đã làm tròn, tối thiểu) không nhỏ hơn tổng đơn. */
export const isDepositTooLarge = (total: number, percent: number) => total > 0 && percent > 0 && percent < 100 && depositOf(total, percent) >= total
