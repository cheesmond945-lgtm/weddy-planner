/*
 * Quy tắc các dòng báo giá gắn gói / sảnh trong form đơn NCC (hàm thuần, có test).
 * - Trung tâm tiệc cưới: chọn Sảnh một lần, dòng 1 tự tạo gắn sảnh đó (đơn vị Bàn, giá và số bàn tối thiểu theo gói).
 * - Lĩnh vực khác: mỗi dòng gắn một gói (hoặc không gắn); dòng gắn gói khoá đơn vị theo gói.
 * Liên kết việc chi tiết chỉ dựa vào gói của dòng (order_items.package_id), không dựa vào tên dòng.
 */
import type { OrderItemInput, OrderUnit } from '../../types/vendorOrder.ts'

/** Gói (hoặc sảnh) của NCC dùng để gắn vào dòng báo giá. */
export interface LinkPackage {
  id: string
  name: string
  price: number
  /** Trung tâm tiệc cưới tính theo Bàn, lĩnh vực khác theo Gói */
  unit: OrderUnit
  /** Số công việc NCC đã khai cho gói */
  taskCount: number
  /** Chỉ sảnh: số bàn tối thiểu */
  minTables?: number | null
}

/** Dòng nhập trong form: OrderItemInput + key của React. */
type Line = OrderItemInput & { key: string }

const isBlank = (i: OrderItemInput) => i.itemName.trim() === '' && !(i.unitPrice > 0)
const defaultTables = (hall: LinkPackage) => (hall.minTables && hall.minTables > 0 ? hall.minTables : 1)

/** Dòng báo giá của sảnh: tên sảnh, đơn vị Bàn, đơn giá theo gói, số bàn = tối thiểu của gói (mặc định 1). Giữ key và id của dòng cũ nếu có. */
export const hallLine = (hall: LinkPackage, prev?: Line, key = ''): Line => ({
  key: prev?.key ?? key,
  ...(prev?.id !== undefined && { id: prev.id }),
  itemName: hall.name,
  unit: 'Bàn',
  quantity: defaultTables(hall),
  unitPrice: hall.price,
  packageId: hall.id,
})

/** Dòng báo giá của sảnh hiện có: dòng đầu tiên gắn đúng sảnh (có thì là dòng 1). */
export const hallLineIndex = (items: readonly OrderItemInput[], hallId: string | null | undefined) => (hallId ? items.findIndex((i) => i.packageId === hallId) : -1)

/**
 * Chọn / đổi sảnh: tạo hoặc cập nhật dòng sảnh và đưa lên đầu. Dòng sảnh luôn nhảy theo gói (tên, đơn giá, số bàn tối thiểu);
 * NCC điều chỉnh giá thì nhập lại sau.
 * - Đã có dòng sảnh cũ (`oldHallId`, hoặc dòng gắn một sảnh khác trong `opts.hallIds` khi đơn lệch sảnh): thay tại chỗ bằng dòng của sảnh mới.
 * - Chưa có: dòng đầu còn trống thì dùng luôn; không thì chèn lên đầu, các dòng tự nhập giữ nguyên.
 * `newKey` đặt cho dòng mới tạo. `inPlaceOnly` (sửa sau cọc): không thêm dòng mới, chỉ thay dòng sảnh nếu có.
 */
export function applyHall<T extends Line>(items: readonly T[], hall: LinkPackage, oldHallId: string | null | undefined, newKey: string, opts: { inPlaceOnly?: boolean; hallIds?: readonly string[] } = {}): Line[] {
  let at = hallLineIndex(items, oldHallId)
  if (at < 0 && opts.hallIds) at = items.findIndex((i) => !!i.packageId && opts.hallIds!.includes(i.packageId))
  if (at >= 0) return items.map((i, k) => (k === at ? hallLine(hall, i) : i))
  if (opts.inPlaceOnly) return [...items]
  if (items.length && isBlank(items[0])) return items.map((i, k) => (k === 0 ? hallLine(hall, i) : i))
  return [hallLine(hall, undefined, newKey), ...items]
}

/** Chữ nhỏ dưới dòng gắn gói / sảnh. `done`: đơn đã cọc (việc đã tạo rồi). */
export function packageNote(item: OrderItemInput, pkg: LinkPackage | undefined, kind: 'hall' | 'package', done = false): string | null {
  if (!item.packageId) return null
  const name = pkg?.name ?? 'đang ẩn'
  const n = pkg?.taskCount ?? 0
  const what = kind === 'hall' ? 'sảnh' : 'gói'
  return `Gắn ${what} ${name} · ${n} công việc ${done ? 'đã tạo khi khách cọc' : 'sẽ tạo khi khách cọc'}`
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Dòng chưa gắn gói mà tên trùng hoặc gần trùng tên một gói đang đăng thì gợi ý gắn gói đó.
 * Gần trùng: sau khi bỏ dấu và viết thường, một tên chứa tên kia (từ 4 ký tự trở lên). Trả gói đầu tiên khớp, hoặc null.
 */
export function suggestPackage(item: OrderItemInput, packages: readonly LinkPackage[]): LinkPackage | null {
  if (item.packageId) return null
  const name = fold(item.itemName)
  if (name.length < 4) return null
  const exact = packages.find((p) => fold(p.name) === name)
  if (exact) return exact
  return (
    packages.find((p) => {
      const pn = fold(p.name)
      return pn.length >= 4 && (pn.includes(name) || name.includes(pn))
    }) ?? null
  )
}

/** Đơn của lĩnh vực không có sảnh mà không dòng nào gắn gói: hỏi lại trước khi gửi (việc chi tiết chỉ sinh từ gói). */
export const needsNoPackageConfirm = (items: readonly OrderItemInput[], venue: boolean) => !venue && !items.some((i) => i.packageId)

/** Lỗi số bàn của dòng sảnh: không thấp hơn số bàn tối thiểu của gói (nếu gói có quy tắc này). */
export function hallTablesError(line: OrderItemInput | undefined, hall: LinkPackage | undefined): string | undefined {
  const min = hall?.minTables
  if (!line || !min || min <= 0) return undefined
  return line.quantity < min ? `Sảnh này nhận tối thiểu ${min} bàn.` : undefined
}

/**
 * Ô Sảnh của form đơn: 'none' (lĩnh vực không có sảnh), 'empty' (Trung tâm tiệc cưới nhưng chưa có sảnh nào đang đăng:
 * vẫn thấy ô Sảnh kèm lời nhắn và link tới Quản lý gói dịch vụ), 'select' (có sảnh để chọn).
 */
export const hallFieldState = (venue: boolean, hallCount: number): 'none' | 'empty' | 'select' => (!venue ? 'none' : hallCount === 0 ? 'empty' : 'select')
