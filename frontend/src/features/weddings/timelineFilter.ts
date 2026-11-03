import type { TimelineItem } from '@/types/wedding'

/*
 * Tìm kiếm và lọc việc của timeline (cách xem THEO THỜI GIAN và LỊCH). Hàm thuần: không đụng giao diện, không đọc đồng hồ
 * (hôm nay do nơi gọi truyền vào, "YYYY-MM-DD").
 */

/** all: mọi việc; mine: việc khách tự làm hoặc cùng làm (bỏ việc chỉ NCC làm); vendor: việc chỉ NCC làm. */
export type OwnerFilter = 'all' | 'mine' | 'vendor'

export interface TimelineFilters {
  /** Từ khóa tìm: nhiều từ cách nhau bởi dấu cách, việc phải chứa đủ các từ */
  q: string
  /** '' (mọi tháng), 'overdue' (chưa xong, quá hạn), 'soon' (chưa xong, hạn trong vài ngày tới) hoặc 'YYYY-MM' */
  month: string
  owner: OwnerFilter
}

export const NO_FILTERS: TimelineFilters = { q: '', month: '', owner: 'all' }

export const hasFilters = (f: TimelineFilters) => !!(f.q.trim() || f.month || f.owner !== 'all')

/** Bỏ dấu tiếng Việt, đ thành d, chữ thường: "Đặt cọc" khớp "dat coc". */
export const foldText = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

const dmy = (s: string) => s.split('-').reverse().join('/')

/** Các từ để tìm của một việc: tên việc, dịch vụ, tên NCC, hạng mục, mã đơn và ngày hạn (dd/mm/yyyy), đã bỏ dấu. */
function wordsOf(i: TimelineItem): string[] {
  const due = i.dueDate ?? ''
  const text = foldText([i.title, i.serviceName, i.category?.name, i.orderCode, due ? dmy(due) : ''].filter(Boolean).join(' '))
  return text.split(/[^a-z0-9/]+/).filter(Boolean)
}

/*
 * Luật tìm giống ô tìm Dịch vụ cưới (backend catalog/search.config.ts, giữ hai nơi trùng nhau): cụm đồng nghĩa hạng mục
 * ("chụp hình" = "chụp ảnh" = "quay phim", "make up" = "trang điểm"...), bỏ từ nối và từ chung chung ("đẹp", "uy tín").
 */
const CATEGORY_SYNONYMS: Record<string, string> = {
  'chup hinh': 'chup anh',
  'chup anh': 'chup anh',
  'chup anh cuoi': 'chup anh',
  'quay phim': 'chup anh',
  makeup: 'trang diem',
  'make up': 'trang diem',
  'trang diem': 'trang diem',
  'nha hang': 'trung tam to chuc su kien',
  'trung tam tiec cuoi': 'trung tam to chuc su kien',
  'trung tam to chuc su kien': 'trung tam to chuc su kien',
  'sanh cuoi': 'trung tam to chuc su kien',
  'sanh tiec': 'trung tam to chuc su kien',
  decor: 'trang tri',
  'trang tri': 'trang tri',
  'hoa cuoi': 'hoa cuoi',
  'hoa cam tay': 'hoa cuoi',
  'vay cuoi': 'trang phuc',
  'ao cuoi': 'trang phuc',
  'trang phuc': 'trang phuc',
  vest: 'trang phuc',
}
const SYNONYM_PHRASES = Object.keys(CATEGORY_SYNONYMS).sort((a, b) => b.length - a.length)
const STOP_WORDS = ['o', 'tai', 'cho', 'va', 'cua', 'voi', 'la', 'cac', 'nhung', 'mot', 'can', 'muon', 'tim']
const GENERIC_WORDS = ['dep', 'xinh', 'tot', 'hay', 'sang', 'chat luong', 'uy tin', 'ung y', 'dep nhat', 'tot nhat']

/** Lấy các cụm có trong câu (khớp nguyên từ), bỏ chúng khỏi câu */
function takePhrases(work: string, phrases: readonly string[]) {
  const found: string[] = []
  for (const p of phrases) {
    while (work.includes(` ${p} `)) {
      found.push(p)
      work = work.replace(` ${p} `, ' ')
    }
  }
  return { work, found }
}

/**
 * Tách "tháng N" khỏi từ khóa (tìm theo tháng của hạn, mọi năm); nhận cụm hạng mục (đổi về tên hạng mục chuẩn);
 * phần còn lại là các từ, đã bỏ từ nối / từ chung chung (trừ khi câu chỉ có những từ đó).
 */
function parseQuery(q: string) {
  let month: number | null = null
  const rest = foldText(q).replace(/thang\s*(\d{1,2})\b/, (_, m: string) => {
    month = Number(m)
    return ' '
  })
  const cat = takePhrases(
    ` ${rest
      .split(/[^a-z0-9/]+/)
      .filter(Boolean)
      .join(' ')} `,
    SYNONYM_PHRASES,
  )
  const generic = takePhrases(cat.work, GENERIC_WORDS)
  const all = generic.work.split(' ').filter(Boolean)
  const terms = all.filter((w) => !STOP_WORDS.includes(w))
  const categories = [...new Set(cat.found.map((p) => CATEGORY_SYNONYMS[p]))]
  return { month, categories, terms: terms.length || categories.length ? terms : all }
}

/** Mọi cụm gõ được hiểu là hạng mục chuẩn `canonical` (gồm chính nó) */
const phrasesOf = (canonical: string) => [canonical, ...SYNONYM_PHRASES.filter((p) => CATEGORY_SYNONYMS[p] === canonical)]

