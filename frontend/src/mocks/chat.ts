import { ApiError } from '@/api/client'
import { addDays, toISODate, today } from '@/lib/date'
import type { Conversation, Message } from '@/types/chat'
import type { Order, PaymentCreated, PaymentMethod } from '@/types/order'
import { mockCatalog } from './catalog'
import { currentUserId, nextId, read, write, type UserData } from './db'
import { addToPlan, openServiceTasks } from './planning'

/*
 * Hội thoại, đơn dịch vụ và đặt cọc giả.
 * "NCC giả" (chỉ có trong mock, không có nút nào trên giao diện):
 * - trả lời tự động theo câu mẫu của prototype;
 * - tự gửi đơn khi cặp đôi nhắn có "gửi đơn" / "chốt";
 * - tự gửi lại đơn sau khi cặp đôi yêu cầu chỉnh sửa.
 */

const fm = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`
const now = () => new Date().toISOString()

function pushMessage(data: UserData, conversationId: string, m: Pick<Message, 'sender' | 'type' | 'content'> & { orderId?: string | null }) {
  const msg: Message = { id: nextId(data, 'm'), conversationId, orderId: null, isRead: true, sentDate: now(), ...m }
  data.messages.push(msg)
  return msg
}

function findConversation(data: UserData, id: string) {
  const c = data.conversations.find((x) => x.id === id)
  if (!c) throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy hội thoại.')
  return c
}

function toConversation(data: UserData, c: UserData['conversations'][number]): Conversation {
  const last = data.messages.filter((m) => m.conversationId === c.id).at(-1)
  return {
    id: c.id,
    service: mockCatalog.getSummary(c.serviceId),
    planStatus: data.planItems.find((p) => p.serviceId === c.serviceId)?.status ?? null,
    // Dữ liệu giả không theo dõi đã đọc: NCC giả trả lời ngay khi khách đang mở khung chat
    unreadCount: 0,
    lastMessage: last ? { sender: last.sender, type: last.type, content: last.content, sentDate: last.sentDate } : null,
  }
}

/** Câu trả lời mẫu (sendMsg trong prototype). */
function cannedReply(text: string, serviceId: string) {
  const l = text.toLowerCase()
  if (/giá|bao nhiêu|chi phí/.test(l)) return `Giá gói cơ bản bên mình từ ${fm(mockCatalog.getService(serviceId).priceFrom)}. Bạn cho mình biết ngân sách để tư vấn gói phù hợp nhé.`
  if (/lịch|ngày|trống/.test(l)) return 'Bạn gửi giúp mình ngày tổ chức, bên mình kiểm tra lịch và phản hồi ngay.'
  if (/cọc|thanh toán/.test(l)) return 'Khi hai bên thống nhất, bên mình sẽ gửi đơn dịch vụ ngay trong khung chat để bạn xác nhận và đặt cọc 10% giá trị gói.'
  return 'Cảm ơn bạn! Bên mình sẽ gửi thông tin chi tiết và xác nhận lại với bạn trong ít phút.'
}

/** NCC giả gửi đơn (hoặc gửi lại đơn đã sửa) — commitOrder trong prototype. */
function vendorSendOrder(data: UserData, conversationId: string) {
  const c = findConversation(data, conversationId)
  const plan = data.planItems.find((p) => p.serviceId === c.serviceId)
  if (!plan || plan.status === 'CONFIRMED') return
  const existing = data.orders.find((o) => o.planItemId === plan.id && o.status !== 'PAID')
  if (existing) {
    Object.assign(existing, { status: 'SENT', revisionNote: null })
    pushMessage(data, c.id, { sender: 'SYSTEM', type: 'Text', content: 'Nhà cung cấp đã cập nhật đơn dịch vụ. Bạn xem lại và thanh toán cọc.' })
  } else {
    const pkg = mockCatalog.getService(c.serviceId).packages[0]
    const order: Order = {
      id: nextId(data, 'od'),
      code: `#${String(data.orders.length + 1).padStart(3, '0')}`,
      planItemId: plan.id, serviceId: c.serviceId, conversationId: c.id,
      packageName: pkg.name,
      serviceDate: data.wedding?.date ?? toISODate(addDays(today(), 60)),
      totalAmount: pkg.price,
      depositAmount: Math.round((pkg.price * 0.1) / 1e5) * 1e5,
      status: 'SENT', revisionNote: null, paidAt: null,
    }
    data.orders.push(order)
    pushMessage(data, c.id, { sender: 'VENDOR', type: 'Order', content: 'Nhà cung cấp đã gửi đơn dịch vụ', orderId: order.id })
    pushMessage(data, c.id, { sender: 'SYSTEM', type: 'Text', content: 'Nhà cung cấp đã gửi đơn dịch vụ. Bạn xem lại và thanh toán cọc.' })
  }
  plan.status = 'AWAITING_DEPOSIT'
}

