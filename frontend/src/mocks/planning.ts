import { ApiError } from '@/api/client'
import { addDays, daysBetween, parseDate, toISODate, today } from '@/lib/date'
import type { CategoryRef } from '@/types/catalog'
import type { AiSuggestionResult, PlanItem, Timeline, TimelineItem, TimelineItemPatch, Wedding, WeddingInput } from '@/types/wedding'
import { mockCatalog } from './catalog'
import { readMockGoogleRating } from './googleRating'
import { nextId, read, write, type StoredWedding, type UserData } from './db'

/* Quy tắc lập kế hoạch giả, chép từ prototype (CATS.share/dead, DT, allRows, aiPick, addPlan). */

interface CategoryRule {
  /** Tỷ lệ ngân sách gợi ý cho hạng mục */
  share: number
  /** Hạn "Chốt <hạng mục>" mặc định, tỷ lệ trên thời gian chuẩn bị */
  deadline: number
  /** Việc chi tiết mở ra sau khi đặt cọc: [tên, tỷ lệ] */
  tasks: [string, number][]
}

export const CATEGORY_RULES: Record<string, CategoryRule> = {
  'nha-hang': { share: 0.22, deadline: 0.22, tasks: [['Xác nhận số bàn và thực đơn', 0.4], ['Chọn bàn tiệc và sơ đồ chỗ ngồi', 0.7], ['Chạy thử thực đơn', 0.8], ['Chốt số khách lần cuối', 0.93]] },
  decor: { share: 0.14, deadline: 0.38, tasks: [['Chọn concept và bảng màu', 0.42], ['Duyệt bản phối cảnh', 0.65], ['Xác nhận vật tư và giờ dựng sảnh', 0.9]] },
  'trang-phuc': { share: 0.1, deadline: 0.3, tasks: [['Đo số đo và chọn mẫu', 0.36], ['Thử đồ lần 1', 0.55], ['Chỉnh sửa và thử đồ lần cuối', 0.8], ['Nhận trang phục', 0.93]] },
  makeup: { share: 0.08, deadline: 0.45, tasks: [['Chọn phong cách trang điểm', 0.48], ['Makeup thử', 0.75], ['Chốt lịch và giờ trang điểm', 0.92]] },
  'chup-anh': { share: 0.12, deadline: 0.32, tasks: [['Chọn concept và địa điểm chụp', 0.38], ['Thử trang phục chụp ảnh', 0.52], ['Chụp ngoại cảnh', 0.62], ['Chọn ảnh và duyệt album', 0.85]] },
  'co-cuoi': { share: 0.14, deadline: 0.22, tasks: [['Chốt thực đơn và số lượng bàn', 0.4], ['Xác nhận giờ giao và phục vụ', 0.85]] },
  'hoa-cuoi': { share: 0.12, deadline: 0.38, tasks: [['Chọn loại hoa và bảng màu', 0.42], ['Duyệt mẫu hoa cưới', 0.65], ['Xác nhận thời gian giao hoa', 0.9]] },
}

const STYLES = ['Hiện đại', 'Tối giản', 'Cổ điển', 'Sang trọng', 'Sân vườn', 'Truyền thống']

const DEFAULT_TASKS: [string, number, boolean][] = [
  ['Xác định ngân sách và quy mô tiệc', 0.05, true],
  ['Lập danh sách khách mời sơ bộ', 0.15, false],
  ['Thiết kế và gửi thiệp mời', 0.72, false],
  ['Xác nhận lần cuối với các nhà cung cấp', 0.94, false],
]

// ---- Tính ngày từ tỷ lệ ----

const span = (w: StoredWedding) => Math.max(1, daysBetween(parseDate(w.startDate), parseDate(w.date)))
const dateAt = (w: StoredWedding, f: number) => toISODate(addDays(parseDate(w.startDate), Math.round(f * span(w))))
const fractionOf = (w: StoredWedding, date: string) => daysBetween(parseDate(w.startDate), parseDate(date)) / span(w)

/** Giữ mốc trong khoảng [hôm nay + 2 ngày, trước ngày cưới] (fFor trong prototype). */
function clampFraction(w: StoredWedding, f: number) {
  const s = span(w)
  const min = (daysBetween(parseDate(w.startDate), today()) + 2) / s
  const max = Math.max(0, (s - 1) / s)
  return Math.min(Math.max(f, min), max)
}

function requireWedding(data: UserData) {
  if (!data.wedding) throw new ApiError(409, 'WEDDING_NOT_SET', 'Hãy thiết lập thông tin đám cưới trước.')
  return data.wedding
}

function checkDueDate(w: StoredWedding, date: string) {
  const min = toISODate(today())
  const max = toISODate(addDays(parseDate(w.date), -1))
  if (date < min || date > max) throw new ApiError(400, 'DUE_DATE_OUT_OF_RANGE', 'Hạn phải từ hôm nay đến trước ngày tổ chức.')
}

