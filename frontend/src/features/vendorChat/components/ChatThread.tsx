import { ChevronLeft, FilePen, MessageSquare, Phone, Plus, Send, Tag } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { formatStamp } from '@/features/serviceOrders/calc'
import { formatDate, toISODate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import type { ServiceOrder } from '@/types/serviceOrder'
import type { VendorConversation } from '@/types/vendorChat'
import { useConversationOrders, useMarkRead, useSendVendorMessage, useVendorMessages } from '../hooks'
import { PersonAvatar } from '../preview'
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

/** Khung chat với một khách (chat-main trong prototype NCC). */
export function ChatThread({ conversation: c, onBack, onOpenForm, highlightOrderId, ...actions }: ChatThreadProps) {
  const { data: messages, isPending } = useVendorMessages(c.id)
  const { data: orders = [] } = useConversationOrders(c.id)
  const send = useSendVendorMessage(c.id)
  const markRead = useMarkRead()
  const [text, setText] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)

  const sentOrders = orders.filter((o) => o.versions.length)
  const drafts = orders.filter((o) => o.draft)

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
    <div className="flex min-h-0 min-w-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3.5 max-sm:px-3.5">
        <button type="button" aria-label="Quay lại danh sách" onClick={onBack} className="grid size-9 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2 min-[901px]:hidden">
          <ChevronLeft className="size-[18px]" />
        </button>
        <PersonAvatar name={c.customer.name} />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-semibold">{c.customer.name}</strong>
          <p className="text-[12.5px] text-muted-foreground">
            <Phone className="mr-1 inline size-3 align-[-1px]" />
            <span className="select-all">{c.customer.phone}</span>
            {sentOrders.length > 0 && ` · ${sentOrders.length} đơn`}
          </p>
        </div>
        <Button size="sm" aria-label="Thêm đơn hàng" onClick={() => onOpenForm()}>
          <Plus />
          <span className="max-sm:hidden">Thêm đơn hàng</span>
        </Button>
      </header>

      {c.interestPackage && (
        <div className="flex items-center gap-2 border-b border-line bg-gold-soft px-5 py-[9px] text-[13px] text-gold-ink max-sm:px-3.5">
          <Tag className="size-[15px] flex-none" />
          <span>
            Khách quan tâm: <b>{c.interestPackage.name}</b> · {priceRange(c.interestPackage)}
          </span>
        </div>
      )}

      {drafts.map((o) => (
        <div
          key={o.id}
          className="flex flex-wrap items-center gap-2.5 border-b border-line bg-[repeating-linear-gradient(135deg,var(--surface)_0_10px,var(--surface-2)_10px_20px)] py-[9px] pr-3.5 pl-5 text-[13px]"
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

      <div ref={historyRef} className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-surface-2 px-[26px] py-[22px] max-sm:p-4">
        {isPending && <div aria-busy="true" aria-label="Đang tải tin nhắn" className="m-auto h-24 w-2/3 animate-pulse rounded-lg bg-muted" />}
        {messages?.map((m, i) => {
          const newDay = i === 0 || dayOf(messages[i - 1].createdAt) !== dayOf(m.createdAt)
          return (
            <Fragment key={m.id}>
              {newDay && (
                <p className="text-center text-[11.5px] text-muted-foreground">
                  <span className="rounded-pill border border-line bg-surface px-2.5 py-[3px]">{dayOf(m.createdAt)}</span>
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
        className="border-t border-line px-[18px] pt-3 pb-4 max-sm:px-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-center gap-1.5 rounded-md border border-line-strong bg-surface py-1 pr-1 pl-3 focus-within:border-gold">
          <MessageSquare className="size-4 flex-none text-muted-foreground" />
          <input
            aria-label="Nhập tin nhắn"
            placeholder={`Nhắn cho ${c.customer.name}…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[13.5px] outline-none"
          />
          <Button type="submit" size="sm" disabled={!text.trim() || send.isPending}>
            Gửi
            <Send />
          </Button>
        </div>
      </form>
    </div>
  )
}
