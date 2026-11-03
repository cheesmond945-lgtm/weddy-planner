/*
 * timeline_tasks không có cột ghi chú nên backend lưu "tên — ghi chú" trong một tiêu đề (timeline-rows.ts taskTitle).
 * Hai hàm thuần này ghép và tách lại theo ĐÚNG dấu phân cách đó, chỉ lần xuất hiện ĐẦU TIÊN.
 */
export const TITLE_SEPARATOR = ' — '

/** "Tên — ghi chú" (không có ghi chú thì chỉ tên). */
export function joinTitle(title: string, note: string | null | undefined): string {
  const t = title.trim()
  const n = note?.trim()
  return n ? `${t}${TITLE_SEPARATOR}${n}` : t
}

/** Tách tiêu đề đã ghép: lần xuất hiện đầu tiên của dấu phân cách; không có thì cả chuỗi là tên. */
export function splitTitle(full: string): { title: string; note: string | null } {
  const i = full.indexOf(TITLE_SEPARATOR)
  if (i < 0) return { title: full.trim(), note: null }
  const title = full.slice(0, i).trim()
  const note = full.slice(i + TITLE_SEPARATOR.length).trim()
  return title ? { title, note: note || null } : { title: full.trim(), note: null }
}
