import { ApiError } from '@/api/client'
import { addDaysYmd, now, todayVN } from '@/lib/clock'
import { depositOf, isDepositTooLarge } from '@/lib/deposit'
import { formatMoney } from '@/lib/format'
import type { Paginated } from '@/types/api'
import type { CustomerSimulation, MessageSender, MessageType, VendorConversation, VendorMessage } from '@/types/vendorConversation'
import type {
  Invoice,
  Order,
  OrderContent,
  OrderItem,
  OrderItemInput,
  OrderListQuery,
  OrderRevision,
  OrderStatus,
  RevisionChangeType,
} from '@/types/vendorOrder'
import { CANCEL_REASONS, ORDER_STATUSES, type CancelReason } from '@/types/vendorOrder'
import { COMMISSION_DUE_DAY } from '@/features/commissions/constants'
import { CANCEL_REASON, CHANGE_LABEL } from '@/features/vendorOrders/constants'
import { mockVendors } from './vendors'

/*
 * Hội thoại, tin nhắn, đơn dịch vụ, hoa hồng của NCC (dữ liệu giả), mô phỏng đúng quy tắc của docs/database.md,
 * docs/CHOT_NGHIEP_VU_NCC.md và hợp đồng docs/api/orders.md, docs/api/chat.md (phần NCC):
 * - 7 trạng thái đơn; backend tính tiền (thành tiền, tổng, tiền cọc làm tròn 100.000đ); hạn cọc 1 ngày kể từ lúc gửi.
 * - Chỉ một khoản trong hệ thống là tiền cọc qua VNPay; phần còn lại tiền mặt ngoài hệ thống.
 * - Việc tự chạy mỗi lần đọc dữ liệu: Pending quá hạn cọc thì Expired; Deposited quá EventDate + 7 ngày thì Completed.
 * - Hoàn thành thì tạo Commissions gắn vào bảng kê (CommissionStatements) của tháng hoàn thành, hạn nộp ngày 25 tháng sau.
 * - Giấy xác nhận cọc (tự động khi cọc), hóa đơn cuối (NCC xuất, mỗi đơn một lần).
 * "Giả lập khách" (đặt cọc, yêu cầu chỉnh sửa, hủy sau cọc, nhắn tin) và "Giả lập thời gian" chỉ có ở dữ liệu giả.
 *
 * Dữ liệu lưu trong localStorage theo từng tài khoản NCC. Muốn làm lại từ đầu thì xóa khóa bên dưới.
 */
const STORAGE_KEY = 'weddy.mock.vendorOrders.v6'

/** Tỷ lệ hoa hồng theo loại dịch vụ (ServiceCategories.CommissionRate): chỉ để dữ liệu giả có số; BE đọc từ CSDL. */
export const COMMISSION_RATE: Record<string, number> = { 'nha-hang': 5, decor: 7, 'hoa-cuoi': 8, 'trang-phuc': 8, 'chup-anh': 8, makeup: 10 }

const HOUR = 3_600_000
const PHONE_RE = /^[0-9 +().-]{9,15}$/
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

interface StoredConversation {
  id: string
  customer: { name: string; phone: string }
  /** Chỉ có trong dữ liệu giả: khách chưa có thông tin đám cưới (BE thật trả 409 WEDDING_NOT_SET khi tạo đơn) */
  noWedding?: boolean
}

/** Commissions: hoa hồng của một đơn đã hoàn thành. */
export interface StoredCommission {
  id: string
  orderId: string
  statementId: string
  orderAmount: number
  rate: number
  amount: number
  createdDate: string
}

/** CommissionStatements: bảng kê theo tháng, nộp một lần ngày 25 tháng sau. */
export interface StoredStatement {
  id: string
  /** Ngày đầu tháng "YYYY-MM-01" */
  periodMonth: string
  dueDate: string
  totalOrders: number
  totalAmount: number
  transactionCode: string | null
  status: 'Unpaid' | 'Paid'
  paidDate: string | null
  createdDate: string
}

interface Data {
  conversations: StoredConversation[]
  messages: VendorMessage[]
  orders: Order[]
  commissions: StoredCommission[]
  statements: StoredStatement[]
  counter: number
}

// ---- Tiện ích ----

const iso = (d: Date) => d.toISOString()
const plusHours = (d: Date, h: number) => new Date(d.getTime() + h * HOUR)
const uid = (d: Data, p: string) => `${p}-${++d.counter}`
const bySent = (a: VendorMessage, b: VendorMessage) => a.sentDate.localeCompare(b.sentDate)

/** "26" + "10" từ một thời điểm, theo giờ Việt Nam. */
const yymm = (d: Date) => {
  const t = todayVN(d)
  return t.slice(2, 4) + t.slice(5, 7)
}

function nextCode(d: Data, kind: 'order' | 'receipt' | 'final', at: Date) {
  const prefix = { order: 'DH', receipt: 'XNC', final: 'HD' }[kind] + yymm(at)
  const used =
    kind === 'order'
      ? d.orders.filter((o) => o.orderCode.startsWith(prefix)).length
      : d.orders.flatMap((o) => o.invoices).filter((i) => i.invoiceCode.startsWith(prefix)).length
  return `${prefix}${String(used + 1).padStart(4, '0')}`
}

// Tiền cọc: một công thức chung ở lib/deposit.ts (làm tròn gần nhất 100.000đ, tối thiểu 100.000đ)

const totalOfItems = (items: { quantity: number; unitPrice: number }[]) => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

const keepItems = (items: OrderItemInput[]) => items.filter((i) => i.itemName.trim() !== '' || Number(i.quantity) > 0 || Number(i.unitPrice) > 0)

const contentOf = (o: Order): OrderContent => ({
  customerName: o.customerName,
  customerPhone: o.customerPhone,
  eventDate: o.eventDate,
  note: o.note,
  depositPercent: o.depositPercent,
  items: o.items.map(({ itemName, unit, quantity, unitPrice }) => ({ itemName, unit, quantity, unitPrice })),
})

