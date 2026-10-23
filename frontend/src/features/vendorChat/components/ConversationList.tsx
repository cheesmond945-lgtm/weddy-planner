import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { OrderStatusBadge, StatusBadge } from '@/features/serviceOrders/components/OrderBadges'
import { formatMessageTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { VendorConversation } from '@/types/vendorChat'
import { lastMessagePreview, PersonAvatar } from '../preview'

type Tab = 'all' | 'unread' | 'todo'

interface ConversationListProps {
  conversations: VendorConversation[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** Danh sách hội thoại: tìm theo tên, số điện thoại, mã đơn; lọc Tất cả / Chưa đọc / Cần xử lý (như prototype NCC). */
export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('all')

  const k = q.trim().toLowerCase()
  const digits = k.replace(/\s/g, '')
  const shown = conversations.filter(
    (c) =>
      (!k ||
        c.customer.name.toLowerCase().includes(k) ||
        (digits.length >= 3 && c.customer.phone.replace(/\s/g, '').includes(digits)) ||
        c.orderCodes.some((code) => code.toLowerCase().includes(k))) &&
      (tab === 'all' || (tab === 'unread' && c.unreadCount > 0) || (tab === 'todo' && c.needsAction)),
  )
  const counts = { unread: conversations.filter((c) => c.unreadCount > 0).length, todo: conversations.filter((c) => c.needsAction).length }

  return (
    <aside className="flex min-h-0 flex-col border-r border-line max-[900px]:border-r-0">
      <div className="px-3.5 pt-3.5 pb-2.5">
        <div className="flex h-10 items-center rounded-sm border border-line-strong bg-surface focus-within:border-gold">
          <Search className="ml-3 size-4 flex-none text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên, số điện thoại, mã đơn"
            aria-label="Tìm tên, số điện thoại, mã đơn"
            className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13.5px] outline-none"
          />
          {q && (
            <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQ('')} className="mr-1 grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div role="tablist" aria-label="Lọc cuộc trò chuyện" className="flex gap-1.5 overflow-x-auto border-b border-line px-3.5 pb-3 [scrollbar-width:thin]">
        {(
          [
            ['all', 'Tất cả', 0],
            ['unread', 'Chưa đọc', counts.unread],
            ['todo', 'Cần xử lý', counts.todo],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex h-[34px] flex-none items-center gap-1.5 rounded-pill border border-line bg-surface px-3 text-[13px] text-muted-foreground hover:border-line-strong hover:text-ink',
              tab === key && 'border-gold/45 bg-gold-soft font-semibold text-gold-ink',
            )}
          >
            {label}
            {n > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-(image:--gold-grad) px-[5px] text-[11px] font-semibold text-gold-on">{n}</span>}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.map((c) => {
          const selected = c.id === selectedId
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={selected || undefined}
              className={cn(
                'relative flex w-full gap-3 border-b border-line p-4 text-left transition-colors hover:bg-surface-2',
                selected && 'bg-gold-soft before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-(image:--gold-grad)',
              )}
            >
              <PersonAvatar name={c.customer.name} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-[13.5px]">
                  <strong className="truncate font-semibold">{c.customer.name}</strong>
                  {c.lastMessage && <time className="flex-none text-[11.5px] text-muted-foreground">{formatMessageTime(c.lastMessage.createdAt)}</time>}
                </div>
                <div className="flex items-center justify-between gap-2.5">
                  <p className="mt-[3px] truncate text-[12.5px] text-muted-foreground">{lastMessagePreview(c.lastMessage)}</p>
                  {c.unreadCount > 0 && (
                    <span className="grid h-5 min-w-5 flex-none place-items-center rounded-pill bg-(image:--gold-grad) px-1 text-[11px] font-semibold text-gold-on">{c.unreadCount}</span>
                  )}
                </div>
                {c.latestOrder ? (
                  <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-muted-foreground tabular-nums">
                    {c.latestOrder.code}
                    <OrderStatusBadge order={c.latestOrder} />
                  </span>
                ) : (
                  c.hasDraftOrder && (
                    <span className="mt-1.5 inline-flex">
                      <StatusBadge tone="neutral">Có bản nháp</StatusBadge>
                    </span>
                  )
                )}
              </div>
            </button>
          )
        })}
        {!shown.length && (
          <EmptyState
            className="border-0 bg-transparent"
            title="Không có cuộc trò chuyện"
            description={q ? 'Thử từ khóa khác.' : tab === 'todo' ? 'Không có đơn cần xử lý.' : 'Chưa có tin nhắn.'}
          />
        )}
      </div>
    </aside>
  )
}
