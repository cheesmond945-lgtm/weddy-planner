import { ApiError } from '@/api/client'
import { cleanContent, currentVersion, diffContent, paymentStatusOf, totalOf } from '@/features/serviceOrders/calc'
import { validateOrder } from '@/features/serviceOrders/validation'
import { formatMoney } from '@/lib/format'
import type { MessageSender } from '@/types/chat'
import type { OrderContent, OrderLine, ServiceOrder, ServiceOrderStatus } from '@/types/serviceOrder'
import type { ChatMessageType, CustomerSimulation, VendorConversation, VendorMessage } from '@/types/vendorChat'

/*
 * Tin nhắn và đơn dịch vụ giả phía NCC, lưu theo từng tài khoản NCC trong localStorage.
 * Dữ liệu mẫu chép từ prototype NCC: u-vendor-1 (Mây Palace) có 10 hội thoại đủ các trạng thái đơn;
 * u-vendor-2 (Studio Mây Wedding) có 1 hội thoại chỉ có tin nhắn.
 *
 * Dữ liệu này tách riêng với mocks/chat.ts của phía cặp đôi (hai bên chưa thấy tin của nhau khi dùng mock).
 * Hành động của khách (nhắn tin, xác nhận đơn, yêu cầu sửa, đặt cọc VNPay, yêu cầu điều chỉnh, duyệt phương án)
 * giả lập bằng simulate(): CHỈ CÓ TRONG MOCK, BE không làm.
 * Muốn làm lại từ đầu thì xóa khóa localStorage bên dưới.
 */
const STORAGE_KEY = 'weddy.mock.vendorChat'

type StoredConversation = Pick<VendorConversation, 'id' | 'customer' | 'interestPackage' | 'unreadCount'>

interface VendorChatData {
  conversations: StoredConversation[]
  messages: VendorMessage[]
  orders: ServiceOrder[]
}

// ---- Dựng dữ liệu mẫu ----

