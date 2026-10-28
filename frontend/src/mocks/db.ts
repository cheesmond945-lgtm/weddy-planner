import { ApiError } from '@/api/client'
import { addDays, toISODate, today } from '@/lib/date'
import { depositOf } from '@/lib/deposit'
import { authStore } from '@/store/auth'
import type { Message } from '@/types/chat'
import type { Order, OrderStatus } from '@/types/order'
import type { PlanItemStatus, Wedding } from '@/types/wedding'

/*
 * "Cơ sở dữ liệu" giả cho phần lập kế hoạch: đám cưới, timeline, kế hoạch, hội thoại, đơn.
 * Lưu theo từng người dùng trong localStorage. Các mốc thời gian lưu dạng tỷ lệ f (0..1) trên
 * khoảng [ngày bắt đầu lập kế hoạch, ngày cưới] như prototype, nên đổi ngày cưới thì mốc tự tính lại.
 */

export interface StoredWedding extends Wedding {
  /** Ngày bắt đầu lập kế hoạch (ngày tạo), mốc 0 của timeline */
  startDate: string
}

export interface StoredTask {
  id: number
  title: string
  f: number
  done: boolean
  custom: boolean
}

export interface StoredPlanItem {
  id: string
  serviceId: string
  status: PlanItemStatus
}

export interface StoredConversation {
  id: string
  serviceId: string
}

export interface UserData {
  wedding: StoredWedding | null
  tasks: StoredTask[]
  nextTaskId: number
  /** Hạn "Chốt <hạng mục>" đã sửa, theo slug */
  categoryDue: Record<string, number>
  planItems: StoredPlanItem[]
  /** Việc chi tiết của dịch vụ đã cọc, khóa "<planItemId>:<thứ tự>" */
  serviceTasks: Record<string, { f: number; done: boolean }>
  conversations: StoredConversation[]
  messages: Message[]
  orders: Order[]
  seq: number
}

const STORAGE_KEY = 'weddy.mock.planning'

const empty = (): UserData => ({
  wedding: null,
  tasks: [],
  nextTaskId: 1,
  categoryDue: {},
  planItems: [],
  serviceTasks: {},
  conversations: [],
  messages: [],
  orders: [],
  seq: 1,
})

/** Dữ liệu mẫu cho tài khoản cặp đôi: đang trao đổi với Lumi Wedding Studio, NCC đã gửi đơn chờ cọc. */
function seedCouple(): UserData {
  const now = Date.now()
  const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString()
  const msg = (id: string, sender: Message['sender'], content: string, minAgo: number, type: Message['type'] = 'Text', orderId: string | null = null): Message => ({
    id, conversationId: 'cv-1', sender, type, content, orderId, isRead: true, sentDate: at(minAgo),
  })
  return {
    ...empty(),
    planItems: [{ id: 'pi-1', serviceId: 'sv-11', status: 'AWAITING_DEPOSIT' }],
    conversations: [{ id: 'cv-1', serviceId: 'sv-11' }],
    orders: [
      mockOrder({
        id: 'od-1', orderCode: 'DH26100001', conversationId: 'cv-1', serviceId: 'sv-11', vendorName: 'Lumi Wedding Studio', status: 'Pending',
        eventDate: toISODate(addDays(today(), 90)), depositPercent: 10, depositDueDate: new Date(now + 23 * 3_600_000).toISOString(),
        items: [{ itemName: 'Gói ngoại cảnh 1 ngày', unit: 'Gói', quantity: 1, unitPrice: 14_000_000 }],
      }),
    ],
    messages: [
      msg('m-1', 'VENDOR', 'Chào bạn! Mình là Lumi Wedding Studio. Bạn cần tư vấn gói nào cho chụp ảnh?', 60 * 26),
      msg('m-2', 'COUPLE', 'Mình muốn gói ngoại cảnh 1 ngày, bên bạn còn lịch không?', 60 * 25),
      msg('m-3', 'VENDOR', 'Còn lịch bạn nhé. Mình gửi đơn để bạn xác nhận.', 60 * 25 - 5),
      msg('m-4', 'VENDOR', 'Nhà cung cấp đã gửi đơn dịch vụ', 60 * 25 - 6, 'Order', 'od-1'),
      msg('m-5', 'SYSTEM', 'Nhà cung cấp đã gửi đơn dịch vụ. Bạn xem lại và thanh toán cọc.', 60 * 25 - 6),
    ],
    seq: 100,
  }
}