const categoryRef = (slug: string): CategoryRef => {
  const c = mockCatalog.listCategories().find((x) => x.slug === slug)!
  return { id: c.id, slug: c.slug, name: c.name }
}

const toWedding = ({ startDate: _s, ...w }: StoredWedding): Wedding => w

// ---- Kế hoạch ----

function toPlanItem(data: UserData, p: UserData['planItems'][number]): PlanItem {
  const detail = mockCatalog.getService(p.serviceId)
  const order = data.orders.filter((o) => o.serviceId === p.serviceId && o.status !== 'Draft').at(-1) ?? null
  return {
    id: p.id,
    service: mockCatalog.getSummary(p.serviceId),
    status: p.status,
    packageName: order?.items[0]?.itemName ?? detail.packages[0].name,
    price: order?.totalAmount ?? detail.packages[0].price,
    order,
  }
}

const slugOfService = (serviceId: string) => mockCatalog.getService(serviceId).category.slug
const LOCKED_STATUSES = ['AWAITING_DEPOSIT', 'CONFIRMED']

/** Hạng mục hiện trên timeline/kế hoạch: hạng mục muốn dùng + hạng mục đã có dịch vụ (slotCats trong prototype). */
function slots(data: UserData) {
  const set = new Set(data.wedding?.categorySlugs ?? [])
  data.planItems.forEach((p) => set.add(slugOfService(p.serviceId)))
  return mockCatalog.listCategories().map((c) => c.slug).filter((s) => set.has(s))
}

function removePlanItem(data: UserData, planItemId: string) {
  const removed = data.planItems.find((p) => p.id === planItemId)
  const conv = data.conversations.filter((c) => removed?.serviceId === c.serviceId)
  data.planItems = data.planItems.filter((p) => p.id !== planItemId)
  // Bỏ dịch vụ khỏi kế hoạch thì bỏ luôn hội thoại (như replacePlan/removePlan trong prototype)
  const convIds = new Set(conv.map((c) => c.id))
  data.conversations = data.conversations.filter((c) => !convIds.has(c.id))
  data.messages = data.messages.filter((m) => !convIds.has(m.conversationId))
  const removedService = removed?.serviceId
  data.orders = data.orders.filter((o) => o.serviceId !== removedService)
}

/** Thêm dịch vụ vào kế hoạch; dùng chung cho POST /plan-items và khi bắt đầu nhắn tin. */
export function addToPlan(data: UserData, serviceId: string, replace: boolean) {
  const service = mockCatalog.getService(serviceId)
  if (data.planItems.some((p) => p.serviceId === serviceId)) {
    throw new ApiError(409, 'PLAN_ITEM_EXISTS', 'Dịch vụ đã có trong kế hoạch.')
  }
  const existing = data.planItems.find((p) => slugOfService(p.serviceId) === service.category.slug)
  if (existing) {
    if (LOCKED_STATUSES.includes(existing.status)) {
      throw new ApiError(409, 'PLAN_CATEGORY_LOCKED', `Hạng mục ${service.category.name.toLowerCase()} đang chốt hoặc đã đặt cọc dịch vụ khác.`)
    }
    if (!replace) {
      throw new ApiError(409, 'PLAN_CATEGORY_TAKEN', `Kế hoạch đã có dịch vụ cho hạng mục ${service.category.name.toLowerCase()}.`, {
        existingItemId: existing.id,
        existingServiceName: mockCatalog.getService(existing.serviceId).name,
      })
    }
    removePlanItem(data, existing.id)
  }
  const item = { id: nextId(data, 'pi'), serviceId, status: 'PLANNED' as const }
  data.planItems.push(item)
  return item
}

// ---- Timeline ----