/** Thời điểm theo giờ Việt Nam -> ISO UTC */
const at = (day: string, time = '09:00') => new Date(`${day}T${time}:00+07:00`).toISOString()
let seq = 0
const nextId = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`

const line = (name: string, unit: string, quantity: number, unitPrice: number, extra: Partial<OrderLine> = {}): OrderLine => ({
  id: nextId('l'),
  packageId: null,
  name,
  unit,
  quantity,
  unitPrice,
  isPolicyFee: false,
  ...extra,
})

/** Đơn tiệc Menu A mẫu (ae trong prototype): cọc 20% qua VNPay, phần còn lại tiền mặt trong ngày tiệc. */
function menuA(customerName: string, customerPhone: string, eventDate: string, tables = 20): OrderContent {
  const total = tables * 4_000_000
  return {
    customerName,
    customerPhone,
    eventDate,
    note: 'Giữ sảnh Mây tầng 2. Thực đơn Menu A theo bảng đã gửi.',
    lines: [line('Tiệc cưới – Menu A', 'Bàn', tables, 4_000_000, { packageId: 'DV101' })],
    installments: [
      { id: nextId('i'), name: 'Đợt 1 – Đặt cọc', rate: 20, amount: total * 0.2, dueDate: '2026-10-25', method: 'VNPAY', note: null },
      { id: nextId('i'), name: 'Đợt 2 – Thanh toán còn lại', rate: 80, amount: total * 0.8, dueDate: eventDate, method: 'CASH', note: 'Thanh toán trong ngày tiệc' },
    ],
  }
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

/** Tính lại các trường suy ra (BE tính). */
function finalize(o: ServiceOrder): ServiceOrder {
  const content = currentVersion(o)?.content ?? o.draft?.content
  o.totalAmount = content ? totalOf(content.lines) : 0
  o.paidAmount = o.payments.reduce((s, p) => s + p.amount, 0)
  o.paymentStatus = paymentStatusOf(o)
  return o
}

function seed(userId: string): VendorChatData {
  const data: VendorChatData = { conversations: [], messages: [], orders: [] }
  const conv = (id: string, name: string, phone: string, unreadCount = 0, interest = false) => {
    data.conversations.push({
      id,
      customer: { name, phone },
      interestPackage: interest ? { id: 'DV101', name: 'Tiệc cưới – Menu A', price: 3_500_000, maxPrice: 4_500_000 } : null,
      unreadCount,
    })
    return id
  }
  const msg = (conversationId: string, sender: MessageSender, type: ChatMessageType, createdAt: string, extra: Partial<VendorMessage> = {}) =>
    data.messages.push({ id: nextId('m'), conversationId, sender, type, text: '', orderId: null, orderVersion: null, adjustmentId: null, changes: null, createdAt, ...extra })
  const text = (c: string, sender: MessageSender, when: string, t: string) => msg(c, sender, 'TEXT', when, { text: t })
  const orderCard = (o: ServiceOrder, version: number, when: string) => msg(o.conversationId, 'VENDOR', 'ORDER', when, { orderId: o.id, orderVersion: version })
  const order = (code: string, conversationId: string, status: ServiceOrderStatus, content: OrderContent, sentAt: string): ServiceOrder => {
    const o: ServiceOrder = {
      id: `so-${code.replace(/\D/g, '')}`,
      code,
      conversationId,
      status,
      paymentStatus: 'UNPAID',
      versions: [{ version: 1, sentAt, content, changes: [], fromAdjustmentId: null }],
      draft: null,
      revisionRequest: null,
      adjustmentRequest: null,
      payments: [],
      adjustments: [],
      totalAmount: 0,
      paidAmount: 0,
      history: [{ at: sentAt, text: 'Gửi đơn v1 cho khách' }],
      createdAt: sentAt,
      updatedAt: sentAt,
    }
    data.orders.push(o)
    return o
  }
  const deposit = (o: ServiceOrder, when: string, method: 'VNPAY' | 'CASH' = 'VNPAY', note: string | null = null) => {
    const inst = o.versions[0].content.installments[0]
    o.payments.push({
      id: nextId('p'),
      installmentId: inst.id,
      installmentName: inst.name,
      amount: inst.amount,
      paidAt: when,
      method,
      plannedMethod: inst.method,
      recordedBy: method === 'VNPAY' ? 'SYSTEM' : 'VENDOR',
      note,
    })
    const how = method === 'VNPAY' ? 'qua VNPay' : '· Tiền mặt'
    o.history.push({ at: when, text: `Ghi nhận ${formatMoney(inst.amount)} — ${inst.name}${method === 'CASH' ? ' (Tiền mặt)' : ''}` })
    msg(o.conversationId, 'SYSTEM', 'PAYMENT_RECORDED', when, { orderId: o.id, text: `Đã nhận ${formatMoney(inst.amount)} ${how} · ${inst.name}` })
  }
  const confirm = (o: ServiceOrder, when: string) => {
    o.history.push({ at: when, text: 'Khách xác nhận v1' })
    msg(o.conversationId, 'COUPLE', 'ORDER_CONFIRMED', when, { orderId: o.id, orderVersion: 1 })
  }

  if (userId === 'u-vendor-2') {
    const c9 = conv('vc-9', 'Minh Anh', '0901 234 567', 1)
    data.conversations[0].interestPackage = { id: 'DV201', name: 'Pre-wedding Đà Lạt 2 ngày', price: 22_000_000, maxPrice: 30_000_000 }
    text(c9, 'COUPLE', at('2026-10-12', '09:30'), 'Chào studio, mình muốn chụp pre-wedding ở Đà Lạt vào tháng 11.')
    text(c9, 'VENDOR', at('2026-10-12', '09:32'), 'Chào bạn, studio có các gói chụp ngoại cảnh tại Đà Lạt. Bạn dự kiến chụp vào ngày nào?')
    text(c9, 'COUPLE', at('2026-10-12', '09:35'), 'Khoảng ngày 25/11, ngân sách 20–30 triệu. Mình thích phong cách tự nhiên.')
    return data
  }
  if (userId !== 'u-vendor-1') return data

  // c1: chỉ có tin nhắn, khách quan tâm gói
  const c1 = conv('vc-1', 'Hồng Nhung & Tuấn Kiệt', '0905 112 233', 1, true)
  text(c1, 'COUPLE', at('2026-10-18', '08:40'), 'Chào Mây Palace, nhà mình dự kiến tổ chức khoảng 25 bàn vào 06/12. Sảnh tầng 2 còn trống không ạ?')

  // c2: bản nháp đơn chưa gửi
  const c2 = conv('vc-2', 'Bảo Ngọc & Đức Anh', '0912 445 667')
  text(c2, 'COUPLE', at('2026-10-17', '15:10'), 'Bên mình muốn đặt 15 bàn Menu B, ngày 20/12 nhé.')
  text(c2, 'VENDOR', at('2026-10-17', '15:22'), 'Dạ Mây Palace soạn báo giá và gửi anh chị trong hôm nay ạ.')
  const draftAt = at('2026-10-17', '15:30')
  data.orders.push({
    id: 'so-1029',
    code: '#WP1029',
    conversationId: c2,
    status: 'DRAFT',
    paymentStatus: 'UNPAID',
    versions: [],
    draft: {
      kind: 'NEW',
      baseVersion: null,
      savedAt: draftAt,
      content: {
        customerName: 'Bảo Ngọc & Đức Anh',
        customerPhone: '0912 445 667',
        eventDate: '2026-12-20',
        note: null,
        lines: [line('Tiệc cưới – Menu B', 'Bàn', 15, 3_600_000)],
        installments: [{ id: nextId('i'), name: 'Đợt 1 – Đặt cọc', rate: 30, amount: 16_200_000, dueDate: '', method: 'VNPAY', note: null }],
      },
    },
    revisionRequest: null,
    adjustmentRequest: null,
    payments: [],
    adjustments: [],
    totalAmount: 0,
    paidAmount: 0,
    history: [{ at: draftAt, text: 'Lưu nháp' }],
    createdAt: draftAt,
    updatedAt: draftAt,
  })

  // c3: đơn chờ khách xác nhận
  const c3 = conv('vc-3', 'Thu Hà & Đức Minh', '0913 234 578', 0, true)
  text(c3, 'COUPLE', at('2026-10-16', '10:05'), 'Nhà mình chốt 18 bàn Menu A ngày 13/12 nha.')
  const o3 = order('#WP1028', c3, 'AWAITING_CONFIRMATION', menuA('Thu Hà & Đức Minh', '0913 234 578', '2026-12-13', 18), at('2026-10-16', '10:40'))
  orderCard(o3, 1, at('2026-10-16', '10:40'))

  // c4: khách yêu cầu chỉnh sửa đơn
  const c4 = conv('vc-4', 'Minh Anh & Quốc Huy', '0901 234 567', 2, true)
  text(c4, 'COUPLE', at('2026-10-14', '09:15'), 'Chào Mây Palace, tụi mình đặt 20 bàn Menu A cho ngày 29/11 nhé.')
  text(c4, 'VENDOR', at('2026-10-14', '09:20'), 'Dạ, Mây Palace gửi anh chị đơn dịch vụ để xác nhận ạ.')
  const o4 = order('#WP1025', c4, 'REVISION_REQUESTED', menuA('Minh Anh & Quốc Huy', '0901 234 567', '2026-11-29'), at('2026-10-14', '09:32'))
  orderCard(o4, 1, at('2026-10-14', '09:32'))
  const req4 = 'Giảm từ 20 xuống 15 bàn, giữ Menu A và đổi phương thức đợt cuối sang chuyển khoản.'
  o4.revisionRequest = { version: 1, note: req4, requestedAt: at('2026-10-18', '07:50') }
  o4.history.push({ at: at('2026-10-18', '07:50'), text: 'Khách yêu cầu chỉnh sửa v1' })
  msg(c4, 'COUPLE', 'ORDER_REVISION_REQUESTED', at('2026-10-18', '07:50'), { orderId: o4.id, orderVersion: 1, text: req4 })
  text(c4, 'COUPLE', at('2026-10-18', '07:51'), 'Bên mình cập nhật giúp và gửi lại nhé, cảm ơn!')

  // c5: đã gửi lại v2 sau khi khách yêu cầu sửa
  const c5 = conv('vc-5', 'Ngọc Mai & Hoàng Nam', '0923 456 789')
  const v1 = menuA('Ngọc Mai & Hoàng Nam', '0923 456 789', '2026-12-06', 25)
  const v2 = clone(v1)
  v2.lines[0].quantity = 22
  v2.lines.push(line('Bia Tiger (thùng)', 'Thùng', 10, 420_000))
  const t2 = totalOf(v2.lines)
  v2.installments[0].amount = Math.round(t2 * 0.2)
  v2.installments[1].amount = t2 - v2.installments[0].amount
  v2.installments[1].rate = Math.round((v2.installments[1].amount / t2) * 10000) / 100
  const o5 = order('#WP1024', c5, 'AWAITING_CONFIRMATION', v1, at('2026-10-12', '14:00'))
  o5.versions.push({ version: 2, sentAt: at('2026-10-13', '09:10'), content: v2, changes: diffContent(v1, v2), fromAdjustmentId: null })
  o5.history.push({ at: at('2026-10-12', '20:30'), text: 'Khách yêu cầu chỉnh sửa v1' }, { at: at('2026-10-13', '09:10'), text: 'Gửi lại v2 — v1 đã thay thế' })
  orderCard(o5, 1, at('2026-10-12', '14:00'))
  msg(c5, 'COUPLE', 'ORDER_REVISION_REQUESTED', at('2026-10-12', '20:30'), { orderId: o5.id, orderVersion: 1, text: 'Cho mình giảm còn 22 bàn và thêm 10 thùng bia nhé.' })
  msg(c5, 'SYSTEM', 'ORDER_RESENT', at('2026-10-13', '09:10'), { orderId: o5.id, orderVersion: 2, changes: o5.versions[1].changes })
  orderCard(o5, 2, at('2026-10-13', '09:10'))

  // c6: khách đã xác nhận, chờ đặt cọc
  const c6 = conv('vc-6', 'Thanh Trúc & Gia Bảo', '0934 567 890')
  const o6 = order('#WP1023', c6, 'CONFIRMED', menuA('Thanh Trúc & Gia Bảo', '0934 567 890', '2026-12-27', 30), at('2026-10-10', '11:00'))
  orderCard(o6, 1, at('2026-10-10', '11:00'))
  confirm(o6, at('2026-10-11', '08:30'))
  text(c6, 'COUPLE', at('2026-10-11', '08:31'), 'Mình sẽ đặt cọc trong tuần này nhé.')

  // c7: đã nhận cọc, khách yêu cầu điều chỉnh
  const c7 = conv('vc-7', 'Hải Yến & Anh Tuấn', '0945 678 901', 1)
  const o7 = order('#WP1022', c7, 'CONFIRMED', menuA('Hải Yến & Anh Tuấn', '0945 678 901', '2026-11-22'), at('2026-10-05', '16:00'))
  orderCard(o7, 1, at('2026-10-05', '16:00'))
  confirm(o7, at('2026-10-06', '09:00'))
  deposit(o7, at('2026-10-07', '10:12'))
  const req7 = 'Nhà mình muốn tăng từ 20 lên 22 bàn, vẫn giữ Menu A ạ.'
  o7.adjustmentRequest = { note: req7, requestedAt: at('2026-10-18', '10:20') }
  o7.history.push({ at: at('2026-10-18', '10:20'), text: 'Khách gửi yêu cầu điều chỉnh' })
  msg(c7, 'COUPLE', 'ADJUSTMENT_REQUESTED', at('2026-10-18', '10:20'), { orderId: o7.id, text: req7 })

  // c8, c11, c12: phương án điều chỉnh (chờ khách, khách yêu cầu sửa, khách đồng ý)
  const withAdjustment = (
    o: ServiceOrder,
    after: OrderContent,
    reason: string,
    proposedAt: string,
    status: 'AWAITING_CONFIRMATION' | 'REVISION_REQUESTED' | 'ACCEPTED',
  ) => {
    const before = o.versions[0].content
    const adj = {
      id: nextId('adj'),
      status,
      reason,
      proposedAt,
      before,
      after,
      beforeTotal: totalOf(before.lines),
      afterTotal: totalOf(after.lines),
      paidAmount: o.payments.reduce((s, p) => s + p.amount, 0),
      customerNote: null,
      customerNoteAt: null,
      resultVersion: null,
      revisionOf: null,
    } as ServiceOrder['adjustments'][number]
    o.adjustments.push(adj)
    o.history.push({ at: proposedAt, text: 'Gửi phương án điều chỉnh' })
    msg(o.conversationId, 'VENDOR', 'ADJUSTMENT_PROPOSED', proposedAt, { orderId: o.id, adjustmentId: adj.id })
    return adj
  }
  const reduced = (content: OrderContent, tables: number, fee: number, remaining: number) => {
    const c = clone(content)
    c.lines[0].quantity = tables
    c.lines.push(line('Phí giảm số bàn (theo chính sách đã thỏa thuận)', 'Khoản', 1, fee, { isPolicyFee: true }))
    const total = totalOf(c.lines)
    c.installments[1].amount = remaining
    c.installments[0].rate = Math.round((c.installments[0].amount / total) * 10000) / 100
    c.installments[1].rate = Math.round((remaining / total) * 10000) / 100
    return c
  }

  const c8 = conv('vc-8', 'Phương Linh & Minh Khôi', '0956 789 012', 1)
  const o8 = order('#WP1021', c8, 'CONFIRMED', menuA('Phương Linh & Minh Khôi', '0956 789 012', '2026-11-15'), at('2026-09-28', '10:00'))
  orderCard(o8, 1, at('2026-09-28', '10:00'))
  confirm(o8, at('2026-09-29', '08:00'))
  deposit(o8, at('2026-09-30', '14:20'))
  text(c8, 'COUPLE', at('2026-10-17', '16:40'), 'Nhà mình giảm khách, chỉ còn khoảng 15 bàn thôi ạ.')
  withAdjustment(o8, reduced(o8.versions[0].content, 15, 10_000_000, 54_000_000), 'Khách giảm số khách mời, giảm từ 20 xuống 15 bàn.', at('2026-10-17', '17:05'), 'AWAITING_CONFIRMATION')

  const c11 = conv('vc-11', 'Quỳnh Anh & Đức Long', '0967 112 358', 1)
  const o11 = order('#WP1019', c11, 'CONFIRMED', menuA('Quỳnh Anh & Đức Long', '0967 112 358', '2026-11-08'), at('2026-09-20', '09:00'))
  orderCard(o11, 1, at('2026-09-20', '09:00'))
  confirm(o11, at('2026-09-21', '08:00'))
  deposit(o11, at('2026-09-22', '15:00'))
  const a11 = withAdjustment(o11, reduced(o11.versions[0].content, 16, 8_000_000, 56_000_000), 'Khách giảm từ 20 xuống 16 bàn.', at('2026-10-15', '11:00'), 'REVISION_REQUESTED')
  a11.customerNote = 'Phí giảm bàn 8 triệu hơi cao, bên mình đề nghị 5 triệu theo hợp đồng ạ.'
  a11.customerNoteAt = at('2026-10-16', '20:10')
  o11.history.push({ at: a11.customerNoteAt, text: 'Khách yêu cầu sửa phương án' })
  msg(c11, 'COUPLE', 'ADJUSTMENT_REVISION_REQUESTED', a11.customerNoteAt, { orderId: o11.id, adjustmentId: a11.id, text: a11.customerNote })

  const c12 = conv('vc-12', 'Mai Chi & Tiến Dũng', '0978 246 135')
  const o12 = order('#WP1018', c12, 'CONFIRMED', menuA('Mai Chi & Tiến Dũng', '0978 246 135', '2026-11-01'), at('2026-09-10', '10:00'))
  orderCard(o12, 1, at('2026-09-10', '10:00'))
  confirm(o12, at('2026-09-11', '08:00'))
  deposit(o12, at('2026-09-12', '09:30'), 'CASH', 'Khách nộp tiền mặt tại quầy')
  const after12 = clone(o12.versions[0].content)
  after12.lines[0].quantity = 25
  after12.installments[1].amount = 84_000_000
  const a12 = withAdjustment(o12, after12, 'Khách tăng từ 20 lên 25 bàn.', at('2026-10-02', '14:00'), 'ACCEPTED')
  const okAt = at('2026-10-03', '09:15')
  o12.versions.push({ version: 2, sentAt: okAt, content: after12, changes: diffContent(o12.versions[0].content, after12), fromAdjustmentId: a12.id })
  a12.resultVersion = 2
  o12.history.push({ at: okAt, text: 'Khách đồng ý điều chỉnh — v2 có hiệu lực' })
  msg(c12, 'COUPLE', 'ADJUSTMENT_ACCEPTED', okAt, { orderId: o12.id, orderVersion: 2 })
  orderCard(o12, 2, okAt)

  data.orders.forEach(finalize)
  return data
}

// ---- Lưu trữ ----

function loadAll(): Record<string, VendorChatData> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, VendorChatData>
  } catch {
    return {}
  }
}

/** Đọc dữ liệu của NCC (lần đầu thì tạo dữ liệu mẫu), chạy fn, lưu lại. */
function withData<T>(userId: string, fn: (d: VendorChatData) => T): T {
  const all = loadAll()
  all[userId] ??= seed(userId)
  const result = fn(all[userId])
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // bỏ qua
  }
  return result === undefined ? result : clone(result)
}

function findConversation(d: VendorChatData, id: string) {
  const c = d.conversations.find((x) => x.id === id)
  if (!c) throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.')
  return c
}

function findOrder(d: VendorChatData, id: string) {
  const o = d.orders.find((x) => x.id === id)
  if (!o) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn dịch vụ.')
  return o
}

function push(d: VendorChatData, m: Omit<VendorMessage, 'id' | 'createdAt' | 'text' | 'orderId' | 'orderVersion' | 'adjustmentId' | 'changes'> & Partial<VendorMessage>) {
  const full: VendorMessage = { id: nextId('m'), createdAt: new Date().toISOString(), text: '', orderId: null, orderVersion: null, adjustmentId: null, changes: null, ...m }
  d.messages.push(full)
  return full
}

const isOpenAdjustment = (a: ServiceOrder['adjustments'][number]) => a.status === 'AWAITING_CONFIRMATION' || a.status === 'REVISION_REQUESTED'
const needsAction = (o: ServiceOrder) =>
  !!o.draft || o.status === 'REVISION_REQUESTED' || !!o.adjustmentRequest || o.adjustments.some((a) => a.status === 'REVISION_REQUESTED')

function summarize(d: VendorChatData, c: StoredConversation): VendorConversation {
  const msgs = d.messages.filter((m) => m.conversationId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const last = msgs[msgs.length - 1]
  const orders = d.orders.filter((o) => o.conversationId === c.id)
  const sent = orders.filter((o) => o.versions.length).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const latest = sent[sent.length - 1]
  return {
    ...c,
    lastMessage: last
      ? {
          sender: last.sender,
          type: last.type,
          text: last.text,
          orderVersion: last.orderVersion,
          createdAt: last.createdAt,
          orderCode: last.orderId ? (orders.find((o) => o.id === last.orderId)?.code ?? null) : null,
        }
      : null,
    latestOrder: latest ? { id: latest.id, code: latest.code, status: latest.status, paymentStatus: latest.paymentStatus } : null,
    hasDraftOrder: orders.some((o) => !!o.draft),
    needsAction: orders.some(needsAction),
    orderCodes: orders.map((o) => o.code),
  }
}

function nextCode(d: VendorChatData) {
  const all = Object.values(loadAll()).flatMap((x) => x.orders)
  return `#WP${Math.max(1020, ...[...all, ...d.orders].map((o) => Number(o.code.replace(/\D/g, '')) || 0)) + 1}`
}