/** Dựng một đơn giả theo DTO chung (types/vendorOrder.ts): tiền cọc tính như backend (làm tròn 100.000đ, tối thiểu 100.000đ). */
export function mockOrder(p: {
  id: string
  orderCode: string
  conversationId: string
  serviceId: string
  vendorName: string
  status: OrderStatus
  eventDate: string
  items: { itemName: string; unit?: 'Gói' | 'Bàn'; quantity?: number; unitPrice: number }[]
  depositPercent?: number
  depositDueDate?: string | null
}): Order {
  const items = p.items.map((i, k) => {
    const quantity = i.quantity ?? 1
    return { id: `${p.id}-i${k}`, itemName: i.itemName, unit: i.unit ?? 'Gói', quantity, unitPrice: i.unitPrice, amount: quantity * i.unitPrice }
  })
  const totalAmount = items.reduce((s, i) => s + i.amount, 0)
  const depositPercent = p.depositPercent ?? 30
  return {
    id: p.id,
    orderCode: p.orderCode,
    conversationId: p.conversationId,
    serviceId: p.serviceId,
    vendorName: p.vendorName,
    status: p.status,
    customerName: 'Khách hàng',
    customerPhone: '',
    eventDate: p.eventDate,
    items,
    totalAmount,
    depositPercent,
    depositAmount: depositOf(totalAmount, depositPercent),
    depositDueDate: p.depositDueDate ?? null,
    note: null,
    payment: { status: 'Unpaid', paidDate: null, transactionCode: null },
    revisions: [],
    invoices: [],
    completedDate: null,
    cancelledDate: null,
    cancelReason: null,
    createdDate: new Date().toISOString(),
  }
}

/** Đơn lưu từ bản cũ (code, planItemId, SENT/REVISION_REQUESTED/PAID/CANCELLED...) đổi sang DTO chung; không đổi được thì bỏ. */
function migrateOrders(all: Record<string, UserData>) {
  const status: Record<string, OrderStatus> = { SENT: 'Pending', REVISION_REQUESTED: 'NeedRevision', PAID: 'Deposited', CANCELLED: 'Cancelled' }
  for (const data of Object.values(all)) {
    data.orders = (data.orders ?? []).flatMap((o) => {
      const old = o as unknown as { code?: string; orderCode?: string; status: string; serviceId: string; conversationId: string; serviceDate?: string; packageName?: string; totalAmount: number; depositAmount: number; revisionNote?: string | null; paidAt?: string | null }
      if (old.orderCode !== undefined || old.code === undefined) return [o]
      const st = status[old.status]
      if (!st) return []
      const percent = Math.min(99, Math.max(1, Math.round((old.depositAmount / (old.totalAmount || 1)) * 100)))
      const next = mockOrder({
        id: o.id, orderCode: old.code.replace('#', 'DH2610'), conversationId: old.conversationId, serviceId: old.serviceId, vendorName: '', status: st,
        eventDate: old.serviceDate ?? toISODate(addDays(today(), 60)), depositPercent: percent,
        depositDueDate: st === 'Pending' ? new Date(Date.now() + 24 * 3_600_000).toISOString() : null,
        items: [{ itemName: old.packageName ?? 'Dịch vụ', unit: 'Gói', quantity: 1, unitPrice: old.totalAmount }],
      })
      next.vendorName = undefined
      next.depositAmount = old.depositAmount
      if (st === 'Deposited') {
        const at = old.paidAt ?? new Date().toISOString()
        next.payment = { status: 'Paid', paidDate: at, transactionCode: '00000000' }
        next.invoices = [{ id: `${o.id}-iv`, invoiceCode: `XNC${old.code.replace('#', '')}`, type: 'DepositReceipt', createdDate: at }]
      }
      if (st === 'NeedRevision') {
        next.revisions = [{ id: `${o.id}-rv`, revisionType: 'BeforeDeposit', requestNote: old.revisionNote ?? null, changes: [], oldTotalAmount: old.totalAmount, newTotalAmount: null, status: 'Requested', createdDate: new Date().toISOString(), appliedDate: null }]
      }
      return [next]
    })
  }
  return all
}

/** Tin nhắn lưu từ bản cũ (text, createdAt, TEXT/ORDER) đổi sang dạng chung (content, sentDate, Text/Order). */
function migrateMessages(all: Record<string, UserData>) {
  for (const data of Object.values(all)) {
    data.messages = (data.messages ?? []).map((m) => {
      const old = m as unknown as { text?: string; createdAt?: string; type: string }
      if (old.text === undefined && old.createdAt === undefined) return m
      const { text, createdAt, ...rest } = old as typeof old & Record<string, unknown>
      return { ...rest, type: old.type === 'ORDER' ? 'Order' : 'Text', content: text ?? '', isRead: true, sentDate: createdAt ?? new Date().toISOString() } as Message
    })
  }
  return all
}

function loadAll(): Record<string, UserData> {
  try {
    return migrateOrders(migrateMessages(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, UserData>))
  } catch {
    return {}
  }
}

/** Người dùng hiện tại (đọc token như BE đọc JWT). */
export function currentUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  if (user.role !== 'COUPLE') throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.')
  return user.id
}

/** Đọc dữ liệu của người dùng hiện tại. */
export function read(): UserData {
  const userId = currentUserId()
  const all = loadAll()
  return all[userId] ?? (userId === 'u-couple-1' ? seedCouple() : empty())
}

/** Sửa dữ liệu của người dùng hiện tại rồi lưu lại. */
export function write<T>(fn: (data: UserData) => T, userId = currentUserId()): T {
  const all = loadAll()
  const data = all[userId] ?? (userId === 'u-couple-1' ? seedCouple() : empty())
  const result = fn(data)
  all[userId] = data
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // bỏ qua
  }
  return result
}

export const nextId = (data: UserData, prefix: string) => `${prefix}-${data.seq++}`