/**
 * Mỗi từ khóa phải là ĐẦU của một từ trong việc (không khớp giữa chữ: "hang" không khớp "thang"); đủ mọi từ, thứ tự tùy ý.
 * Cụm hạng mục khớp việc thuộc hạng mục đó hoặc có cụm cùng nghĩa trong chữ ("chụp hình" khớp "Chụp ảnh cưới", "quay phim").
 * "tháng 12" khớp việc có hạn trong tháng 12; "12/11" khớp ngày hạn 12/11.
 */
export function matchesQuery(i: TimelineItem, q: string): boolean {
  const { month, categories, terms } = parseQuery(q)
  if (month !== null && (!i.dueDate || Number(i.dueDate.slice(5, 7)) !== month)) return false
  if (!terms.length && !categories.length) return true
  const words = wordsOf(i)
  const text = ` ${words.join(' ')} `
  const categoryName = i.category
    ? foldText(i.category.name)
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
    : ''
  const inCategory = (c: string) => categoryName === c || phrasesOf(c).some((p) => text.includes(` ${p} `))
  return categories.every(inCategory) && terms.every((t) => words.some((w) => w.startsWith(t)))
}

/**
 * "Việc của tôi" = việc khung + việc tự thêm + việc chi tiết của đơn đang Waiting (chờ khách). "Việc do NCC làm" = việc chi tiết còn lại
 * (NCC đang làm hoặc đã xong). Việc chi tiết của đơn do NCC quản lý, khách chỉ xem, nên chỉ việc đang chờ khách mới tính là của khách.
 */
export function matchesOwner(i: TimelineItem, owner: OwnerFilter): boolean {
  if (owner === 'all') return true
  const vendorSide = i.kind === 'SERVICE_TASK' && i.status !== 'Waiting'
  return owner === 'vendor' ? vendorSide : !vendorSide
}

/** Câu nhắn soạn sẵn gửi NCC cho một việc chi tiết: việc chờ khách thì gửi thông tin, việc cùng NCC thì hỏi lịch. */
export function chatDraft(i: Pick<TimelineItem, 'title' | 'orderCode' | 'status'>): string {
  const ref = `"${i.title.split(/:| \(/)[0].trim()}"${i.orderCode ? ` của đơn ${i.orderCode}` : ''}`
  return i.status === 'Waiting'
    ? `Chào shop, mình gửi bạn thông tin cho việc ${ref} nhé, bạn xem giúp mình ạ.`
    : `Chào shop, mình muốn hẹn lịch cho việc ${ref}, bên mình tiện ngày nào ạ?`
}

/** Câu nhắn soạn sẵn khi khách muốn thêm / bỏ bước trong quy trình của một đơn. */
export const processChangeDraft = (orderCode: string | null) =>
  `Chào shop, mình muốn trao đổi về các bước trong quy trình${orderCode ? ` của đơn ${orderCode}` : ''}: mình muốn thêm hoặc bỏ bước ... bạn xem giúp mình ạ.`

export const isOverdue = (i: TimelineItem, today: string) => !i.isDone && !!i.dueDate && i.dueDate < today

/** Nhắc "sắp đến hạn" khi còn từng này ngày (gồm đúng hôm nay); cùng giá trị với backend (task-owner.ts DUE_SOON_DAYS). */
export const DUE_SOON_DAYS = 2
const dayOf = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000)
/** Chưa xong và hạn từ hôm nay đến hôm nay + DUE_SOON_DAYS. */
export const isDueSoon = (i: TimelineItem, today: string) => !i.isDone && !!i.dueDate && i.dueDate >= today && dayOf(i.dueDate) - dayOf(today) <= DUE_SOON_DAYS

export function matchesMonth(i: TimelineItem, month: string, today: string): boolean {
  if (!month) return true
  if (month === 'overdue') return isOverdue(i, today)
  if (month === 'soon') return isDueSoon(i, today)
  return !!i.dueDate && i.dueDate.slice(0, 7) === month
}

/** Áp từ khóa, chủ việc và tháng. */
export function filterTimeline(items: readonly TimelineItem[], f: TimelineFilters, today: string): TimelineItem[] {
  return items.filter((i) => matchesQuery(i, f.q) && matchesOwner(i, f.owner) && matchesMonth(i, f.month, today))
}

export interface MonthOption {
  /** 'overdue' hoặc 'YYYY-MM' */
  value: string
  label: string
  count: number
}

/**
 * Các lựa chọn tháng kèm số việc: "Quá hạn" và "Sắp đến hạn" trước (nếu có), rồi các tháng có việc theo thứ tự thời gian.
 * `items` nên là danh sách đã qua các bộ lọc khác (trừ tháng) để số đếm khớp những gì sẽ thấy.
 */
export function monthOptions(items: readonly TimelineItem[], today: string): MonthOption[] {
  const months = new Map<string, number>()
  let overdue = 0
  let soon = 0
  for (const i of items) {
    if (!i.dueDate) continue
    if (isOverdue(i, today)) overdue++
    if (isDueSoon(i, today)) soon++
    const m = i.dueDate.slice(0, 7)
    months.set(m, (months.get(m) ?? 0) + 1)
  }
  const out: MonthOption[] = []
  if (overdue) out.push({ value: 'overdue', label: 'Quá hạn', count: overdue })
  if (soon) out.push({ value: 'soon', label: 'Sắp đến hạn', count: soon })
  for (const [m, count] of [...months].sort(([a], [b]) => a.localeCompare(b)))
    out.push({ value: m, label: `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`, count })
  return out
}
