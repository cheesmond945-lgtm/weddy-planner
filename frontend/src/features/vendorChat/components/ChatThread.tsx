import { ChevronLeft, FilePen, Phone, Plus, Send, Tag } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { formatStamp } from '@/features/serviceOrders/calc'
import { orderPageHref } from '@/features/serviceOrders/components/OrderCard'
import { formatDate, toISODate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import type { ServiceOrder } from '@/types/serviceOrder'
import type { VendorConversation } from '@/types/vendorChat'
import { useConversationOrders, useMarkRead, useSendVendorMessage, useVendorMessages } from '../hooks'
import { PersonAvatar } from '../preview'
import { CustomerSimulator } from './CustomerSimulator'
import { MessageItem, type MessageActions } from './MessageItem'

interface ChatThreadProps extends MessageActions {
  conversation: VendorConversation
  onBack: () => void
  /** Thêm đơn mới, hoặc mở lại bản nháp */
  onOpenForm: (order?: ServiceOrder) => void
  /** Đơn vừa gửi: cuộn tới và làm nổi thẻ */
  highlightOrderId: string | null
}

const dayOf = (iso: string) => formatDate(toISODate(new Date(iso)))

function priceRange(p: NonNullable<VendorConversation['interestPackage']>) {
  if (p.price !== null && p.maxPrice !== null) return `${formatMoney(p.price)} – ${formatMoney(p.maxPrice)}`
  return p.price !== null ? `Từ ${formatMoney(p.price)}` : 'Chưa có giá'
}

/** Khung chat với một khách (chat-main trong prototype NCC), cùng kiểu khung chat phía cặp đôi. */
export function ChatThread({ conversation: c, onBack, onOpenForm, highlightOrderId, ...actions }: ChatThreadProps) {
  const { data: messages, isPending } = useVendorMessages(c.id)
  const { data: orders = [] } = useConversationOrders(c.id)
  const send = useSendVendorMessage(c.id)
  const markRead = useMarkRead()
  const [text, setText] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)

  const sentOrders = orders.filter((o) => o.versions.length)
  const drafts = orders.filter((o) => o.draft)
  const latestOrder = [...sentOrders].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop()

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
            <span className="select-all">{c.customer.phone}</span>
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
        <CustomerSimulator conversationId={c.id} latestOrder={latestOrder} />
        {latestOrder && (
          <Button asChild variant="outline" className="rounded-pill whitespace-nowrap max-[640px]:hidden">
            <Link to={orderPageHref(latestOrder)}>Xem đơn ›</Link>
          </Button>
        )}
        <Button aria-label="Tạo đơn" className="rounded-pill whitespace-nowrap max-sm:size-[42px] max-sm:p-0" onClick={() => onOpenForm()}>
          <Plus />
          <span className="max-sm:hidden">Tạo đơn</span>
        </Button>
      </header>

      {c.interestPackage && (
        <div className="flex items-center gap-2 border-b border-line-soft bg-accent-soft px-6 py-[9px] text-[13px] text-gold-ink max-[900px]:px-3.5">
          <Tag className="size-[15px] flex-none" />
          <span>
            Khách quan tâm: <b>{c.interestPackage.name}</b> · {priceRange(c.interestPackage)}
          </span>
        </div>
      )}

      {drafts.map((o) => (
        <div
          key={o.id}
          className="flex flex-wrap items-center gap-2.5 border-b border-line-soft bg-[repeating-linear-gradient(135deg,var(--surface)_0_10px,var(--bg)_10px_20px)] py-[9px] pr-3.5 pl-6 text-[13px]"
        >
          <FilePen className="size-4 flex-none text-gold-ink" />
          <span className="min-w-[200px] flex-1">
            {o.draft!.kind === 'EDIT' ? (
              <>
                Bản sửa nháp <b>{o.code}</b> chưa gửi lại
              </>
            ) : (
              <>
                Bản nháp <b>{o.code}</b> chưa gửi khách
              </>
            )}{' '}
            · chỉ bạn nhìn thấy · lưu {formatStamp(o.draft!.savedAt)}
          </span>
          <Button size="sm" variant="outline" className="border-line-strong" onClick={() => (o.versions.length ? actions.onEditOrder(o) : onOpenForm(o))}>
            {o.draft!.kind === 'EDIT' ? 'Tiếp tục chỉnh sửa' : 'Mở lại bản nháp'}
          </Button>
        </div>
      ))}

      <div ref={historyRef} className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-surface px-7 py-6 max-[900px]:p-4">
        {isPending && <div aria-busy="true" aria-label="Đang tải tin nhắn" className="m-auto h-24 w-2/3 animate-pulse rounded-lg bg-muted" />}
        {messages?.map((m, i) => {
          const newDay = i === 0 || dayOf(messages[i - 1].createdAt) !== dayOf(m.createdAt)
          return (
            <Fragment key={m.id}>
              {newDay && (
                <p className="text-center text-[11.5px] text-muted-foreground">
                  <span className="rounded-pill bg-bg px-2.5 py-[3px]">{dayOf(m.createdAt)}</span>
                </p>
              )}
              <MessageItem message={m} order={orders.find((o) => o.id === m.orderId)} highlightOrderId={highlightOrderId} {...actions} />
            </Fragment>
          )
        })}
        {messages && !messages.length && (
          <EmptyState className="m-auto border-0 bg-transparent" title="Chưa có tin nhắn" description="Bắt đầu trò chuyện với khách." />
        )}
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
