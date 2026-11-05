/** Tên từ độ dài này trở xuống giữ nguyên */
const MAX = 24

/** Cụm chung chung đầu tên: "Trung tâm hội nghị tiệc cưới", "Trung tâm sự kiện & tiệc cưới", "Nhà hàng tiệc cưới", "Tiệm hoa"… */
const GENERIC_HEAD = /^(trung tâm(\s+(hội nghị|sự kiện|tổ chức sự kiện|tiệc cưới|&|và))*|nhà hàng(\s+tiệc cưới)?|tiệm hoa|cửa hàng)\s+/iu
/** Cụm chung chung cuối tên: "Wedding & Events", "Wedding & Convention", "& Academy" */
const GENERIC_TAIL = /\s+(wedding\s*&\s*(events?|convention)|&\s*academy)$/iu
/** Phần chỉ toàn từ chung chung (bỏ khi tên có dấu " - " ngăn cách) */
const GENERIC_PART = /^(trung tâm|tiệc cưới|sự kiện|hội nghị|wedding|events?|flowers?|dress|custom|tailoring|studio|tiệm hoa|&|và|\s)+$/iu

/**
 * Tên nhà cung cấp gọn cho chỗ hẹp (khung chat, danh sách hội thoại, khay so sánh…): tên dài thì bỏ cụm chung chung,
 * giữ phần riêng của thương hiệu. "Trung Tâm Hội Nghị Tiệc Cưới Forevermark" → "Forevermark",
 * "Sun Palace - Trung Tâm Tiệc Cưới & Sự Kiện" → "Sun Palace", "Hanoi Tower Wedding & Convention" → "Hanoi Tower".
 * Tên ngắn, hoặc bỏ đi thì không còn gì, giữ nguyên. Nơi dùng nên để tên đầy đủ ở `title`.
 */
export function shortVendorName(name: string) {
  const full = name.trim()
  if (full.length <= MAX) return full
  let s = full
  // "Thương hiệu - mô tả": giữ phần đầu tiên không chỉ toàn từ chung chung
  const parts = s.split(/\s+[-–|]\s+/)
  if (parts.length > 1) s = parts.find((p) => !GENERIC_PART.test(p.toLowerCase())) ?? parts[0]
  s = s.replace(GENERIC_HEAD, '').replace(GENERIC_TAIL, '').trim()
  return s.length >= 2 ? s : full
}
