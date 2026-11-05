import { Filter, Receipt, Search, Send } from 'lucide-react'
import { effectiveSender } from '../messageSender'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { useCategories } from '@/features/catalog/hooks'
import { OrderCard } from '@/features/orders/components/OrderCard'
import { ReviseOrderDialog } from '@/features/orders/components/ReviseOrderDialog'
import { useOrder } from '@/features/orders/hooks'
import { InvoiceDialog } from '@/features/vendorOrders/components/InvoiceDialog'
import { formatStamp } from '@/features/vendorOrders/calc'
import { formatMessageTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { Conversation, Message } from '@/types/chat'
import type { Order, OrderStatus } from '@/types/order'
import { useMarkReadOnView, useMessages, useSendMessage } from '../hooks'
import { coupleWording } from '../wording'
import { shortVendorName } from '@/lib/vendorName'
import { usePlan } from '@/features/weddings/hooks'
import { chosenPackageName, quickReplies } from '../quickReplies'
import { QuickReplyChips } from './QuickReplyChips'

interface ChatViewProps {
  conversations: Conversation[]
  activeId: string
  onSelect: (id: string) => void
}

const preview = (c: Conversation) => (c.lastMessage ? (c.lastMessage.type === 'Order' ? 'Đã gửi đơn dịch vụ' : coupleWording(c.lastMessage.content, c.service.name)) : '')

/** Nhãn ngắn theo đơn mới nhất với NCC (docs/THE_DON_PHIA_KHACH.md mục 5); Chờ cọc còn dưới 6 giờ thì có chấm đỏ. */
const ORDER_BADGE: Partial<Record<OrderStatus, { label: string; tone: BadgeTone }>> = {
  Pending: { label: 'Chờ cọc', tone: 'wait' },
  NeedRevision: { label: 'Chờ chỉnh sửa', tone: 'warn' },
  Deposited: { label: 'Đã cọc', tone: 'done' },
  Completed: { label: 'Hoàn thành', tone: 'info' },
  Expired: { label: 'Hết hạn', tone: 'neutral' },
  Cancelled: { label: 'Đã hủy', tone: 'warn' },
}

function orderBadge(c: Conversation) {
  const o = c.latestOrder
  const b = o && ORDER_BADGE[o.status]
  if (!o || !b) return null
  const urgent = o.status === 'Pending' && !!o.depositDueDate && new Date(o.depositDueDate).getTime() - Date.now() < 6 * 3_600_000
  return { ...b, urgent }
}

/** Độ rộng cột danh sách hội thoại (máy tính): mặc định, giới hạn kéo, khóa lưu trong trình duyệt */
const INBOX_W = {
  def: 400,
  min: 300,
  max: 560,
  key: 'forever.chat.inboxWidth',
}
const clampW = (w: number) => Math.min(INBOX_W.max, Math.max(INBOX_W.min, Math.round(w)))
function savedWidth() {
  try {
    const v = Number(localStorage.getItem(INBOX_W.key))
    return v ? clampW(v) : INBOX_W.def
  } catch {
    return INBOX_W.def
  }
}

/**
 * Cột danh sách hội thoại kéo rộng / hẹp được (thanh mảnh ở mép phải, chỉ máy tính): kéo chuột, hoặc focus rồi dùng phím ← →;
 * bấm đúp để về mặc định. Độ rộng nhớ theo trình duyệt.
 */
function useInboxWidth() {
  const [width, setWidth] = useState(savedWidth)
  const save = (w: number) => {
    setWidth(w)
    try {
      localStorage.setItem(INBOX_W.key, String(w))
    } catch {
      /* trình duyệt chặn lưu: chỉ giữ trong phiên */
    }
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const left = e.currentTarget.parentElement!.getBoundingClientRect().left
    let last = width
    const move = (ev: PointerEvent) => setWidth((last = clampW(ev.clientX - left)))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      save(last)
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 16
    if (e.key === 'ArrowLeft') save(clampW(width - step))
    else if (e.key === 'ArrowRight') save(clampW(width + step))
    else return
    e.preventDefault()
  }
  return { width, onPointerDown, onKeyDown, reset: () => save(INBOX_W.def) }
}

/** Hộp thư: danh sách hội thoại + khung trò chuyện (renderChat trong prototype). */
export function ChatView({ conversations, activeId, onSelect }: ChatViewProps) {
  const active = conversations.find((c) => c.id === activeId) ?? conversations[0]
  const inbox = useInboxWidth()
  return (
    <div
      style={{ '--inbox-w': `${inbox.width}px` } as CSSProperties}
      className="relative grid h-[calc(100dvh-142px)] max-h-[900px] min-h-[610px] grid-cols-[var(--inbox-w)_minmax(0,1fr)] overflow-hidden rounded-[26px] bg-surface shadow-panel max-[900px]:h-[calc(100dvh-170px)] max-[900px]:min-h-[560px] max-[900px]:grid-cols-[260px_minmax(0,1fr)] max-[640px]:h-auto max-[640px]:max-h-none max-[640px]:grid-cols-1"
    >
      <Inbox conversations={conversations} activeId={active.id} onSelect={onSelect} />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo để đổi độ rộng danh sách hội thoại"
        aria-valuemin={INBOX_W.min}
        aria-valuemax={INBOX_W.max}
        aria-valuenow={inbox.width}
        tabIndex={0}
        title="Kéo để đổi độ rộng (bấm đúp để về mặc định)"
        onPointerDown={inbox.onPointerDown}
        onKeyDown={inbox.onKeyDown}
        onDoubleClick={inbox.reset}
        style={{ left: 'calc(var(--inbox-w) - 4px)' }}
        className="group absolute inset-y-0 z-10 w-2 cursor-col-resize outline-none max-[900px]:hidden"
      >
        <span className="mx-auto block h-full w-px bg-transparent transition-colors group-hover:bg-gold-700/50 group-focus-visible:bg-gold-700 group-active:bg-gold-700" />
      </div>
      <Thread key={active.id} conversation={active} />
    </div>
  )
}

function Inbox({ conversations, activeId, onSelect }: ChatViewProps) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const { data: categories = [] } = useCategories()

  // Bấm ra ngoài hoặc Esc thì đóng menu lọc
  useEffect(() => {
    if (!filterOpen) return
    const onDown = (e: MouseEvent) => !filterRef.current?.contains(e.target as Node) && setFilterOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFilterOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [filterOpen])
  // Lọc theo dịch vụ: chỉ các hạng mục đang có hội thoại, theo thứ tự danh mục
  const options = categories
    .filter((cat) => conversations.some((c) => c.service.category.slug === cat.slug))
    .map((cat) => ({ value: cat.slug, label: cat.name, count: conversations.filter((c) => c.service.category.slug === cat.slug).length }))
  const categoryName = options.find((o) => o.value === category)?.label
  const keyword = q.trim().toLowerCase()
  const shown = conversations.filter(
    (c) => (!category || c.service.category.slug === category) && (!keyword || `${c.service.name} ${c.service.category.name} ${preview(c)}`.toLowerCase().includes(keyword)),
  )

  return (
    <aside aria-label="Danh sách hội thoại" className="overflow-auto border-r border-line px-3 py-4 max-[900px]:px-1.5 max-[900px]:py-2.5 max-[640px]:max-h-[210px] max-[640px]:border-r-0 max-[640px]:border-b">
      <div ref={filterRef} className="relative mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm kiếm đối tác..."
            aria-label="Tìm kiếm đối tác"
            className="w-full rounded-pill border-0 bg-bg py-3 pr-3.5 pl-9 text-sm text-ink outline-none focus:outline-1 focus:outline-primary"
          />
        </div>
        <button
          type="button"
          aria-label="Lọc theo dịch vụ"
          title="Lọc theo dịch vụ"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((o) => !o)}
          className={cn('grid size-[42px] shrink-0 place-items-center rounded-full border border-line bg-surface text-muted-foreground', category && 'border-primary text-gold-700')}
        >
          <Filter className="size-[18px]" />
        </button>
        {filterOpen && (
          <div role="menu" className="absolute top-full right-0 z-10 mt-1 w-52 rounded-md border border-line bg-surface p-1 shadow-card">
            {[{ value: '', label: 'Tất cả dịch vụ', count: conversations.length }, ...options].map(({ value, label, count }) => (
              <button
                key={value || 'all'}
                type="button"
                role="menuitemradio"
                aria-checked={category === value}
                onClick={() => {
                  setCategory(value)
                  setFilterOpen(false)
                }}
                className={cn('flex w-full justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent-soft', category === value && 'font-semibold text-gold')}
              >
                {label}
                <span className="text-xs text-muted-foreground">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-between gap-2 px-2 pb-3 text-xs text-muted-foreground">
        <span>{shown.length} hội thoại</span>
        <span>{categoryName ?? 'Tất cả dịch vụ'}</span>
      </div>
      {shown.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-current={c.id === activeId}
          onClick={() => onSelect(c.id)}
          className={cn(
            'mb-[5px] grid w-full grid-cols-[48px_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-2.5 gap-y-[3px] rounded-[18px] px-2.5 py-[13px] text-left text-ink max-[640px]:p-[9px]',
            c.id === activeId && 'bg-accent-soft shadow-[inset_4px_0_var(--accent)]',
          )}
        >
          <img src={c.service.coverImageUrl} alt="" className="row-span-2 size-[46px] rounded-full bg-accent-soft object-cover" />
          <span className="flex min-w-0 items-center gap-1.5">
            <b className="truncate text-[13px] font-semibold" title={c.service.name}>
              {shortVendorName(c.service.name)}
            </b>
            {(() => {
              const b = orderBadge(c)
              return (
                b && (
                  <Badge tone={b.tone} className="shrink-0 px-2 py-px text-[10px]">
                    {b.urgent && <span aria-label="Sắp hết hạn cọc" className="size-1.5 rounded-full bg-notify" />}
                    {b.label}
                  </Badge>
                )
              )
            })()}
          </span>
          <span className="text-[11px] whitespace-nowrap text-muted-foreground">{c.lastMessage ? formatMessageTime(c.lastMessage.sentDate) : ''}</span>
          <span className={cn('truncate text-[11px] text-muted-foreground', c.unreadCount > 0 && c.id !== activeId ? 'font-semibold text-ink' : 'col-span-2')}>{preview(c)}</span>
          {c.unreadCount > 0 && c.id !== activeId && (
            <span aria-label={`${c.unreadCount} tin chưa đọc`} className="grid h-[18px] min-w-[18px] place-items-center justify-self-end rounded-pill bg-notify px-1 text-[10px] font-bold text-white">
              {c.unreadCount}
            </span>
          )}
        </button>
      ))}
    </aside>
  )
}

function Thread({ conversation }: { conversation: Conversation }) {
  const { data: messages = [] } = useMessages(conversation.id)
  useMarkReadOnView(conversation.id, messages)
  const send = useSendMessage(conversation.id)
  const [text, setText] = useState('')
  const [revising, setRevising] = useState<Order | null>(null)
  // Câu soạn sẵn như khung chat nổi: theo đơn mới nhất, nhắc tên gói khách đã chọn trong kế hoạch
  const { data: plan } = usePlan()
  const chips = quickReplies({
    order: conversation.latestOrder ?? null,
    categorySlug: conversation.service.category.slug,
    packageName: chosenPackageName(plan?.items.find((i) => i.service.id === conversation.service.id)),
  })
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Thẻ mới nhất của từng đơn: gửi lại thì các thẻ cũ thu gọn
  const latestCard = new Map<string, string>()
  for (const m of messages) if (m.type === 'Order' && m.orderId) latestCard.set(m.orderId, m.id)

  // Có tin mới thì cuộn xuống cuối
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    send.mutate(t, { onSuccess: () => setText('') })
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col max-[640px]:min-h-[520px]">
      <header className="flex min-h-[82px] items-center gap-3 border-b border-line-soft px-6 py-4 max-[900px]:p-3">
        <img src={conversation.service.coverImageUrl} alt="" className="size-[46px] shrink-0 rounded-full object-cover" />
        <div className="min-w-0">
          <div className="truncate font-semibold" title={conversation.service.name}>
            {shortVendorName(conversation.service.name)}
          </div>
          <div className="mt-[3px] text-xs text-muted-foreground max-[640px]:hidden">
            {/* Không có trạng thái trực tuyến thật của NCC nên không ghi "Trực tuyến" */}
            {conversation.service.category.name}
          </div>
        </div>
        <Button asChild variant="outline" className="ml-auto rounded-pill whitespace-nowrap max-[900px]:px-1.5 max-[900px]:text-[11px] max-[640px]:hidden">
          <Link to={paths.serviceDetail(conversation.service.id)}>Xem dịch vụ ›</Link>
        </Button>
      </header>

      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-surface px-7 py-6 max-[900px]:p-4 max-[640px]:h-[360px] max-[640px]:flex-none">
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            conversation={conversation}
            isLatestCard={!m.orderId || latestCard.get(m.orderId) === m.id}
            onRevise={setRevising}
            onMessageVendor={() => inputRef.current?.focus()}
          />
        ))}
      </div>

      <div className="border-t border-line-soft bg-surface px-6 pt-3 pb-[18px] max-[900px]:px-4">
        <QuickReplyChips
          chips={chips}
          onPick={(t) => {
            setText(t)
            inputRef.current?.focus()
          }}
          className="mb-2.5"
        />
        <form onSubmit={submit} className="flex items-center gap-2.5">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhập tin nhắn..."
            aria-label="Tin nhắn"
            className="min-w-0 flex-1 rounded-pill border-0 bg-bg px-[18px] py-[15px] text-[15px] text-ink outline-none focus:outline-1 focus:outline-primary"
          />
          <Button type="submit" size="icon" aria-label="Gửi tin nhắn" title="Gửi tin nhắn" disabled={send.isPending} className="size-12 rounded-full">
            <Send className="size-[19px]" />
          </Button>
        </form>
      </div>

      <ReviseOrderDialog order={revising} onClose={() => setRevising(null)} />
    </section>
  )
}

