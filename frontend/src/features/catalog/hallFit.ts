/**
 * Sảnh (gói của Trung tâm tiệc cưới) có hợp với đám cưới của khách không: đủ chỗ cho số khách dự kiến
 * và số bàn tối thiểu không vượt số bàn dự kiến. Unit test: hallFit.test.ts.
 */

export interface HallLike {
  capacity?: number | null
  minTables?: number | null
}

export interface WeddingLike {
  guestCount: number | null
  /** Số bàn khách tự nhập; null là tự tính theo số khách */
  tableCountOverride?: number | null
}

/** Số bàn dự kiến, cùng công thức với BE (services.service.ts): số tự nhập, không có thì ⌈số khách / 10⌉, ít nhất 1. null khi chưa có số khách. */
export function expectedTables(w: WeddingLike | null | undefined): number | null {
  if (!w) return null
  if (w.tableCountOverride) return w.tableCountOverride
  if (!w.guestCount) return null
  return Math.max(1, Math.ceil(w.guestCount / 10))
}

const num = (n: number) => n.toLocaleString('vi-VN')

/** Lý do sảnh không phù hợp; null khi phù hợp hoặc chưa đủ dữ liệu đám cưới để so. */
export function hallMismatch(hall: HallLike, w: WeddingLike | null | undefined): string | null {
  const guests = w?.guestCount ?? null
  if (guests && hall.capacity && hall.capacity < guests) {
    return `Không phù hợp: sảnh chứa tối đa ${num(hall.capacity)} khách, ít hơn ${num(guests)} khách dự kiến`
  }
  const tables = expectedTables(w)
  if (tables && hall.minTables && hall.minTables > tables) {
    return `Không phù hợp: đặt tối thiểu ${num(hall.minTables)} bàn, nhiều hơn ${num(tables)} bàn dự kiến`
  }
  return null
}
