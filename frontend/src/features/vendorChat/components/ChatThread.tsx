import { ChevronLeft, FilePen, Phone, Plus, Send } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { formatDay, formatStamp, orderPageHref } from '@/features/vendorOrders/calc'
import type { OrderFormMode } from '@/features/vendorOrders/components/OrderFormDialog'
import { useConversationOrders } from '@/features/vendorOrders/hooks'
import type { VendorConversation } from '@/types/vendorConversation'
import type { InvoiceType, Order } from '@/types/vendorOrder'
import { useMarkRead, useSendVendorMessage, useVendorMessages } from '../hooks'
import { PersonAvatar } from '../preview'
import { MessageItem } from './MessageItem'

interface ChatThreadProps {
  conversation: VendorConversation
  onBack: () => void
  /** Mở form đơn (tạo mới, mở lại bản nháp, sửa và gửi lại, sửa sau cọc, tạo đơn mới từ đơn hết hạn) */
  onOpenForm: (mode: OrderFormMode) => void
  /** Đơn vừa gửi: cuộn tới và làm nổi thẻ */
  highlightOrderId: string | null
  onViewOrder: (order: Order) => void
  onViewInvoice: (order: Order, type: InvoiceType) => void
}

const dayOf = formatDay

/** Khung chat với một khách (chat-main trong prototype NCC), cùng kiểu khung chat phía cặp đôi. */
export function ChatThread({ conversation: c, onBack, onOpenForm, highlightOrderId, onViewOrder, onViewInvoice }: ChatThreadProps) {
  const { data: messages, isPending } = useVendorMessages(c.id)
  const { data: orders = [] } = useConversationOrders(c.id)
  const send = useSendVendorMessage(c.id)
  const markRead = useMarkRead()
  const [text, setText] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)

  const sentOrders = orders.filter((o) => o.status !== 'Draft')
  const drafts = orders.filter((o) => o.status === 'Draft')
  const latestOrder = [...sentOrders].sort((a, b) => b.createdDate.localeCompare(a.createdDate))[0]
  // Thẻ mới nhất của từng đơn: gửi lại thì các thẻ cũ thu gọn
  const latestCard = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of messages ?? []) if (m.type === 'Order' && m.orderId) map.set(m.orderId, m.id)
    return map
  }, [messages])

  // Mở hội thoại hoặc có tin mới khi đang mở: đánh dấu đã đọc
  const { mutate: read } = markRead
  useEffect(() => {
    if (c.unreadCount > 0) read(c.id)
  }, [c.id, c.unreadCount, read])

  // Cuộn xuống tin cuối; đơn vừa gửi thì cuộn tới thẻ mới nhất của đơn đó
  const count = messages?.length ?? 0
  useLayoutEffect(() => {
    const el = historyRef.current
    if (!el) return
    const cards = highlightOrderId ? el.querySelectorAll<HTMLElement>(`[data-order="${highlightOrderId}"]`) : []
    const target = cards[cards.length - 1]
    if (target) el.scrollTo({ top: Math.max(0, target.offsetTop - el.clientHeight / 2 + target.offsetHeight / 2), behavior: 'smooth' })
    else el.scrollTop = el.scrollHeight
  }, [c.id, count, highlightOrderId])

  function submit() {
    const t = text.trim()
    if (!t) return
    send.mutate(t, { onSuccess: () => setText('') })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex min-h-[82px] items-center gap-3 border-b border-line-soft px-6 py-4 max-[900px]:p-3">
        <button type="button" aria-label="Quay lại danh sách" onClick={onBack} className="grid size-9 flex-none place-items-center rounded-full text-muted-foreground hover:bg-bg min-[901px]:hidden">
          <ChevronLeft className="size-[18px]" />
        </button>
        <PersonAvatar name={c.customer.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {c.customer.name}
            {c.customer.online && <span aria-label="Đang trực tuyến" className="ml-1.5 text-sage">●</span>}
          </div>
          <div className="mt-[3px] flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            <Phone className="size-3" aria-hidden />
            <span className="select-all">{c.customer.phone || 'Chưa có số điện thoại'}</span>
            {sentOrders.length > 0 && (
              <>
                <span className="px-1">•</span>
                {sentOrders.length} đơn
              </>
            )}
            {c.customer.online && (
              <span className="ml-1 inline-flex items-center gap-[5px] rounded-pill border border-sage/30 bg-sage-soft px-[9px] py-0.5 text-[11px] text-sage">● Trực tuyến</span>
            )}
          </div>
        </div>
        {latestOrder && (
          <Button asChild variant="outline" className="rounded-pill whitespace-nowrap max-[640px]:hidden">
            <Link to={orderPageHref(latestOrder.id)}>Xem đơn ›</Link>
          </Button>
        )}
        <Button aria-label="Tạo đơn" className="rounded-pill whitespace-nowrap max-sm:size-[42px] max-sm:p-0" onClick={() => onOpenForm({ kind: 'new' })}>
          <Plus />
          <span className="max-sm:hidden">Tạo đơn</span>
        </Button>
      </header>

      {drafts.map((o) => (
        <div
          key={o.id}
          className="flex flex-wrap items-center gap-2.5 border-b border-line-soft bg-[repeating-linear-gradient(135deg,var(--surface)_0_10px,var(--bg)_10px_20px)] py-[9px] pr-3.5 pl-6 text-[13px]"
        >
          <FilePen className="size-4 flex-none text-gold-ink" />
          <span className="min-w-[200px] flex-1">
            Bản nháp <b>{o.orderCode}</b> chưa gửi khách · chỉ bạn nhìn thấy · tạo {formatStamp(o.createdDate)}
          </span>
          <Button size="sm" variant="outline" className="border-line-strong" onClick={() => onOpenForm({ kind: 'draft', order: o })}>
            Tiếp tục soạn
          </Button>
        </div>
      ))}

      <div ref={historyRef} className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-surface px-7 py-6 max-[900px]:p-4">
        {isPending && <div aria-busy="true" aria-label="Đang tải tin nhắn" className="m-auto h-24 w-2/3 animate-pulse rounded-lg bg-muted" />}
        {messages?.map((m, i) => {
          const newDay = i === 0 || dayOf(messages[i - 1].sentDate) !== dayOf(m.sentDate)
          return (
            <Fragment key={m.id}>
              {newDay && (
                <p className="text-center text-[11.5px] text-muted-foreground">
                  <span className="rounded-pill bg-bg px-2.5 py-[3px]">{dayOf(m.sentDate)}</span>
                </p>
              )}
              <MessageItem
                message={m}
                order={orders.find((o) => o.id === m.orderId)}
                isLatestCard={!m.orderId || latestCard.get(m.orderId) === m.id}
                highlight={!!m.orderId && highlightOrderId === m.orderId}
                onOpenForm={onOpenForm}
                onViewOrder={onViewOrder}
                onViewInvoice={onViewInvoice}
              />
            </Fragment>
          )
        })}
        {messages && !messages.length && <EmptyState className="m-auto border-0 bg-transparent" title="Chưa có tin nhắn" description="Bắt đầu trò chuyện với khách." />}
      </div>

      <form
        className="flex items-center gap-2.5 border-t border-line-soft bg-surface px-6 pt-3.5 pb-[18px] max-[900px]:px-3 max-[900px]:pb-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          aria-label="Nhập tin nhắn"
          placeholder="Nhập tin nhắn..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded-pill border-0 bg-bg px-[18px] py-[15px] text-[15px] text-ink outline-none focus:outline-1 focus:outline-primary"
        />
        <Button type="submit" size="icon" aria-label="Gửi tin nhắn" title="Gửi tin nhắn" disabled={send.isPending} className="size-12 rounded-full">
          <Send className="size-[19px]" />
        </Button>
      </form>
    </div>
  )
}