function assertSendable(content: OrderContent) {
  const errors = validateOrder(content)
  if (Object.keys(errors).length) {
    throw new ApiError(400, 'VALIDATION_ERROR', Object.values(errors)[0], Object.entries(errors).map(([field, m]) => ({ field, messages: [m] })))
  }
}

/** Gửi phiên bản đầu (đơn mới hoặc bản nháp NEW). */
function sendFirst(d: VendorChatData, o: ServiceOrder, content: OrderContent) {
  const now = new Date().toISOString()
  o.versions = [{ version: 1, sentAt: now, content, changes: [], fromAdjustmentId: null }]
  o.status = 'AWAITING_CONFIRMATION'
  o.draft = null
  o.history.push({ at: now, text: 'Gửi đơn v1 cho khách' })
  o.updatedAt = now
  push(d, { conversationId: o.conversationId, sender: 'VENDOR', type: 'ORDER', orderId: o.id, orderVersion: 1 })
}

const CUSTOMER_LINES = [
  'Dạ cảm ơn bên mình, nhà mình xem rồi báo lại nhé.',
  'Cho mình hỏi bên mình có hỗ trợ trang trí cổng hoa không ạ?',
  'Ngày đó còn sảnh không ạ? Nhà mình muốn đi xem trực tiếp cuối tuần này.',
  'Giá này đã gồm VAT chưa ạ?',
]