function buildTimeline(data: UserData): Timeline {
  const w = requireWedding(data)
  type Row = TimelineItem & { f: number }
  const rows: Row[] = []
  const base = { isCustom: false, category: null, serviceName: null, planStatus: null, serviceId: null }

  for (const t of data.tasks) {
    rows.push({ ...base, id: `task-${t.id}`, kind: 'TASK', title: t.title, f: t.f, dueDate: dateAt(w, t.f), isDone: t.done, isCustom: t.custom })
  }
  for (const slug of slots(data)) {
    const cat = categoryRef(slug)
    const plan = data.planItems.find((p) => slugOfService(p.serviceId) === slug)
    const deposited = plan?.status === 'CONFIRMED' ? plan : undefined
    const f = data.categoryDue[slug] ?? CATEGORY_RULES[slug].deadline
    rows.push({
      ...base, id: `deadline-${slug}`, kind: 'CATEGORY_DEADLINE', title: `Chốt ${cat.name.toLowerCase()}`, f, dueDate: dateAt(w, f),
      isDone: !!deposited, category: cat,
      serviceName: plan ? mockCatalog.getService(plan.serviceId).name : null, planStatus: plan?.status ?? null, serviceId: plan?.serviceId ?? null,
    })
    if (deposited) {
      const order = data.orders.find((o) => o.serviceId === deposited.serviceId && (o.status === 'Deposited' || o.status === 'Completed'))
      if (order && order.eventDate !== w.date) {
        rows.push({ ...base, id: `service-date-${deposited.id}`, kind: 'SERVICE_DATE', title: `Ngày thực hiện ${cat.name.toLowerCase()}`, f: fractionOf(w, order.eventDate), dueDate: order.eventDate, isDone: false, category: cat })
      }
      const serviceName = mockCatalog.getService(deposited.serviceId).name
      CATEGORY_RULES[slug].tasks.forEach(([title], i) => {
        const t = data.serviceTasks[`${deposited.id}:${i}`]
        if (t) rows.push({ ...base, id: `service-task-${deposited.id}-${i}`, kind: 'SERVICE_TASK', title, f: t.f, dueDate: dateAt(w, t.f), isDone: t.done, category: cat, serviceName })
      })
    } else {
      rows.push({ ...base, id: `locked-${slug}`, kind: 'LOCKED', title: `Việc chi tiết của ${cat.name.toLowerCase()}`, f: 0.7, dueDate: null, isDone: false, category: cat })
    }
  }
  rows.sort((a, b) => a.f - b.f)
  return { items: rows.map(({ f: _f, ...r }) => r) }
}

/** Tạo việc chi tiết khi đặt cọc xong (dealPay trong prototype). */
export function openServiceTasks(data: UserData, planItemId: string) {
  const plan = data.planItems.find((p) => p.id === planItemId)!
  const w = data.wedding
  CATEGORY_RULES[slugOfService(plan.serviceId)].tasks.forEach(([, f], i) => {
    data.serviceTasks[`${planItemId}:${i}`] = { done: false, f: w ? clampFraction(w, f) : f }
  })
}

// ---- Gợi ý AI ----

/** Điểm Google như BE gọi Places API (bản giả); thiếu PlaceId thì null. */
const google = (id: string) => {
  try {
    return readMockGoogleRating(id, 'summary')
  } catch {
    return null
  }
}

const formatMillions = (n: number) => `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`

function aiSuggest(data: UserData, slug: string): AiSuggestionResult {
  const w = requireWedding(data)
  const budget = Math.round((w.budget * CATEGORY_RULES[slug].share) / 1e5) * 1e5
  const guestCount = slug === 'nha-hang' ? w.guestCount : null
  const all = mockCatalog.listServices({ category: slug, pageSize: 1000 }).data.map((s) => mockCatalog.getService(s.id))
  const styleHits = (s: (typeof all)[number]) => s.styles.filter((x) => w.styles.includes(x))
  const fits = (s: (typeof all)[number]) => s.priceFrom <= budget && (!guestCount || (s.capacity ?? 0) >= guestCount)
  const picked = all
    .filter((s) => s.location === w.location && fits(s))
    .sort((a, b) => styleHits(b).length - styleHits(a).length || (google(b.id)?.rating ?? 0) - (google(a.id)?.rating ?? 0) || (google(b.id)?.userRatingCount ?? 0) - (google(a.id)?.userRatingCount ?? 0))
    .slice(0, 3)
  const byPrice = (list: typeof all) => [...list].sort((a, b) => a.priceFrom - b.priceFrom)[0]
  const cheapest = byPrice(all.filter((s) => s.location === w.location)) ?? byPrice(all)

  return {
    category: categoryRef(slug),
    budget,
    budgetSource: 'ESTIMATED',
    location: w.location,
    styles: w.styles,
    guestCount,
    suggestions: picked.map((s) => {
      const hits = styleHits(s)
      const reasons = [`Giá từ ${formatMillions(s.priceFrom)}, nằm trong ngân sách hạng mục.`]
      if (hits.length) reasons.push(`Hợp phong cách ${hits.join(', ').toLowerCase()}.`)
      const g = google(s.id)
      if (g?.rating != null) reasons.push(`Điểm ${g.rating.toFixed(1)} trên Google Maps.`)
      if (s.capacity && w.guestCount) reasons.push(`Chứa tối đa ${s.capacity} khách.`)
      return { service: mockCatalog.getSummary(s.id), reasons }
    }),
    cheapest: picked.length || !cheapest ? null : mockCatalog.getSummary(cheapest.id),
  }
}

// ---- API giả ----

