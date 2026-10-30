/*
 * Màu theo đơn và tên khách ngắn cho lịch làm việc của NCC. Hàm thuần, không phụ thuộc giao diện.
 * Mỗi đơn một màu (hue) ổn định để NCC nhìn lịch là biết việc của khách nào; màu đỏ và vàng dành cho trạng thái (quá hạn, ngày thực hiện)
 * nên không nằm trong bảng màu.
 */

export const HUES = [205, 330, 150, 270, 175, 235, 305, 95] as const

/**
 * Gán hue cho từng đơn: sắp theo mã đơn (UUID tăng dần theo thời điểm tạo) rồi chia lần lượt, nên các đơn hiện có không trùng màu
 * khi ít hơn HUES.length và đơn cũ giữ màu khi có đơn mới. Cùng danh sách luôn ra cùng kết quả, không phụ thuộc thứ tự đầu vào.
 */
export function assignHues(orderIds: readonly string[]): Map<string, number> {
  const sorted = [...new Set(orderIds)].sort()
  return new Map(sorted.map((id, i) => [id, HUES[i % HUES.length]]))
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