function MessageItem({
  message,
  conversation,
  isLatestCard,
  onRevise,
  onMessageVendor,
}: {
  message: Message
  conversation: Conversation
  isLatestCard: boolean
  onRevise: (o: Order) => void
  onMessageVendor: () => void
}) {
  const categorySlug = conversation.service.category.slug
  if (message.type === 'Order' && message.orderId) {
    return <OrderCard orderId={message.orderId} categorySlug={categorySlug} isLatest={isLatestCard} onRevise={onRevise} onMessageVendor={onMessageVendor} />
  }
  if ((message.type === 'DepositReceipt' || message.type === 'FinalInvoice') && message.orderId) {
    return <ReceiptCard message={message} vendorName={conversation.service.name} />
  }
  const base = 'max-w-[78%] rounded-[20px] px-[15px] py-[11px] text-[13px] whitespace-pre-wrap [overflow-wrap:anywhere] max-[640px]:max-w-[94%]'
  const time = <time className="mt-1 px-1 text-[11px] text-muted-foreground">{formatStamp(message.sentDate)}</time>
  if (message.sender === 'SYSTEM')
    return (
      <div className="flex flex-col items-center">
        <div className={cn(base, 'bg-sage-soft text-sage')}>{coupleWording(message.content, conversation.service.name)}</div>
        {time}
      </div>
    )
  if (message.sender === 'COUPLE')
    return (
      <div className="flex flex-col items-end">
        <div className={cn(base, 'rounded-br-[5px] bg-primary text-primary-foreground')}>{message.content}</div>
        {time}
      </div>
    )
  return (
    <div className="flex flex-col items-start">
      <div className={cn(base, 'rounded-bl-[5px] bg-bg text-nav')}>{message.content}</div>
      {time}
    </div>
  )
}

