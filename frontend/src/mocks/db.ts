import { ApiError } from '@/api/client'
import { addDays, toISODate, today } from '@/lib/date'
import { authStore } from '@/store/auth'
import type { Message } from '@/types/chat'
import type { Order } from '@/types/order'
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
  const msg = (id: string, sender: Message['sender'], text: string, minAgo: number, type: Message['type'] = 'TEXT', orderId: string | null = null): Message => ({
    id, conversationId: 'cv-1', sender, type, text, orderId, createdAt: at(minAgo),
  })
  return {
    ...empty(),
    planItems: [{ id: 'pi-1', serviceId: 'sv-11', status: 'AWAITING_DEPOSIT' }],
    conversations: [{ id: 'cv-1', serviceId: 'sv-11' }],
    orders: [
      {
        id: 'od-1', code: '#001', planItemId: 'pi-1', serviceId: 'sv-11', conversationId: 'cv-1',
        packageName: 'Gói ngoại cảnh 1 ngày', serviceDate: toISODate(addDays(today(), 90)),
        totalAmount: 14_000_000, depositAmount: 1_400_000, status: 'SENT', revisionNote: null, paidAt: null,
      },
    ],
    messages: [
      msg('m-1', 'VENDOR', 'Chào bạn! Mình là Lumi Wedding Studio. Bạn cần tư vấn gói nào cho chụp ảnh?', 60 * 26),
      msg('m-2', 'COUPLE', 'Mình muốn gói ngoại cảnh 1 ngày, bên bạn còn lịch không?', 60 * 25),
      msg('m-3', 'VENDOR', 'Còn lịch bạn nhé. Mình gửi đơn để bạn xác nhận.', 60 * 25 - 5),
      msg('m-4', 'VENDOR', 'Nhà cung cấp đã gửi đơn dịch vụ', 60 * 25 - 6, 'ORDER', 'od-1'),
      msg('m-5', 'SYSTEM', 'Nhà cung cấp đã gửi đơn dịch vụ. Bạn xem lại và thanh toán cọc.', 60 * 25 - 6),
    ],
    seq: 100,
  }
}

function loadAll(): Record<string, UserData> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, UserData>
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