function findOrder(data: UserData, id: string) {
  const o = data.orders.find((x) => x.id === id)
  if (!o) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn dịch vụ.')
  return o
}

export const mockChat = {
  listConversations: (): Conversation[] => {
    const data = read()
    return data.conversations
      .map((c) => toConversation(data, c))
      .sort((a, b) => (b.lastMessage?.sentDate ?? '').localeCompare(a.lastMessage?.sentDate ?? ''))
  },

  /** Bắt đầu (hoặc mở lại) hội thoại với NCC của dịch vụ: tự thêm vào kế hoạch, chuyển sang Đang trao đổi (openChat trong prototype). */
  startConversation: (serviceId: string, replace: boolean): Conversation =>
    write((data) => {
      const service = mockCatalog.getService(serviceId)
      let plan = data.planItems.find((p) => p.serviceId === serviceId)
      if (!plan) plan = addToPlan(data, serviceId, replace)
      if (plan.status === 'PLANNED') plan.status = 'DISCUSSING'
      let c = data.conversations.find((x) => x.serviceId === serviceId)
      if (!c) {
        c = { id: nextId(data, 'cv'), serviceId }
        data.conversations.push(c)
        pushMessage(data, c.id, { sender: 'VENDOR', type: 'Text', content: `Chào bạn! Mình là ${service.name}. Bạn cần tư vấn gói nào cho ${service.category.name.toLowerCase()}?` })
      }
      return toConversation(data, c)
    }),

  listMessages: (conversationId: string): Message[] => {
    const data = read()
    findConversation(data, conversationId)
    return data.messages.filter((m) => m.conversationId === conversationId)
  },

  sendMessage: (conversationId: string, text: string): Message => {
    const userId = currentUserId()
    const msg = write((data) => {
      findConversation(data, conversationId)
      if (!text.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Tin nhắn không được để trống.')
      return pushMessage(data, conversationId, { sender: 'COUPLE', type: 'Text', content: text.trim() })
    })
    // NCC giả trả lời sau 0,9 giây
    setTimeout(() => {
      write((data) => {
        const c = data.conversations.find((x) => x.id === conversationId)
        if (!c) return
        if (/gửi đơn|chốt/i.test(text)) vendorSendOrder(data, conversationId)
        else pushMessage(data, conversationId, { sender: 'VENDOR', type: 'Text', content: cannedReply(text, c.serviceId) })
      }, userId)
    }, 900)
    return msg
  },

  markRead: (conversationId: string): null => {
    findConversation(read(), conversationId)
    return null
  },

  getOrder: (id: string): Order => findOrder(read(), id),

  requestRevision: (orderId: string, note: string): Order => {
    const userId = currentUserId()
    const order = write((data) => {
      const o = findOrder(data, orderId)
      if (o.status !== 'SENT') throw new ApiError(409, 'ORDER_NOT_REVISABLE', 'Đơn này không yêu cầu chỉnh sửa được.')
      if (!note.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng ghi rõ nội dung cần chỉnh sửa để nhà cung cấp biết.')
      Object.assign(o, { status: 'REVISION_REQUESTED', revisionNote: note.trim() })
      const plan = data.planItems.find((p) => p.id === o.planItemId)
      if (plan) plan.status = 'DISCUSSING'
      pushMessage(data, o.conversationId, { sender: 'COUPLE', type: 'Text', content: `Yêu cầu chỉnh sửa đơn ${o.code}:\n${note.trim()}` })
      pushMessage(data, o.conversationId, { sender: 'SYSTEM', type: 'Text', content: 'Đã gửi yêu cầu chỉnh sửa cho nhà cung cấp. Nhà cung cấp sẽ gửi lại đơn đã cập nhật.' })
      return { ...o }
    })
    // NCC giả gửi lại đơn sau 2 giây
    setTimeout(() => write((data) => vendorSendOrder(data, order.conversationId), userId), 2000)
    return order
  },

  /** Tạo thanh toán cọc. Bản giả ghi nhận thanh toán thành công luôn và trả địa chỉ quay về trang kết quả. */
  createPayment: (orderId: string, _method: PaymentMethod): PaymentCreated =>
    write((data) => {
      const o = findOrder(data, orderId)
      if (o.status !== 'SENT') throw new ApiError(409, 'ORDER_NOT_PAYABLE', 'Chưa có đơn dịch vụ cần thanh toán.')
      Object.assign(o, { status: 'PAID', paidAt: now() })
      const plan = data.planItems.find((p) => p.id === o.planItemId)!
      plan.status = 'CONFIRMED'
      openServiceTasks(data, plan.id)
      pushMessage(data, o.conversationId, { sender: 'SYSTEM', type: 'Text', content: `Đã ghi nhận đặt cọc ${fm(o.depositAmount)}. Dịch vụ được chốt.` })
      return { paymentId: nextId(data, 'pay'), paymentUrl: `/plan/deal/${o.id}?vnp_ResponseCode=00` }
    }),
}