/** Thẻ Giấy xác nhận cọc / Hóa đơn cuối trong chat, có nút Xem (docs/THE_DON_PHIA_KHACH.md mục 4). */
function ReceiptCard({ message, vendorName }: { message: Message; vendorName: string }) {
  const { data: order } = useOrder(message.orderId ?? '')
  const [open, setOpen] = useState(false)
  const type = message.type === 'FinalInvoice' ? 'FinalInvoice' : 'DepositReceipt'
  // Suy theo loại tin: giấy xác nhận cọc là tin hệ thống GIỮA khung ("Forever xác nhận"); hóa đơn cuối của NCC bên TRÁI kèm tên NCC
  const system = effectiveSender(message) === 'SYSTEM'
  return (
    <div className={cn('flex flex-col', system ? 'items-center self-center' : 'items-start self-start')}>
    <div
      className={cn(
        'w-[min(360px,100%)] border px-4 py-3',
        system ? 'rounded-[22px] border-sage/25 bg-sage-soft' : 'rounded-[22px] rounded-bl-[4px] border-line bg-surface shadow-bubble',
      )}
    >
      {system ? <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-sage uppercase">Forever xác nhận</p> : <p className="mb-1 text-[12px] font-semibold text-muted-foreground">{vendorName}</p>}
      <div className="flex items-start gap-2.5 text-[13px] leading-relaxed">
        <Receipt className="mt-0.5 size-4 flex-none text-sage" aria-hidden />
        <span>{message.content}</span>
      </div>
      {order && (
        <Button size="sm" variant="outline" className="mt-2.5" onClick={() => setOpen(true)}>
          Xem
        </Button>
      )}
      {open && order && <InvoiceDialog order={order} type={type} vendorName={order.vendorName ?? vendorName} onClose={() => setOpen(false)} />}
    </div>
      <time className="mt-1 px-1 text-[11px] text-muted-foreground">{formatStamp(message.sentDate)}</time>
    </div>
  )
}
