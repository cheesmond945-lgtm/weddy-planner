import { Filter, Search, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { orderCardsStubbed } from '@/api'
import { Badge } from '@/components/Badge'
import { OrderStubCard } from '@/components/OrderStubCard'
import { Button } from '@/components/ui/button'
import { useCategories } from '@/features/catalog/hooks'
import { OrderCard } from '@/features/orders/components/OrderCard'
import { ReviseOrderDialog } from '@/features/orders/components/ReviseOrderDialog'
import { formatMessageTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { Conversation, Message } from '@/types/chat'
import type { Order } from '@/types/order'
import { useMarkReadOnView, useMessages, useSendMessage } from '../hooks'

interface ChatViewProps {
  conversations: Conversation[]
  activeId: string
  onSelect: (id: string) => void
}

const preview = (c: Conversation) => (c.lastMessage ? (c.lastMessage.type === 'Order' ? 'Đã gửi đơn dịch vụ' : c.lastMessage.content) : '')

/** Hộp thư: danh sách hội thoại + khung trò chuyện (renderChat trong prototype). */
export function ChatView({ conversations, activeId, onSelect }: ChatViewProps) {
  const active = conversations.find((c) => c.id === activeId) ?? conversations[0]
  return (
    <div className="grid h-[calc(100dvh-142px)] max-h-[900px] min-h-[610px] grid-cols-[340px_minmax(0,1fr)] overflow-hidden rounded-[26px] bg-surface shadow-panel max-[900px]:h-[calc(100dvh-170px)] max-[900px]:min-h-[560px] max-[900px]:grid-cols-[260px_minmax(0,1fr)] max-[640px]:h-auto max-[640px]:max-h-none max-[640px]:grid-cols-1">
      <Inbox conversations={conversations} activeId={active.id} onSelect={onSelect} />
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
            <b className="truncate text-[13px] font-semibold">{c.service.name}</b>
            {c.planStatus === 'CONFIRMED' && (
              <Badge tone="done" className="shrink-0 px-2 py-px text-[10px]">
                Đã cọc
              </Badge>
            )}
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
  const listRef = useRef<HTMLDivElement>(null)

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
          <div className="truncate font-semibold">
            {conversation.service.name} <span className="text-sage">●</span>
          </div>
          <div className="mt-[3px] text-xs text-muted-foreground max-[640px]:hidden">
            {conversation.service.category.name} <span className="px-1">•</span>
            <span className="inline-flex items-center gap-[5px] rounded-pill border border-sage/30 bg-sage-soft px-[9px] py-0.5 text-[11px] text-sage">● Trực tuyến</span>
          </div>
        </div>
        <Button asChild variant="outline" className="ml-auto rounded-pill whitespace-nowrap max-[900px]:px-1.5 max-[900px]:text-[11px] max-[640px]:hidden">
          <Link to={paths.serviceDetail(conversation.service.id)}>Xem dịch vụ ›</Link>
        </Button>
      </header>

      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-surface px-7 py-6 max-[900px]:p-4 max-[640px]:h-[360px] max-[640px]:flex-none">
        {messages.map((m) => (
          <MessageItem key={m.id} message={m} categorySlug={conversation.service.category.slug} onRevise={setRevising} />
        ))}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2.5 border-t border-line-soft bg-surface px-6 pt-3.5 pb-[18px]">
        <input
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

      <ReviseOrderDialog order={revising} onClose={() => setRevising(null)} />
    </section>
  )
}

function MessageItem({ message, categorySlug, onRevise }: { message: Message; categorySlug: string; onRevise: (o: Order) => void }) {
  if (message.type === 'Order' && message.orderId) {
    // Chat thật mà API đơn còn giả: không đọc được đơn đầy đủ, hiện ô gọn "Đơn {mã} · {trạng thái}"
    if (orderCardsStubbed('chat') && message.order) return <OrderStubCard orderCode={message.order.orderCode} status={message.order.status} />
    return <OrderCard orderId={message.orderId} categorySlug={categorySlug} onRevise={onRevise} />
  }
  const base = 'max-w-[78%] rounded-[20px] px-[15px] py-[11px] text-[13px] whitespace-pre-wrap [overflow-wrap:anywhere] max-[640px]:max-w-[94%]'
  if (message.sender === 'SYSTEM') return <div className={cn(base, 'self-center bg-sage-soft text-sage')}>{message.content}</div>
  if (message.sender === 'COUPLE') return <div className={cn(base, 'self-end rounded-br-[5px] bg-primary text-primary-foreground')}>{message.content}</div>
  return <div className={cn(base, 'self-start rounded-bl-[5px] bg-bg text-nav')}>{message.content}</div>
}