export const mockPlanning = {
  styles: () => STYLES,

  getWedding: (): Wedding | null => {
    const w = read().wedding
    return w ? toWedding(w) : null
  },

  saveWedding: (input: WeddingInput): Wedding =>
    write((data) => {
      if (!input.date || parseDate(input.date) <= today()) throw new ApiError(400, 'VALIDATION_ERROR', 'Ngày tổ chức phải sau hôm nay.')
      if (!input.location) throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng chọn địa điểm tổ chức.')
      if (!(input.budget > 0)) throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập tổng ngân sách lớn hơn 0.')
      const first = !data.wedding
      data.wedding = { id: data.wedding?.id ?? nextId(data, 'wd'), ...input, startDate: data.wedding?.startDate ?? toISODate(today()) }
      if (first) {
        data.tasks = DEFAULT_TASKS.map(([title, f, done], i) => ({ id: i + 1, title, f, done, custom: false }))
        data.nextTaskId = DEFAULT_TASKS.length + 1
      }
      return toWedding(data.wedding)
    }),

  getTimeline: (): Timeline => buildTimeline(read()),

  addTask: (input: { title: string; dueDate: string }): Timeline =>
    write((data) => {
      const w = requireWedding(data)
      if (!input.title.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng nhập tên công việc.')
      checkDueDate(w, input.dueDate)
      data.tasks.push({ id: data.nextTaskId++, title: input.title.trim(), f: fractionOf(w, input.dueDate), done: false, custom: true })
      return buildTimeline(data)
    }),

  updateItem: (itemId: string, patch: TimelineItemPatch): Timeline =>
    write((data) => {
      const w = requireWedding(data)
      if (patch.dueDate) checkDueDate(w, patch.dueDate)
      const f = patch.dueDate ? fractionOf(w, patch.dueDate) : undefined
      let m: RegExpMatchArray | null
      if ((m = itemId.match(/^task-(\d+)$/))) {
        const t = data.tasks.find((x) => x.id === Number(m![1]))
        if (!t) throw new ApiError(404, 'TIMELINE_ITEM_NOT_FOUND', 'Không tìm thấy việc.')
        if (patch.title !== undefined) {
          if (!patch.title.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Tên công việc không được để trống.')
          t.title = patch.title.trim()
        }
        if (f !== undefined) t.f = f
        if (patch.isDone !== undefined) t.done = patch.isDone
      } else if ((m = itemId.match(/^deadline-(.+)$/))) {
        if (patch.isDone !== undefined || patch.title !== undefined) throw new ApiError(400, 'TIMELINE_ITEM_READONLY', 'Mốc chốt hạng mục chỉ sửa được hạn.')
        if (f !== undefined) data.categoryDue[m[1]] = f
      } else if ((m = itemId.match(/^service-task-(.+)-(\d+)$/))) {
        const t = data.serviceTasks[`${m[1]}:${m[2]}`]
        if (!t) throw new ApiError(404, 'TIMELINE_ITEM_NOT_FOUND', 'Không tìm thấy việc.')
        if (patch.title !== undefined) throw new ApiError(400, 'TIMELINE_ITEM_READONLY', 'Không đổi được tên việc chi tiết của dịch vụ.')
        if (f !== undefined) t.f = f
        if (patch.isDone !== undefined) t.done = patch.isDone
      } else {
        throw new ApiError(404, 'TIMELINE_ITEM_NOT_FOUND', 'Không tìm thấy việc.')
      }
      return buildTimeline(data)
    }),

  deleteTask: (itemId: string): Timeline =>
    write((data) => {
      const id = Number(itemId.replace(/^task-/, ''))
      const t = data.tasks.find((x) => x.id === id)
      if (!t) throw new ApiError(404, 'TIMELINE_ITEM_NOT_FOUND', 'Không tìm thấy việc.')
      if (!t.custom) throw new ApiError(409, 'TASK_NOT_CUSTOM', 'Chỉ xóa được việc do bạn tự thêm.')
      data.tasks = data.tasks.filter((x) => x.id !== id)
      return buildTimeline(data)
    }),

  listPlanItems: (): { categorySlugs: string[]; items: PlanItem[] } => {
    const data = read()
    return { categorySlugs: slots(data), items: data.planItems.map((p) => toPlanItem(data, p)) }
  },

  addPlanItem: (serviceId: string, replace: boolean): PlanItem =>
    write((data) => toPlanItem(data, addToPlan(data, serviceId, replace))),

  removePlanItem: (planItemId: string) =>
    write((data) => {
      const p = data.planItems.find((x) => x.id === planItemId)
      if (!p) throw new ApiError(404, 'PLAN_ITEM_NOT_FOUND', 'Không tìm thấy dịch vụ trong kế hoạch.')
      if (LOCKED_STATUSES.includes(p.status)) throw new ApiError(409, 'PLAN_ITEM_LOCKED', 'Không bỏ được dịch vụ đang chờ cọc hoặc đã chốt.')
      removePlanItem(data, planItemId)
      return null
    }),

  aiSuggest: (slug: string) => aiSuggest(read(), slug),
}
