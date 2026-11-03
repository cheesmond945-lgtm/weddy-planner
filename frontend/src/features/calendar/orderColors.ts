/*
 * Màu theo đơn và tên khách ngắn cho lịch làm việc của NCC. Hàm thuần, không phụ thuộc giao diện.
 * Mỗi đơn một màu (hue) ổn định để NCC nhìn lịch là biết việc của khách nào; màu đỏ và vàng dành cho trạng thái (quá hạn, ngày thực hiện)
 * nên không nằm trong bảng màu.
 */

export const HUES = [205, 330, 150, 270, 175, 235, 305, 95] as const

export interface HueOrder {
  id: string
  /** Mã đơn DH<yyMM><4 số>: tăng theo thời điểm tạo (id là UUID ngẫu nhiên nên không dùng để sắp được) */
  orderCode: string
  /** Đơn đang theo dõi (chờ cọc, chờ chỉnh sửa, đã cọc): được chia màu trước đơn đã xong / đã hủy */
  active?: boolean
}

/**
 * Gán hue cho từng đơn: đơn đang theo dõi trước, rồi theo mã đơn, chia lần lượt. Nhờ vậy tối đa HUES.length đơn đang theo dõi không trùng màu
 * dù NCC có nhiều đơn cũ, và đơn mới (mã lớn hơn) không làm đổi màu đơn đang có. Cùng danh sách luôn ra cùng kết quả, không phụ thuộc thứ tự đầu vào.
 */
export function assignHues(orders: readonly HueOrder[]): Map<string, number> {
  const sorted = [...new Map(orders.map((o) => [o.id, o])).values()].sort(
    (a, b) => Number(!a.active) - Number(!b.active) || a.orderCode.localeCompare(b.orderCode) || a.id.localeCompare(b.id),
  )
  return new Map(sorted.map((o, i) => [o.id, HUES[i % HUES.length]]))
}

/** Hue của một đơn; đơn chưa có trong danh sách (ví dụ ngoài 100 đơn gần nhất) lấy theo băm mã đơn. */
export function hueOf(map: ReadonlyMap<string, number>, id: string): number {
  const known = map.get(id)
  if (known !== undefined) return known
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return HUES[h % HUES.length]
}

/**
 * Tên khách ngắn: cặp đôi "Lương Minh Hùng & Bùi Thanh Chi" thành "Hùng & Chi"; một người "Nguyễn Văn An" thành "Văn An".
 * Tách theo "&", "+", " và ". Rỗng thì trả "Khách".
 */
export function shortCouple(name: string): string {
  const parts = name
    .split(/\s*(?:&|\+|\svà\s)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return 'Khách'
  if (parts.length === 1) return parts[0].split(/\s+/).slice(-2).join(' ')
  return parts.map((p) => p.split(/\s+/).slice(-1)[0]).join(' & ')
}
