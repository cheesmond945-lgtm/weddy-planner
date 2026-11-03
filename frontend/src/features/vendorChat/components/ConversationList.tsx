import { Filter, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { formatMessageTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { VendorConversation } from '@/types/vendorConversation'
import { conversationBadge, lastMessagePreview, PersonAvatar } from '../preview'

type Tab = 'all' | 'unread' | 'todo'

interface ConversationListProps {
  conversations: VendorConversation[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/**
 * Danh sách hội thoại, cùng kiểu hộp thư phía cặp đôi (ô tìm pill + nút lọc tròn, dòng "N hội thoại").
 * Tìm theo tên, số điện thoại, mã đơn; lọc Tất cả / Chưa đọc / Cần xử lý (như prototype NCC).
 */
export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

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
  const filters: { value: Tab; label: string; count: number }[] = [
    { value: 'all', label: 'Tất cả', count: conversations.length },
    { value: 'unread', label: 'Chưa đọc', count: conversations.filter((c) => c.unreadCount > 0).length },
    { value: 'todo', label: 'Cần xử lý', count: conversations.filter((c) => c.needsAction).length },
  ]
  const needAttention = filters[2].count + filters[1].count > 0

  return (
    <aside aria-label="Danh sách hội thoại" className="min-h-0 flex-1 overflow-auto border-r border-line px-3 py-4 max-[900px]:border-r-0">
      <div ref={filterRef} className="relative mb-4 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm khách, SĐT, mã đơn..."
            aria-label="Tìm tên, số điện thoại, mã đơn"
            className="w-full rounded-pill border-0 bg-bg py-3 pr-9 pl-9 text-sm text-ink outline-none focus:outline-1 focus:outline-primary"
          />
          {q && (
            <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQ('')} className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface-2">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Lọc hội thoại"
          title="Lọc hội thoại"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((o) => !o)}
          className={cn('relative grid size-[42px] shrink-0 place-items-center rounded-full border border-line bg-surface text-muted-foreground', tab !== 'all' && 'border-primary text-primary')}
        >
          <Filter className="size-[18px]" />
          {tab === 'all' && needAttention && <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
        </button>
        {filterOpen && (
          <div role="menu" className="absolute top-full right-0 z-10 mt-1 w-52 rounded-md border border-line bg-surface p-1 shadow-card">
            {filters.map(({ value, label, count }) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={tab === value}
                onClick={() => {
                  setTab(value)
                  setFilterOpen(false)
                }}
                className={cn('flex w-full justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent-soft', tab === value && 'font-semibold text-gold')}
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
        <span>{filters.find((f) => f.value === tab)!.label}</span>
      </div>

      {shown.map((c) => {
        const selected = c.id === selectedId
        const badge = conversationBadge(c)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-current={selected || undefined}
            className={cn(
              'mb-[5px] grid w-full grid-cols-[48px_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-2.5 gap-y-[3px] rounded-[18px] px-2.5 py-[13px] text-left text-ink',
              selected ? 'bg-accent-soft shadow-[inset_4px_0_var(--accent)]' : 'hover:bg-bg',
            )}
          >
            <PersonAvatar name={c.customer.name} className="row-span-2" />
            <span className="flex min-w-0 items-center gap-1.5">
              <b className={cn('truncate text-[13px]', c.unreadCount > 0 ? 'font-bold' : 'font-semibold')}>{c.customer.name}</b>
              {badge && (
                <Badge tone={badge.tone} className="shrink-0 px-2 py-px text-[10px]">
                  {badge.label}
                </Badge>
              )}
            </span>
            <span className="text-[11px] whitespace-nowrap text-muted-foreground">{c.lastMessage ? formatMessageTime(c.lastMessage.sentDate) : ''}</span>
            <span className="col-span-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">{lastMessagePreview(c.lastMessage)}</span>
              {c.unreadCount > 0 && (
                <span aria-label={`${c.unreadCount} tin chưa đọc`} className="grid h-[18px] min-w-[18px] flex-none place-items-center rounded-pill bg-primary px-1 text-[10.5px] font-semibold text-primary-foreground">
                  {c.unreadCount}
                </span>
              )}
            </span>
          </button>
        )
      })}
      {!shown.length && (
        <EmptyState
          className="border-0 bg-transparent"
          title="Không có cuộc trò chuyện"
          description={q ? 'Thử từ khóa khác.' : tab === 'todo' ? 'Không có đơn cần xử lý.' : tab === 'unread' ? 'Không có tin chưa đọc.' : 'Chưa có tin nhắn.'}
        />
      )}
    </aside>
  )
}