const normalize = (c: OrderContent) =>
  JSON.stringify({
    ...c,
    customerName: c.customerName.trim(),
    customerPhone: c.customerPhone.trim(),
    note: c.note?.trim() || null,
    items: keepItems(c.items).map((i) => ({ ...i, itemName: i.itemName.trim() })),
  })

/** Đang dựng dữ liệu mẫu: đơn trong quá khứ được phép (không kiểm ngày sự kiện từ hôm nay). */
let seeding = false

/**
 * Kiểm tra nội dung đơn. strict = gửi (đủ); không strict = lưu nháp (chỉ bắt ngày sự kiện).
 * Gửi đơn, Tạo lại đơn, Sửa đơn sau cọc: ngày sự kiện phải từ hôm nay (giờ VN) trở đi, trừ khi giữ nguyên ngày đang có (`originalDate`);
 * trả 422 EVENT_DATE_IN_PAST. `deposit: false` (sửa sau cọc): tiền cọc đã khóa, bỏ kiểm "tổng đơn quá nhỏ để đặt cọc".
 */
function validate(c: OrderContent, strict: boolean, at: Date, ctx: { originalDate?: string; deposit?: boolean } = {}) {
  const e: Record<string, string> = {}
  if (!YMD_RE.test(c.eventDate) || Number.isNaN(Date.parse(c.eventDate))) e.eventDate = 'Chọn ngày diễn ra sự kiện.'
  if (strict) {
    if (!c.customerName.trim()) e.customerName = 'Nhập tên khách hàng.'
    if (!PHONE_RE.test(c.customerPhone.trim())) e.customerPhone = 'Số điện thoại gồm 9 đến 15 ký tự (số, khoảng trắng, + ( ) . -).'
    const items = keepItems(c.items)
    if (!items.length) e.items = 'Thêm ít nhất một hạng mục báo giá.'
    items.forEach((i, k) => {
      if (!i.itemName.trim()) e[`items.${k}.itemName`] = 'Nhập tên hạng mục.'
      if (!Number.isInteger(Number(i.quantity)) || Number(i.quantity) <= 0) e[`items.${k}.quantity`] = 'Số lượng là số nguyên lớn hơn 0.'
      if (!(Number(i.unitPrice) >= 0)) e[`items.${k}.unitPrice`] = 'Đơn giá không âm.'
    })
    if (items.length && totalOfItems(items) <= 0) e.items ??= 'Tổng tiền phải lớn hơn 0.'
    if (!(c.depositPercent > 0 && c.depositPercent < 100)) e.depositPercent = 'Tỷ lệ cọc lớn hơn 0 và nhỏ hơn 100 (%).'
    else if (ctx.deposit !== false && items.length && isDepositTooLarge(totalOfItems(items), c.depositPercent)) e.deposit = 'Tổng đơn quá nhỏ để đặt cọc.'
  }
  if (Object.keys(e).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Đơn chưa hợp lệ.', e)
  if (strict && !seeding && c.eventDate !== ctx.originalDate && c.eventDate < todayVN(at)) {
    throw new ApiError(422, 'EVENT_DATE_IN_PAST', 'Ngày diễn ra sự kiện phải từ hôm nay trở đi.', { eventDate: 'Ngày diễn ra sự kiện phải từ hôm nay trở đi.' })
  }
}

function applyItems(d: Data, o: Order, input: OrderItemInput[]) {
  o.items = keepItems(input).map<OrderItem>((i) => {
    const quantity = Math.max(0, Math.round(Number(i.quantity) || 0))
    const unitPrice = Math.max(0, Number(i.unitPrice) || 0)
    return { id: uid(d, 'oi'), itemName: i.itemName.trim(), unit: i.unit === 'Bàn' ? 'Bàn' : 'Gói', quantity, unitPrice, amount: quantity * unitPrice }
  })
  o.totalAmount = o.items.reduce((s, i) => s + i.amount, 0)
}

/** Ghi toàn bộ nội dung (đơn chưa cọc): tính lại tổng và tiền cọc. */
function applyContent(d: Data, o: Order, c: OrderContent) {
  o.customerName = c.customerName.trim()
  o.customerPhone = c.customerPhone.trim()
  o.eventDate = c.eventDate
  o.note = c.note?.trim() || null
  o.depositPercent = c.depositPercent > 0 && c.depositPercent < 100 ? c.depositPercent : 30
  applyItems(d, o, c.items)
  o.depositAmount = depositOf(o.totalAmount, o.depositPercent)
}

function pushMsg(d: Data, conversationId: string, sender: MessageSender, type: MessageType, content: string, orderId: string | null, at: Date | string) {
  const m: VendorMessage = {
    id: uid(d, 'm'),
    conversationId,
    sender,
    type,
    orderId,
    content,
    isRead: sender !== 'COUPLE',
    sentDate: typeof at === 'string' ? at : iso(at),
  }
  d.messages.push(m)
  return m
}

const findConversation = (d: Data, id: string) =>
  d.conversations.find((c) => c.id === id) ?? (() => { throw new ApiError(404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy hội thoại.') })()

const findOrder = (d: Data, id: string) =>
  d.orders.find((o) => o.id === id) ?? (() => { throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.') })()

// ---- Quy tắc nghiệp vụ (mọi hàm nhận `at` để dữ liệu mẫu và giả lập dùng chung) ----

function newDraft(d: Data, conversationId: string, c: OrderContent, at: Date): Order {
  const o: Order = {
    id: uid(d, 'ord'),
    orderCode: nextCode(d, 'order', at),
    conversationId,
    status: 'Draft',
    customerName: '',
    customerPhone: '',
    eventDate: c.eventDate,
    items: [],
    totalAmount: 0,
    depositPercent: 30,
    depositAmount: 0,
    depositDueDate: null,
    note: null,
    payment: null,
    revisions: [],
    invoices: [],
    completedDate: null,
    cancelledDate: null,
    cancelReason: null,
    cancelNote: null,
    createdDate: iso(at),
  }
  applyContent(d, o, c)
  d.orders.push(o)
  return o
}

/** Gửi lần đầu (Draft), hoặc "Cập nhật đơn" (Pending, NeedRevision). */
function sendOrder(d: Data, o: Order, c: OrderContent, at: Date) {
  if (!['Draft', 'Pending', 'NeedRevision'].includes(o.status)) {
    throw new ApiError(409, 'ORDER_NOT_SENDABLE', 'Đơn đã đặt cọc, hết hạn hoặc đã hủy nên không gửi lại được.')
  }
  const first = o.status === 'Draft'
  validate(c, true, at, { originalDate: first ? undefined : o.eventDate })
  if (!first && normalize(contentOf(o)) === normalize(c)) throw new ApiError(400, 'ORDER_NO_CHANGES', 'Chưa có thay đổi nào so với đơn đang gửi.')
  const oldTotal = o.totalAmount
  applyContent(d, o, c)
  if (!first) {
    const open = o.revisions.find((r) => r.revisionType === 'BeforeDeposit' && r.status === 'Requested')
    if (open) {
      open.status = 'Applied'
      open.newTotalAmount = o.totalAmount
      open.appliedDate = iso(at)
    } else {
      o.revisions.unshift({
        id: uid(d, 'rv'),
        revisionType: 'BeforeDeposit',
        requestNote: null,
        changes: [],
        oldTotalAmount: oldTotal,
        newTotalAmount: o.totalAmount,
        status: 'Applied',
        createdDate: iso(at),
        appliedDate: iso(at),
      })
    }
  }
  o.status = 'Pending'
  o.depositDueDate = iso(plusHours(at, 24))
  o.payment ??= { status: 'Unpaid', paidDate: null, transactionCode: null }
  pushMsg(d, o.conversationId, 'VENDOR', 'Order', `Đơn dịch vụ ${o.orderCode}`, o.id, at)
}

/**
 * Sửa đơn đã cọc: hạng mục, ngày, ghi chú; khóa tỷ lệ và tiền cọc; tổng mới không nhỏ hơn tiền đã cọc.
 * NCC ghi "nội dung thay đổi" (khách thấy): lưu một OrderRevisions AfterDeposit trạng thái Applied luôn.
 */
function editDeposited(d: Data, o: Order, c: OrderContent, changeNote: string, at: Date) {
  if (o.status !== 'Deposited') throw new ApiError(409, 'ORDER_NOT_EDITABLE', 'Chỉ sửa được đơn đã đặt cọc theo cách này.')
  if (!changeNote.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Cần ghi nội dung thay đổi để khách biết.', { changeNote: 'Nhập nội dung thay đổi.' })
  const merged: OrderContent = { ...contentOf(o), eventDate: c.eventDate, note: c.note, items: c.items }
  validate(merged, true, at, { originalDate: o.eventDate, deposit: false })
  if (normalize(contentOf(o)) === normalize(merged)) throw new ApiError(400, 'ORDER_NO_CHANGES', 'Chưa có thay đổi nào so với đơn hiện tại.')
  const newTotal = totalOfItems(keepItems(merged.items))
  if (newTotal < o.depositAmount) {
    throw new ApiError(400, 'ORDER_TOTAL_BELOW_DEPOSIT', `Tổng mới không được nhỏ hơn tiền đã cọc (${formatMoney(o.depositAmount)}).`)
  }
  const oldTotal = o.totalAmount
  o.eventDate = merged.eventDate
  o.note = merged.note?.trim() || null
  applyItems(d, o, merged.items)
  o.revisions.unshift({
    id: uid(d, 'rv'),
    revisionType: 'AfterDeposit',
    requestNote: changeNote.trim(),
    changes: [],
    oldTotalAmount: oldTotal,
    newTotalAmount: o.totalAmount,
    status: 'Applied',
    createdDate: iso(at),
    appliedDate: iso(at),
  })
  pushMsg(d, o.conversationId, 'VENDOR', 'Order', `Đơn dịch vụ ${o.orderCode} đã được cập nhật`, o.id, at)
}

/** Khách đặt cọc thành công qua VNPay. */
function payDeposit(d: Data, o: Order, at: Date) {
  if (o.status !== 'Pending') throw new ApiError(409, 'ORDER_NOT_PAYABLE', 'Đơn không ở trạng thái chờ thanh toán cọc.')
  if (o.depositDueDate && new Date(o.depositDueDate) < at) throw new ApiError(409, 'ORDER_NOT_PAYABLE', 'Đơn đã quá hạn đặt cọc.')
  o.payment = { status: 'Paid', paidDate: iso(at), transactionCode: `VNP${yymm(at)}${String(d.counter + 1).padStart(6, '0')}` }
  o.status = 'Deposited'
  const inv: Invoice = { id: uid(d, 'inv'), invoiceCode: nextCode(d, 'receipt', at), type: 'DepositReceipt', createdDate: iso(at) }
  o.invoices.push(inv)
  pushMsg(
    d,
    o.conversationId,
    'SYSTEM',
    'DepositReceipt',
    `Giấy xác nhận cọc ${inv.invoiceCode}: đã nhận ${formatMoney(o.depositAmount)} cho đơn ${o.orderCode}. Số còn lại ${formatMoney(o.totalAmount - o.depositAmount)} thanh toán trực tiếp với nhà cung cấp.`,
    o.id,
    at,
  )
}

/** Khách yêu cầu chỉnh sửa (chỉ trước cọc): đơn Pending thành NeedRevision. Sau cọc khách nhắn trong chat, không có yêu cầu. */
function requestRevision(d: Data, o: Order, changes: RevisionChangeType[], note: string, at: Date) {
  if (o.status !== 'Pending') throw new ApiError(409, 'ORDER_NOT_REVISABLE', 'Chỉ yêu cầu chỉnh sửa được đơn đang chờ đặt cọc.')
  const type = 'BeforeDeposit'
  if (o.revisions.some((r) => r.revisionType === type && r.status === 'Requested')) {
    throw new ApiError(409, 'REVISION_ALREADY_REQUESTED', 'Đơn đã có yêu cầu chỉnh sửa đang chờ.')
  }
  const rv: OrderRevision = {
    id: uid(d, 'rv'),
    revisionType: type,
    requestNote: note.trim() || null,
    changes,
    oldTotalAmount: o.totalAmount,
    newTotalAmount: null,
    status: 'Requested',
    createdDate: iso(at),
    appliedDate: null,
  }
  o.revisions.unshift(rv)
  o.status = 'NeedRevision'
  const what = changes.map((c) => CHANGE_LABEL[c]).join(', ')
  const detail = [what, rv.requestNote ? `"${rv.requestNote}"` : ''].filter(Boolean).join(' · ')
  pushMsg(d, o.conversationId, 'SYSTEM', 'Text', `Khách yêu cầu chỉnh sửa đơn ${o.orderCode}${detail ? `: ${detail}` : ''}`, o.id, at)
}

/** NCC hủy đơn đã cọc, chỉ khi hôm nay (giờ VN) còn trước EventDate. Không tính hoa hồng. */
function cancelOrder(d: Data, o: Order, reason: CancelReason, note: string | undefined, at: Date) {
  if (o.status !== 'Deposited' || !(todayVN(at) < o.eventDate)) {
    throw new ApiError(422, 'ORDER_NOT_CANCELLABLE', 'Chỉ hủy được đơn đã đặt cọc và chưa tới ngày diễn ra sự kiện.')
  }
  if (!CANCEL_REASONS.includes(reason)) throw new ApiError(400, 'VALIDATION_ERROR', 'Chọn lý do hủy đơn.', { reason: 'Chọn lý do hủy đơn.' })
  o.status = 'Cancelled'
  o.cancelledDate = iso(at)
  o.cancelReason = reason
  o.cancelNote = note?.trim() || null
  pushMsg(d, o.conversationId, 'SYSTEM', 'Text', `NCC đã hủy đơn ${o.orderCode} · Lý do: ${CANCEL_REASON[reason].label}${o.cancelNote ? ` · ${o.cancelNote}` : ''}`, o.id, at)
}

const firstOfMonth = (d: Date) => `${todayVN(d).slice(0, 7)}-01`
const dueDateOf = (periodMonth: string) => {
  const [y, m] = periodMonth.split('-').map(Number)
  return new Date(Date.UTC(y, m, COMMISSION_DUE_DAY)).toISOString().slice(0, 10)
}

/** Hoàn thành: ghi CompletedDate, tạo Commissions vào bảng kê của tháng chứa CompletedDate. */
function completeOrder(d: Data, o: Order, at: Date, categorySlug: string, completedAt: Date = at) {
  o.status = 'Completed'
  o.completedDate = iso(completedAt)
  const period = firstOfMonth(completedAt)
  let st = d.statements.find((s) => s.periodMonth === period)
  if (!st) {
    st = { id: uid(d, 'st'), periodMonth: period, dueDate: dueDateOf(period), totalOrders: 0, totalAmount: 0, transactionCode: null, status: 'Unpaid', paidDate: null, createdDate: iso(completedAt) }
    d.statements.push(st)
  }
  const rate = COMMISSION_RATE[categorySlug] ?? COMMISSION_RATE['nha-hang']
  const amount = Math.round((o.totalAmount * rate) / 100)
  d.commissions.push({ id: uid(d, 'cm'), orderId: o.id, statementId: st.id, orderAmount: o.totalAmount, rate, amount, createdDate: iso(completedAt) })
  st.totalOrders += 1
  st.totalAmount += amount
  pushMsg(d, o.conversationId, 'SYSTEM', 'Text', `Đơn ${o.orderCode} đã hoàn thành.`, o.id, completedAt)
}

function issueFinalInvoice(d: Data, o: Order, at: Date) {
  if (o.status !== 'Deposited' && o.status !== 'Completed') throw new ApiError(409, 'INVOICE_NOT_AVAILABLE', 'Chỉ xuất hóa đơn cuối cho đơn đã đặt cọc hoặc đã hoàn thành.')
  if (o.invoices.some((i) => i.type === 'FinalInvoice')) throw new ApiError(409, 'INVOICE_EXISTS', 'Đơn đã xuất hóa đơn cuối.')
  const inv: Invoice = { id: uid(d, 'inv'), invoiceCode: nextCode(d, 'final', at), type: 'FinalInvoice', createdDate: iso(at) }
  o.invoices.push(inv)
  pushMsg(
    d,
    o.conversationId,
    'VENDOR',
    'FinalInvoice',
    `Hóa đơn ${inv.invoiceCode} cho đơn ${o.orderCode}: tổng ${formatMoney(o.totalAmount)}, đã cọc ${formatMoney(o.depositAmount)}, đã thanh toán tiền mặt ${formatMoney(o.totalAmount - o.depositAmount)}.`,
    o.id,
    at,
  )
}

/** Việc backend tự chạy hằng ngày: hết hạn cọc, tự hoàn thành sau EventDate + 7 ngày. */
function runJobs(d: Data, at: Date, categorySlug: () => string) {
  for (const o of d.orders) {
    if (o.status === 'Pending' && o.depositDueDate && new Date(o.depositDueDate) < at) {
      o.status = 'Expired'
      pushMsg(d, o.conversationId, 'SYSTEM', 'Text', `Đơn ${o.orderCode} đã hết hạn đặt cọc.`, o.id, o.depositDueDate)
    }
  }
  const today = todayVN(at)
  for (const o of d.orders) {
    // Tự hoàn thành: CompletedDate là cuối ngày EventDate + 7 (giờ VN), không phải lúc mock chạy, nên hoa hồng vào đúng tháng
    if (o.status === 'Deposited' && today > addDaysYmd(o.eventDate, 7)) completeOrder(d, o, at, categorySlug(), new Date(`${addDaysYmd(o.eventDate, 7)}T23:59:00+07:00`))
  }
}

// ---- Dữ liệu mẫu ----

function seed(userId: string, n: Date): Data {
  seeding = true
  try {
    return buildSeed(userId, n)
  } finally {
    seeding = false
  }
}

function buildSeed(userId: string, n: Date): Data {
  const d: Data = { conversations: [], messages: [], orders: [], commissions: [], statements: [], counter: 0 }
  const slug = () => profileSlug(userId)
  const ago = (h: number) => plusHours(n, -h)
  const dayAgo = (days: number) => addDaysYmd(todayVN(n), -days)
  const dayIn = (days: number) => addDaysYmd(todayVN(n), days)
  const conv = (id: string, name: string, phone: string, noWedding = false) => {
    d.conversations.push({ id, customer: { name, phone }, ...(noWedding ? { noWedding } : {}) })
    return id
  }
  const couple = (c: string, h: number, text: string) => pushMsg(d, c, 'COUPLE', 'Text', text, null, ago(h))
  const vendor = (c: string, h: number, text: string) => pushMsg(d, c, 'VENDOR', 'Text', text, null, ago(h))
  const content = (name: string, phone: string, event: string, items: [string, 'Gói' | 'Bàn', number, number][], percent = 30, note: string | null = null): OrderContent => ({
    customerName: name,
    customerPhone: phone,
    eventDate: event,
    note,
    depositPercent: percent,
    items: items.map(([itemName, unit, quantity, unitPrice]) => ({ itemName, unit, quantity, unitPrice })),
  })
  /** Tạo bản nháp ở thời điểm `at`, gửi ở `sentAt` (nếu có). */
  const order = (convId: string, c: OrderContent, at: Date, sentAt?: Date) => {
    const o = newDraft(d, convId, c, at)
    if (sentAt) sendOrder(d, o, c, sentAt)
    return o
  }

  /** Tin khách gửi trước tin cuối của NCC/hệ thống coi như đã đọc; chỉ còn chưa đọc các tin khách gửi sau cùng. */
  const settle = () => {
    for (const c of d.conversations) {
      const msgs = d.messages.filter((m) => m.conversationId === c.id).sort(bySent)
      const lastOther = msgs.map((m) => m.sender !== 'COUPLE').lastIndexOf(true)
      msgs.forEach((m, i) => {
        if (m.sender === 'COUPLE' && i < lastOther) m.isRead = true
      })
    }
    return d
  }

  if (userId === 'u-vendor-2') {
    const s1 = conv('vc-s1', 'Minh Anh', '0901 234 567')
    couple(s1, 50, 'Chào studio, mình muốn chụp pre-wedding ở Đà Lạt vào tháng 11.')
    vendor(s1, 49, 'Chào bạn, studio có các gói chụp ngoại cảnh tại Đà Lạt. Bạn dự kiến chụp vào ngày nào?')
    couple(s1, 48, 'Khoảng ngày 25/11, ngân sách 20–30 triệu. Mình thích phong cách tự nhiên.')
    const s2 = conv('vc-s2', 'Hà My & Tuấn Anh', '0904 337 615')
    couple(s2, 130, 'Bên mình muốn đặt gói Pre-wedding đồi thông nhé.')
    const c2 = content('Hà My & Tuấn Anh', '0904 337 615', dayIn(12), [['Pre-wedding Đà Lạt 2 ngày', 'Gói', 1, 22_000_000]])
    const o2 = order(s2, c2, ago(120), ago(120))
    payDeposit(d, o2, ago(115))
    return settle()
  }

  // c1: chỉ có tin nhắn
  const c1 = conv('vc-1', 'Hồng Nhung & Tuấn Kiệt', '0905 112 233')
  couple(c1, 30, 'Chào Mây Palace, nhà mình dự kiến tổ chức khoảng 25 bàn vào 06/12. Sảnh tầng 2 còn trống không ạ?')

  // c2: Draft
  const c2 = conv('vc-2', 'Bảo Ngọc & Đức Anh', '0912 445 667')
  couple(c2, 42, 'Bên mình muốn đặt 15 bàn Menu B, ngày 20/12 nhé.')
  vendor(c2, 41, 'Dạ Mây Palace soạn báo giá và gửi anh chị trong hôm nay ạ.')
  order(c2, content('Bảo Ngọc & Đức Anh', '0912 445 667', dayIn(55), [['Tiệc cưới – Menu B', 'Bàn', 15, 3_200_000]]), ago(40))

  // c3: NeedRevision (khách yêu cầu chỉnh sửa trước cọc)
  const c3 = conv('vc-3', 'Minh Anh & Quốc Huy', '0901 234 567')
  couple(c3, 54, 'Chào Mây Palace, tụi mình đặt 20 bàn Menu A cho ngày 29/11 nhé.')
  const o3 = order(c3, content('Minh Anh & Quốc Huy', '0901 234 567', dayIn(35), [['Tiệc cưới – Menu A', 'Bàn', 20, 3_200_000]], 30, 'Giữ sảnh tầng 2.'), ago(52), ago(50))
  requestRevision(d, o3, ['Quantity', 'EventDate'], 'Giảm từ 20 xuống 15 bàn, đổi sang ngày 20/12 nhé.', ago(44))

  // c4: Pending, chỉ còn khoảng 3 giờ nữa là hết hạn cọc
  const c4 = conv('vc-4', 'Thu Hà & Đức Minh', '0938 221 904')
  couple(c4, 23, 'Nhà mình chốt 18 bàn Menu A ngày 13/12 nha.')
  order(c4, content('Thu Hà & Đức Minh', '0938 221 904', dayIn(49), [['Tiệc cưới – Menu A', 'Bàn', 18, 3_200_000]]), ago(22), ago(21))

  // c5: Pending sau khi sửa và gửi lại (có hai thẻ, thẻ cũ thu gọn)
  const c5 = conv('vc-5', 'Ngọc Mai & Hoàng Nam', '0966 802 117')
  couple(c5, 74, 'Cho mình đặt 25 bàn Menu A ngày 26/12 nhé.')
  const o5 = order(c5, content('Ngọc Mai & Hoàng Nam', '0966 802 117', dayIn(62), [['Tiệc cưới – Menu A', 'Bàn', 25, 3_200_000]]), ago(72), ago(70))
  requestRevision(d, o5, ['Quantity'], 'Cho mình giảm còn 22 bàn nhé.', ago(60))
  sendOrder(d, o5, content('Ngọc Mai & Hoàng Nam', '0966 802 117', dayIn(62), [['Tiệc cưới – Menu A', 'Bàn', 22, 3_200_000]]), ago(3))

  // c6: Deposited, khách nhắn xin tăng số bàn (sau cọc khách chỉ nhắn trong chat, NCC tự chỉnh sửa)
  const c6 = conv('vc-6', 'Hải Yến & Anh Tuấn', '0945 678 901')
  couple(c6, 122, 'Tụi mình đặt 20 bàn Menu A cho ngày cưới nhé.')
  const o6 = order(c6, content('Hải Yến & Anh Tuấn', '0945 678 901', dayIn(20), [['Tiệc cưới – Menu A', 'Bàn', 20, 3_200_000]]), ago(121), ago(120))
  payDeposit(d, o6, ago(115))
  couple(c6, 20, 'Cho nhà mình tăng từ 20 lên 22 bàn nhé.')

  // c7: Deposited, đã qua ngày sự kiện 2 ngày: NCC đánh dấu hoàn thành được
  const c7 = conv('vc-7', 'Phương Linh & Minh Khôi', '0987 123 456')
  const o7 = order(c7, content('Phương Linh & Minh Khôi', '0987 123 456', dayAgo(2), [['Tiệc cưới – Menu A', 'Bàn', 24, 3_200_000]]), ago(24 * 31), ago(24 * 30))
  payDeposit(d, o7, ago(24 * 30 - 5))
  couple(c7, 24 * 2 + 3, 'Cảm ơn Mây Palace, tiệc rất thành công ạ!')

  // c8: Deposited, NCC đã sửa đơn sau cọc (tăng số bàn)
  const c8 = conv('vc-8', 'Quỳnh Anh & Đức Long', '0909 555 321')
  const o8 = order(c8, content('Quỳnh Anh & Đức Long', '0909 555 321', dayIn(35), [['Tiệc cưới – Menu A', 'Bàn', 20, 3_200_000]]), ago(24 * 13), ago(24 * 12))
  payDeposit(d, o8, ago(24 * 12 - 5))
  editDeposited(d, o8, content('Quỳnh Anh & Đức Long', '0909 555 321', dayIn(35), [['Tiệc cưới – Menu A', 'Bàn', 22, 3_200_000]], 30, 'Thêm 2 bàn theo yêu cầu.'), 'Tăng từ 20 lên 22 bàn theo yêu cầu của khách.', ago(24 * 3))

  // c9: Expired (khách không cọc kịp): NCC tạo đơn mới từ đơn này
  const c9 = conv('vc-9', 'Thanh Trúc & Gia Bảo', '0911 222 333')
  couple(c9, 24 * 3 + 4, 'Mình sẽ chuyển cọc trong tuần này nhé.')
  order(c9, content('Thanh Trúc & Gia Bảo', '0911 222 333', dayIn(40), [['Tiệc cưới – Menu B', 'Bàn', 16, 3_000_000]]), ago(24 * 3 + 2), ago(24 * 3))

  // c10: Cancelled (NCC hủy theo yêu cầu của khách, khách mất cọc)
  const c10 = conv('vc-10', 'Thùy Dung & Văn Khoa', '0966 802 117')
  const o10 = order(c10, content('Thùy Dung & Văn Khoa', '0966 802 117', dayIn(12), [['Tiệc cưới – Menu A', 'Bàn', 12, 3_200_000]]), ago(24 * 26), ago(24 * 25))
  payDeposit(d, o10, ago(24 * 25 - 5))
  cancelOrder(d, o10, 'CUSTOMER_REQUEST', 'Khách báo không tổ chức nữa.', ago(24 * 2))

  // c11 đến c13: đã hoàn thành ở các tháng trước (tạo hoa hồng, bảng kê)
  const done = (id: string, name: string, phone: string, eventAgo: number, tables: number, withFinalInvoice: boolean) => {
    const c = conv(id, name, phone)
    const event = dayAgo(eventAgo)
    const o = order(c, content(name, phone, event, [['Tiệc cưới – Menu A', 'Bàn', tables, 3_200_000]]), ago(24 * (eventAgo + 32)), ago(24 * (eventAgo + 31)))
    payDeposit(d, o, ago(24 * (eventAgo + 31) - 5))
    const completeAt = new Date(`${addDaysYmd(event, 8)}T10:00:00+07:00`)
    if (withFinalInvoice) issueFinalInvoice(d, o, new Date(completeAt.getTime() - 24 * HOUR))
    completeOrder(d, o, completeAt, slug())
  }
  done('vc-11', 'Lan Hương & Minh Đức', '0912 678 345', 40, 18, true)
  done('vc-12', 'Diệu Linh & Hữu Phước', '0938 221 905', 75, 20, false)
  done('vc-13', 'Bích Ngọc & Thành Công', '0971 450 812', 20, 25, false)

  // Bảng kê của các tháng cũ (trước tháng trước) đã nộp
  const prev = firstOfMonth(plusHours(n, -24 * 31))
  for (const s of d.statements) {
    if (s.periodMonth < prev) {
      s.status = 'Paid'
      s.paidDate = new Date(`${addDaysYmd(s.dueDate, -3)}T09:00:00+07:00`).toISOString()
      s.transactionCode = `VNP${s.periodMonth.slice(2, 4)}${s.periodMonth.slice(5, 7)}${String(s.id.split('-')[1]).padStart(6, '0')}`
    }
  }

  // c19: khách thiếu số điện thoại (tài khoản chưa nhập); c20: khách chưa có thông tin đám cưới
  const c19 = conv('vc-19', 'Thu Trang & Quốc Anh', '')
  couple(c19, 30, 'Chào Mây Palace, nhà mình cưới ngày 17/01/2027, khoảng 20 bàn. Cho mình xin báo giá với ạ.')
  const c20 = conv('vc-20', 'Phạm Ngọc Lan', '0933 400 500', true)
  couple(c20, 28, 'Mình đang tìm nhà hàng, cho mình hỏi bên mình còn lịch cuối năm không ạ?')

  return settle()
}

// ---- Lưu trữ ----

function loadAll(): Record<string, Data> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Data>
  } catch {
    return {}
  }
}

/** Lĩnh vực của NCC (để chọn tỷ lệ hoa hồng); chưa có hồ sơ thì dùng Nhà hàng. */
function profileSlug(userId: string) {
  try {
    return mockVendors.getMyProfile(userId).category?.slug ?? 'nha-hang'
  } catch {
    return 'nha-hang'
  }
}

/** Đọc dữ liệu của NCC (lần đầu thì tạo dữ liệu mẫu), chạy việc tự động theo đồng hồ, chạy fn, lưu lại. */
function withData<T>(userId: string, fn: (d: Data, at: Date) => T): T {
  const all = loadAll()
  const at = now()
  all[userId] ??= seed(userId, at)
  const d = all[userId]
  try {
    runJobs(d, at, () => profileSlug(userId))
    return structuredClone(fn(d, at))
  } finally {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    } catch {
      // bỏ qua
    }
  }
}

function summarize(d: Data, c: StoredConversation): VendorConversation {
  const msgs = d.messages.filter((m) => m.conversationId === c.id).sort(bySent)
  const last = msgs[msgs.length - 1]
  const orders = d.orders.filter((o) => o.conversationId === c.id)
  const sent = orders.filter((o) => o.status !== 'Draft').sort((a, b) => b.createdDate.localeCompare(a.createdDate))
  const today = todayVN()
  const needsAction = orders.some(
    (o) =>
      o.status === 'Draft' ||
      o.status === 'NeedRevision' ||
      (o.status === 'Deposited' && today > o.eventDate),
  )
  return {
    id: c.id,
    customer: { ...c.customer },
    unreadCount: msgs.filter((m) => m.sender === 'COUPLE' && !m.isRead).length,
    lastMessage: last
      ? { sender: last.sender, type: last.type, content: last.content, orderCode: d.orders.find((o) => o.id === last.orderId)?.orderCode ?? null, sentDate: last.sentDate }
      : null,
    latestOrder: sent[0] ? { id: sent[0].id, orderCode: sent[0].orderCode, status: sent[0].status } : null,
    hasDraftOrder: orders.some((o) => o.status === 'Draft'),
    needsAction,
    orderCodes: orders.map((o) => o.orderCode),
  }
}

const SIM_TEXTS = ['Giá này đã gồm VAT chưa ạ?', 'Bên mình cho xem thực đơn chi tiết với nhé.', 'Nhà mình muốn đi xem sảnh cuối tuần này được không ạ?']

export const mockVendorOrders = {
  // ---- Hội thoại, tin nhắn ----
  listConversations(userId: string): VendorConversation[] {
    return withData(userId, (d) =>
      d.conversations.map((c) => summarize(d, c)).sort((a, b) => (b.lastMessage?.sentDate ?? '').localeCompare(a.lastMessage?.sentDate ?? '')),
    )
  },

  listMessages(userId: string, conversationId: string): VendorMessage[] {
    return withData(userId, (d) => {
      findConversation(d, conversationId)
      return d.messages.filter((m) => m.conversationId === conversationId).sort(bySent)
    })
  },

  markRead(userId: string, conversationId: string) {
    withData(userId, (d) => {
      findConversation(d, conversationId)
      d.messages.filter((m) => m.conversationId === conversationId && m.sender === 'COUPLE').forEach((m) => (m.isRead = true))
    })
  },

  sendMessage(userId: string, conversationId: string, text: string): VendorMessage {
    if (!text.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Nhập nội dung tin nhắn.')
    return withData(userId, (d, at) => {
      findConversation(d, conversationId)
      return pushMsg(d, conversationId, 'VENDOR', 'Text', text.trim(), null, at)
    })
  },

  // ---- Đơn ----
  listOrders(userId: string, q: OrderListQuery): Paginated<Order> {
    return withData(userId, (d) => {
      const k = (q.q ?? '').trim().toLowerCase()
      const digits = k.replace(/\D/g, '')
      const all = d.orders
        .filter(
          (o) =>
            (!q.status || o.status === q.status) &&
            (!q.conversationId || o.conversationId === q.conversationId) &&
            (!q.from || o.eventDate >= q.from) &&
            (!q.to || o.eventDate <= q.to) &&
            (!q.depositFrom || (o.payment?.status === 'Paid' && !!o.payment.paidDate && todayVN(new Date(o.payment.paidDate)) >= q.depositFrom)) &&
            (!q.depositTo || (o.payment?.status === 'Paid' && !!o.payment.paidDate && todayVN(new Date(o.payment.paidDate)) <= q.depositTo)) &&
            (!k || o.orderCode.toLowerCase().includes(k) || o.customerName.toLowerCase().includes(k) || (digits.length >= 3 && o.customerPhone.replace(/\D/g, '').includes(digits))),
        )
        .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
      const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20))
      const totalPages = Math.max(1, Math.ceil(all.length / pageSize))
      const page = Math.min(Math.max(1, q.page ?? 1), totalPages)
      return { data: all.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total: all.length, totalPages } }
    })
  },

  orderCounts(userId: string): Record<OrderStatus, number> {
    return withData(userId, (d) => Object.fromEntries(ORDER_STATUSES.map((s) => [s, d.orders.filter((o) => o.status === s).length])) as Record<OrderStatus, number>)
  },

  getOrder(userId: string, orderId: string): Order {
    return withData(userId, (d) => findOrder(d, orderId))
  },

  /** Tạo đơn trong hội thoại: send = false lưu nháp, true gửi luôn. */
  createOrder(userId: string, body: { conversationId: string; content: OrderContent; send: boolean }): Order {
    return withData(userId, (d, at) => {
      const conv = findConversation(d, body.conversationId)
      // Như BE: đơn gắn với đám cưới của khách (suy từ hội thoại), chưa có thì không tạo được
      if (conv.noWedding) throw new ApiError(409, 'WEDDING_NOT_SET', 'Khách chưa thiết lập thông tin đám cưới nên chưa tạo được đơn.')
      validate(body.content, body.send, at)
      const o = newDraft(d, conv.id, body.content, at)
      if (body.send) sendOrder(d, o, body.content, at)
      return o
    })
  },

  saveDraft(userId: string, orderId: string, content: OrderContent): Order {
    return withData(userId, (d, at) => {
      const o = findOrder(d, orderId)
      if (o.status !== 'Draft') throw new ApiError(409, 'ORDER_NOT_DRAFT', 'Chỉ lưu nháp được đơn chưa gửi.')
      validate(content, false, at)
      applyContent(d, o, content)
      return o
    })
  },

  /** Gửi lần đầu, hoặc "Cập nhật đơn" khi đang chờ cọc hoặc khách yêu cầu chỉnh sửa. */
  sendOrder(userId: string, orderId: string, content: OrderContent): Order {
    return withData(userId, (d, at) => {
      const o = findOrder(d, orderId)
      // Như BE: gửi bản nháp cũng cần khách đã có thông tin đám cưới (đơn gắn với đám cưới của khách)
      if (o.status === 'Draft' && findConversation(d, o.conversationId).noWedding) {
        throw new ApiError(409, 'WEDDING_NOT_SET', 'Khách chưa thiết lập thông tin đám cưới nên chưa gửi được đơn.')
      }
      sendOrder(d, o, content, at)
      return o
    })
  },

  /** Sửa đơn đã cọc. */
  editDeposited(userId: string, orderId: string, content: OrderContent, changeNote: string): Order {
    return withData(userId, (d, at) => {
      const o = findOrder(d, orderId)
      editDeposited(d, o, content, changeNote, at)
      return o
    })
  },

  /** NCC hủy đơn đã cọc (trước ngày sự kiện). */
  cancelOrder(userId: string, orderId: string, body: { reason: CancelReason; note?: string }): Order {
    return withData(userId, (d, at) => {
      const o = findOrder(d, orderId)
      cancelOrder(d, o, body.reason, body.note, at)
      return o
    })
  },

  completeOrder(userId: string, orderId: string): Order {
    return withData(userId, (d, at) => {
      const o = findOrder(d, orderId)
      if (o.status !== 'Deposited') throw new ApiError(409, 'ORDER_NOT_COMPLETABLE', 'Chỉ đánh dấu hoàn thành được đơn đã đặt cọc.')
      if (!(todayVN(at) > o.eventDate)) throw new ApiError(409, 'ORDER_EVENT_NOT_PASSED', 'Chỉ đánh dấu hoàn thành được sau ngày diễn ra sự kiện.')
      completeOrder(d, o, at, profileSlug(userId))
      return o
    })
  },

  issueFinalInvoice(userId: string, orderId: string): Order {
    return withData(userId, (d, at) => {
      const o = findOrder(d, orderId)
      issueFinalInvoice(d, o, at)
      return o
    })
  },

  // ---- Dữ liệu cho hoa hồng (API hoa hồng đọc từ đây) ----
  commissionData(userId: string): { statements: StoredStatement[]; commissions: StoredCommission[]; orders: Order[] } {
    return withData(userId, (d) => ({ statements: d.statements, commissions: d.commissions, orders: d.orders }))
  },

  /** Nộp hoa hồng cả bảng kê qua VNPay (mô phỏng thành công). Kỳ đang tạm tính chưa nộp được. */
  payStatement(userId: string, statementId: string): StoredStatement {
    return withData(userId, (d, at) => {
      const st = d.statements.find((x) => x.id === statementId)
      if (!st) throw new ApiError(404, 'COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.')
      if (st.status === 'Paid') throw new ApiError(409, 'COMMISSION_ALREADY_PAID', 'Bảng kê này đã nộp.')
      if (st.periodMonth.slice(0, 7) >= todayVN(at).slice(0, 7)) throw new ApiError(409, 'COMMISSION_NOT_PAYABLE', 'Kỳ hiện tại đang tạm tính, chưa nộp được.')
      st.status = 'Paid'
      st.paidDate = iso(at)
      st.transactionCode = `VNP${yymm(at)}${String(++d.counter).padStart(6, '0')}`
      return st
    })
  },

  // ---- Chỉ có ở dữ liệu giả ----
  /** Giả lập việc khách làm trên đơn mới nhất phù hợp của hội thoại. */
  simulate(userId: string, conversationId: string, sim: CustomerSimulation) {
    withData(userId, (d, at) => {
      findConversation(d, conversationId)
      if (sim.action === 'MESSAGE') {
        pushMsg(d, conversationId, 'COUPLE', 'Text', SIM_TEXTS[d.messages.length % SIM_TEXTS.length], null, at)
        return
      }
      // Khách chỉ đặt cọc hoặc yêu cầu chỉnh sửa khi đơn đang chờ cọc; sau cọc khách nhắn trong chat
      const o = d.orders.filter((x) => x.conversationId === conversationId && x.status === 'Pending').sort((a, b) => b.createdDate.localeCompare(a.createdDate))[0]
      if (!o) throw new ApiError(409, 'SIMULATION_NOT_APPLICABLE', 'Không có đơn phù hợp để giả lập.')
      if (sim.action === 'PAY_DEPOSIT') payDeposit(d, o, at)
      else requestRevision(d, o, sim.changes, sim.note, at)
    })
  },
}
