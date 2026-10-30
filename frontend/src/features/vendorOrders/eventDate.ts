import { formatDate } from '@/lib/date'

/*
 * Ngày thực hiện của đơn so với ngày cưới của khách (backend: order-rules.ts weddingDateIssue, docs/TIMELINE.md mục 7).
 * Chặn cứng nằm ở validateOrder; ở đây là phần nhắc (không chặn) hiện dưới ô ngày.
 */

/** Dịch vụ làm trong chính ngày cưới: ngày thực hiện lệch ngày cưới thì nhắc. Chụp ảnh và trang phục được làm trước ngày cưới. */
const DAY_OF_SLUGS = ['nha-hang', 'decor', 'makeup', 'hoa-cuoi']

/** Số ngày tối thiểu từ hôm nay (ngày cọc) tới ngày thực hiện để timeline đủ thời gian chuẩn bị (MIN_AFTER_DEPOSIT ở backend). */
const MIN_LEAD_DAYS: Record<string, number> = { 'nha-hang': 2, 'chup-anh': 2, decor: 2, 'trang-phuc': 3, makeup: 3, 'hoa-cuoi': 2 }

const dayOf = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000)

/** Các dòng nhắc cho NCC khi chọn ngày thực hiện; rỗng nếu ngày chưa hợp lệ hoặc không có gì cần nhắc. */
export function eventDateAdvice(input: { eventDate: string; weddingDate?: string | null; today: string; categorySlug?: string | null }): string[] {
  const { eventDate, weddingDate, today, categorySlug } = input
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(eventDate))) return []
  const out: string[] = []
  const lead = categorySlug ? MIN_LEAD_DAYS[categorySlug] : undefined
  if (lead !== undefined && eventDate >= today && dayOf(eventDate) - dayOf(today) < lead) {
    out.push(`Chỉ còn dưới ${lead} ngày kể từ hôm nay, các việc chuẩn bị trên timeline của khách sẽ bị dồn lại và đánh dấu gấp.`)
  }
  if (weddingDate && eventDate < weddingDate && categorySlug && DAY_OF_SLUGS.includes(categorySlug)) {
    out.push(`Dịch vụ này thường thực hiện đúng ngày cưới của khách (${formatDate(weddingDate)}). Bạn kiểm tra lại ngày đã nhập.`)
  }
  return out
}
