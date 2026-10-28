import { ApiError } from '@/api/client'
import { addDays, toISODate, today } from '@/lib/date'
import { CHANGE_LABEL } from '@/features/vendorOrders/constants'
import type { Conversation, Message } from '@/types/chat'
import type { Order, PaymentCreated, PaymentMethod, RevisionChangeType } from '@/types/order'
import { mockCatalog } from './catalog'
import { currentUserId, mockOrder, nextId, read, write, type UserData } from './db'
import { addToPlan, openServiceTasks } from './planning'

/*
 * Hội thoại, đơn dịch vụ và đặt cọc giả (cùng DTO đơn với phía NCC: types/vendorOrder.ts, 7 trạng thái).
 * "NCC giả" (chỉ có trong mock, không có nút nào trên giao diện):
 * - trả lời tự động theo câu mẫu của prototype;
 * - tự gửi đơn khi cặp đôi nhắn có "gửi đơn" / "chốt";
 * - tự gửi lại đơn sau khi cặp đôi yêu cầu chỉnh sửa.
 */

const fm = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`
const now = () => new Date().toISOString()
const HOUR = 3_600_000
const DEPOSIT_HOURS = 24

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

/** Đơn Pending quá hạn cọc thì coi là Expired khi đọc (như job hết hạn của backend). */
const effective = (o: Order): Order => (o.status === 'Pending' && o.depositDueDate && new Date(o.depositDueDate).getTime() < Date.now() ? { ...o, status: 'Expired' } : o)

const ordersOfService = (data: UserData, serviceId: string) => data.orders.filter((o) => o.serviceId === serviceId)

function toConversation(data: UserData, c: UserData['conversations'][number]): Conversation {
  const last = data.messages.filter((m) => m.conversationId === c.id).at(-1)
  const latest = ordersOfService(data, c.serviceId)
    .filter((o) => o.status !== 'Draft')
    .at(-1)
  const lo = latest ? effective(latest) : null
  return {
    id: c.id,
    service: mockCatalog.getSummary(c.serviceId),
    planStatus: data.planItems.find((p) => p.serviceId === c.serviceId)?.status ?? null,
    latestOrder: lo ? { id: lo.id, orderCode: lo.orderCode, status: lo.status, depositDueDate: lo.depositDueDate } : null,
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
  if (/cọc|thanh toán/.test(l)) return 'Khi hai bên thống nhất, bên mình sẽ gửi đơn dịch vụ ngay trong khung chat để bạn xác nhận và đặt cọc.'
  return 'Cảm ơn bạn! Bên mình sẽ gửi thông tin chi tiết và xác nhận lại với bạn trong ít phút.'
}

/** NCC giả gửi đơn (hoặc gửi lại đơn đã sửa) — commitOrder trong prototype. */
function vendorSendOrder(data: UserData, conversationId: string) {
  const c = findConversation(data, conversationId)
  const plan = data.planItems.find((p) => p.serviceId === c.serviceId)
  if (!plan || plan.status === 'CONFIRMED') return
  const vendorName = mockCatalog.getService(c.serviceId).name
  const existing = ordersOfService(data, c.serviceId).find((o) => o.status === 'Pending' || o.status === 'NeedRevision')
  const dueDate = new Date(Date.now() + DEPOSIT_HOURS * HOUR).toISOString()
  if (existing) {
    // Cập nhật đơn: về Pending, hạn cọc đặt lại, yêu cầu của khách thành Applied
    const open = existing.revisions.find((r) => r.status === 'Requested')
    if (open) Object.assign(open, { status: 'Applied', newTotalAmount: existing.totalAmount, appliedDate: now() })
    Object.assign(existing, { status: 'Pending', depositDueDate: dueDate })
    pushMessage(data, c.id, { sender: 'VENDOR', type: 'Order', content: `Đơn dịch vụ ${existing.orderCode} đã được cập nhật.`, orderId: existing.id })
  } else {
    const pkg = mockCatalog.getService(c.serviceId).packages[0]
    const order = mockOrder({
      id: nextId(data, 'od'),
      orderCode: `DH${new Date().toISOString().slice(2, 7).replace('-', '')}${String(data.orders.length + 1).padStart(4, '0')}`,
      conversationId: c.id,
      serviceId: c.serviceId,
      vendorName,
      status: 'Pending',
      eventDate: data.wedding?.date ?? toISODate(addDays(today(), 60)),
      items: [{ itemName: pkg.name, unit: 'Gói', quantity: 1, unitPrice: pkg.price }],
      depositPercent: 30,
      depositDueDate: dueDate,
    })
    data.orders.push(order)
    pushMessage(data, c.id, { sender: 'VENDOR', type: 'Order', content: `Đơn dịch vụ ${order.orderCode}: tổng ${fm(order.totalAmount)}, đặt cọc ${order.depositPercent}% = ${fm(order.depositAmount)}.`, orderId: order.id })
  }
  plan.status = 'AWAITING_DEPOSIT'
}

function findOrder(data: UserData, id: string) {
  const o = data.orders.find((x) => x.id === id)
  if (!o || o.status === 'Draft') throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn dịch vụ.')
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

  getOrder: (id: string): Order => effective(findOrder(read(), id)),

  /** Đơn của khách (bỏ bản nháp), mới nhất trước, kèm lĩnh vực của NCC (trang Kế hoạch). */
  listOrders: (): Order[] =>
    read()
      .orders.filter((o) => o.status !== 'Draft')
      .map((o) => ({ ...effective(o), category: o.serviceId ? mockCatalog.getSummary(o.serviceId).category : undefined }))
      .reverse(),

  /** Khách yêu cầu chỉnh sửa (chỉ khi Pending): ghi OrderRevisions BeforeDeposit/Requested kèm nội dung đổi, CHỈ MỘT tin hệ thống. */
  requestRevision: (orderId: string, body: { changes: RevisionChangeType[]; note: string }): Order => {
    const userId = currentUserId()
    const order = write((data) => {
      const o = findOrder(data, orderId)
      if (effective(o).status !== 'Pending') throw new ApiError(409, 'ORDER_NOT_REVISABLE', 'Chỉ yêu cầu chỉnh sửa được đơn đang chờ đặt cọc.')
      const note = body.note.trim()
      if (!note) throw new ApiError(400, 'VALIDATION_ERROR', 'Vui lòng ghi rõ nội dung chi tiết cần chỉnh sửa để nhà cung cấp biết.')
      o.status = 'NeedRevision'
      o.revisions.unshift({
        id: nextId(data, 'rv'),
        revisionType: 'BeforeDeposit',
        requestNote: note,
        changes: body.changes,
        oldTotalAmount: o.totalAmount,
        newTotalAmount: null,
        status: 'Requested',
        createdDate: now(),
        appliedDate: null,
      })
      const plan = data.planItems.find((p) => p.serviceId === o.serviceId)
      if (plan) plan.status = 'DISCUSSING'
      const what = body.changes.map((c) => CHANGE_LABEL[c]).join(', ')
      pushMessage(data, o.conversationId, { sender: 'SYSTEM', type: 'Text', content: `Khách yêu cầu chỉnh sửa đơn ${o.orderCode}: ${what ? `${what} · ` : ''}"${note}"`, orderId: o.id })
      return { ...o }
    })
    // NCC giả cập nhật và gửi lại đơn sau 2 giây
    setTimeout(() => write((data) => vendorSendOrder(data, order.conversationId), userId), 2000)
    return order
  },

  /** Tạo thanh toán cọc. Bản giả ghi nhận thanh toán thành công luôn và trả địa chỉ quay về trang kết quả. */
  createPayment: (orderId: string, _method: PaymentMethod): PaymentCreated =>
    write((data) => {
      const o = findOrder(data, orderId)
      if (effective(o).status !== 'Pending') throw new ApiError(409, 'ORDER_NOT_PAYABLE', 'Chưa có đơn dịch vụ cần thanh toán.')
      const paidDate = now()
      const receiptCode = `XNC${new Date().toISOString().slice(2, 7).replace('-', '')}${String(data.orders.length + 1).padStart(4, '0')}`
      Object.assign(o, { status: 'Deposited', payment: { status: 'Paid', paidDate, transactionCode: String(Math.floor(10_000_000 + Math.random() * 89_999_999)) } })
      o.invoices.push({ id: nextId(data, 'iv'), invoiceCode: receiptCode, type: 'DepositReceipt', createdDate: paidDate })
      const plan = data.planItems.find((p) => p.serviceId === o.serviceId)
      if (plan) {
        plan.status = 'CONFIRMED'
        openServiceTasks(data, plan.id)
      }
      pushMessage(data, o.conversationId, {
        sender: 'SYSTEM',
        type: 'DepositReceipt',
        orderId: o.id,
        content: `Giấy xác nhận cọc ${receiptCode}: đã nhận ${fm(o.depositAmount)} cho đơn ${o.orderCode}. Số còn lại ${fm(o.totalAmount - o.depositAmount)} thanh toán trực tiếp với NCC.`,
      })
      return { paymentId: nextId(data, 'pay'), paymentUrl: `/plan/deal/${o.id}?vnp_ResponseCode=00` }
    }),
}