export const mockVendorChat = {
  listConversations(userId: string): VendorConversation[] {
    return withData(userId, (d) =>
      d.conversations.map((c) => summarize(d, c)).sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? '')),
    )
  },

  listMessages(userId: string, conversationId: string): VendorMessage[] {
    return withData(userId, (d) => {
      findConversation(d, conversationId)
      return d.messages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    })
  },

  markRead(userId: string, conversationId: string) {
    withData(userId, (d) => {
      findConversation(d, conversationId).unreadCount = 0
    })
  },

  sendMessage(userId: string, conversationId: string, text: string): VendorMessage {
    if (!text.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Tin nhắn không được để trống.')
    return withData(userId, (d) => {
      findConversation(d, conversationId)
      return push(d, { conversationId, sender: 'VENDOR', type: 'TEXT', text: text.trim() })
    })
  },

  listOrders(userId: string, conversationId: string): ServiceOrder[] {
    return withData(userId, (d) => d.orders.filter((o) => o.conversationId === conversationId))
  },

  getOrder(userId: string, orderId: string): ServiceOrder {
    return withData(userId, (d) => findOrder(d, orderId))
  },

  /** Tạo đơn trong hội thoại: send = false lưu nháp, true gửi luôn v1. */
  createOrder(userId: string, body: { conversationId: string; content: OrderContent; send: boolean }): ServiceOrder {
    return withData(userId, (d) => {
      findConversation(d, body.conversationId)
      const content = cleanContent(body.content)
      if (body.send) assertSendable(content)
      const now = new Date().toISOString()
      const o: ServiceOrder = {
        id: nextId('so'),
        code: nextCode(d),
        conversationId: body.conversationId,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        versions: [],
        draft: { kind: 'NEW', baseVersion: null, content: body.content, savedAt: now },
        revisionRequest: null,
        adjustmentRequest: null,
        payments: [],
        adjustments: [],
        totalAmount: 0,
        paidAmount: 0,
        history: [{ at: now, text: 'Lưu nháp' }],
        createdAt: now,
        updatedAt: now,
      }
      d.orders.push(o)
      if (body.send) {
        o.history = []
        sendFirst(d, o, content)
      }
      return finalize(o)
    })
  },

  /** Lưu nháp: đơn chưa gửi thì nháp NEW, đơn đã gửi thì bản sửa EDIT (phiên bản đang gửi giữ nguyên). */
  saveDraft(userId: string, orderId: string, content: OrderContent): ServiceOrder {
    return withData(userId, (d) => {
      const o = findOrder(d, orderId)
      if (o.status === 'CONFIRMED') throw new ApiError(409, 'ORDER_NOT_REVISABLE', 'Đơn đã được khách xác nhận, dùng phương án điều chỉnh để thay đổi.')
      const now = new Date().toISOString()
      const cur = currentVersion(o)
      o.draft = { kind: cur ? 'EDIT' : 'NEW', baseVersion: cur?.version ?? null, content, savedAt: now }
      o.history.push({ at: now, text: cur ? 'Lưu bản sửa nháp' : 'Lưu nháp' })
      o.updatedAt = now
      return finalize(o)
    })
  },

  /** Gửi: bản nháp NEW thành v1; đơn đã gửi thành phiên bản mới (khi đang chờ xác nhận hoặc khách yêu cầu sửa). */
  sendOrder(userId: string, orderId: string, body: { content: OrderContent; baseVersion: number | null }): ServiceOrder {
    return withData(userId, (d) => {
      const o = findOrder(d, orderId)
      const content = cleanContent(body.content)
      assertSendable(content)
      const cur = currentVersion(o)
      if (!cur) {
        sendFirst(d, o, content)
        return finalize(o)
      }
      if (o.status === 'CONFIRMED') throw new ApiError(409, 'ORDER_NOT_REVISABLE', 'Đơn đã được khách xác nhận, dùng phương án điều chỉnh để thay đổi.')
      if (body.baseVersion !== cur.version) {
        throw new ApiError(409, 'ORDER_VERSION_CONFLICT', `Đơn ${o.code} vừa thay đổi (hiện là v${cur.version}). Đóng và mở lại để sửa trên bản mới nhất.`)
      }
      if (o.payments.length) throw new ApiError(409, 'ORDER_HAS_PAYMENTS', 'Đơn đã có khoản thu thực tế, dùng phương án điều chỉnh thay vì gửi lại.')
      const changes = diffContent(cur.content, content)
      if (!changes.length) throw new ApiError(400, 'ORDER_NO_CHANGES', 'Chưa có thay đổi nào so với phiên bản đang gửi.')
      const now = new Date().toISOString()
      const version = cur.version + 1
      o.versions.push({ version, sentAt: now, content, changes, fromAdjustmentId: null })
      o.revisionRequest = null
      o.status = 'AWAITING_CONFIRMATION'
      o.draft = null
      o.history.push({ at: now, text: `Gửi lại v${version} — v${cur.version} đã thay thế` })
      o.updatedAt = now
      push(d, { conversationId: o.conversationId, sender: 'SYSTEM', type: 'ORDER_RESENT', orderId: o.id, orderVersion: version, changes })
      push(d, { conversationId: o.conversationId, sender: 'VENDOR', type: 'ORDER', orderId: o.id, orderVersion: version })
      return finalize(o)
    })
  },

  /** CHỈ CÓ TRONG MOCK: giả lập khách làm một việc trên đơn mới nhất của hội thoại. */
  simulate(userId: string, conversationId: string, action: CustomerSimulation) {
    withData(userId, (d) => {
      const c = findConversation(d, conversationId)
      const now = new Date().toISOString()
      const o = d.orders
        .filter((x) => x.conversationId === conversationId && x.versions.length)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .pop()
      const base = { conversationId, sender: 'COUPLE' as const }
      const fail = () => {
        throw new ApiError(409, 'CONFLICT', 'Đơn không ở trạng thái phù hợp cho hành động này.')
      }
      c.unreadCount += 1

      if (action === 'MESSAGE') {
        push(d, { ...base, type: 'TEXT', text: CUSTOMER_LINES[Math.floor(Math.random() * CUSTOMER_LINES.length)] })
        return
      }
      if (!o) return fail()
      const cur = currentVersion(o)!
      const adj = o.adjustments.find(isOpenAdjustment)
      switch (action) {
        case 'CONFIRM_ORDER':
          if (o.status !== 'AWAITING_CONFIRMATION') return fail()
          o.status = 'CONFIRMED'
          o.history.push({ at: now, text: `Khách xác nhận v${cur.version}` })
          push(d, { ...base, type: 'ORDER_CONFIRMED', orderId: o.id, orderVersion: cur.version })
          break
        case 'REQUEST_REVISION': {
          if (o.status !== 'AWAITING_CONFIRMATION') return fail()
          const note = 'Bên mình muốn đổi ngày sự kiện lùi 1 tuần và giảm 2 bàn, nhờ bên bạn cập nhật lại đơn nhé.'
          o.status = 'REVISION_REQUESTED'
          o.revisionRequest = { version: cur.version, note, requestedAt: now }
          o.history.push({ at: now, text: `Khách yêu cầu chỉnh sửa v${cur.version}` })
          push(d, { ...base, type: 'ORDER_REVISION_REQUESTED', orderId: o.id, orderVersion: cur.version, text: note })
          break
        }
        case 'PAY_DEPOSIT': {
          const inst = cur.content.installments[0]
          if (o.status !== 'CONFIRMED' || o.payments.some((p) => p.installmentId === inst.id)) return fail()
          o.payments.push({
            id: nextId('p'),
            installmentId: inst.id,
            installmentName: inst.name,
            amount: inst.amount,
            paidAt: now,
            method: 'VNPAY',
            plannedMethod: inst.method,
            recordedBy: 'SYSTEM',
            note: null,
          })
          o.history.push({ at: now, text: `Ghi nhận ${formatMoney(inst.amount)} — ${inst.name} (VNPay)` })
          push(d, { conversationId, sender: 'SYSTEM', type: 'PAYMENT_RECORDED', orderId: o.id, text: `Đã nhận ${formatMoney(inst.amount)} qua VNPay · ${inst.name}` })
          break
        }
        case 'REQUEST_ADJUSTMENT': {
          if (o.status !== 'CONFIRMED' || adj || o.adjustmentRequest) return fail()
          const note = 'Nhà mình muốn thêm 2 bàn cho họ hàng ở xa, nhờ bên mình điều chỉnh giúp ạ.'
          o.adjustmentRequest = { note, requestedAt: now }
          o.history.push({ at: now, text: 'Khách gửi yêu cầu điều chỉnh' })
          push(d, { ...base, type: 'ADJUSTMENT_REQUESTED', orderId: o.id, text: note })
          break
        }
        case 'ACCEPT_ADJUSTMENT': {
          if (!adj || adj.status !== 'AWAITING_CONFIRMATION') return fail()
          const version = cur.version + 1
          o.versions.push({ version, sentAt: now, content: adj.after, changes: diffContent(cur.content, adj.after), fromAdjustmentId: adj.id })
          adj.status = 'ACCEPTED'
          adj.resultVersion = version
          o.history.push({ at: now, text: `Khách đồng ý điều chỉnh — v${version} có hiệu lực` })
          push(d, { ...base, type: 'ADJUSTMENT_ACCEPTED', orderId: o.id, orderVersion: version })
          push(d, { conversationId, sender: 'VENDOR', type: 'ORDER', orderId: o.id, orderVersion: version })
          break
        }
        case 'REVISE_ADJUSTMENT': {
          if (!adj || adj.status !== 'AWAITING_CONFIRMATION') return fail()
          const note = 'Phí theo chính sách hơi cao so với hợp đồng, bên mình đề nghị giảm bớt ạ.'
          adj.status = 'REVISION_REQUESTED'
          adj.customerNote = note
          adj.customerNoteAt = now
          o.history.push({ at: now, text: 'Khách yêu cầu sửa phương án' })
          push(d, { ...base, type: 'ADJUSTMENT_REVISION_REQUESTED', orderId: o.id, adjustmentId: adj.id, text: note })
          break
        }
      }
      o.updatedAt = now
      finalize(o)
    })
  },
}
