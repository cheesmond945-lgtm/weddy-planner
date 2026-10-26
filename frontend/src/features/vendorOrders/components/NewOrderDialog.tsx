import { Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { useVendorConversations } from '@/features/vendorChat/hooks'
import { conversationBadge, PersonAvatar } from '@/features/vendorChat/preview'
import { paths } from '@/routes/paths'
import { PanelDialog } from './PanelDialog'

/** "+ Tạo đơn" ở trang Quản lý đơn hàng: chọn khách (hội thoại) rồi sang Tin nhắn mở sẵn form tạo đơn, vì đơn luôn tạo trong chat. */
export function NewOrderDialog({ onClose }: { onClose: () => void }) {
  const { data: conversations, isPending } = useVendorConversations(15_000)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const k = q.trim().toLowerCase()
  const digits = k.replace(/\D/g, '')
  const shown = (conversations ?? []).filter((c) => !k || c.customer.name.toLowerCase().includes(k) || (digits.length >= 3 && c.customer.phone.replace(/\D/g, '').includes(digits)))

  return (
    <PanelDialog open size="md" onRequestClose={onClose} title="Tạo đơn cho khách nào?" subtitle="Đơn luôn được tạo trong cuộc trò chuyện với khách. Chọn khách để mở form tạo đơn.">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên khách hoặc số điện thoại..."
          aria-label="Tìm khách"
          className="w-full rounded-pill border border-line bg-surface py-3 pr-3.5 pl-9 text-sm outline-none focus:border-gold"
        />
      </div>
      {isPending ? (
        <div aria-busy="true" className="h-40 animate-pulse rounded-md bg-muted" />
      ) : shown.length ? (
        <ul className="grid gap-1.5">
          {shown.map((c) => {
            const badge = conversationBadge(c)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`${paths.vendor.chat}?c=${encodeURIComponent(c.id)}&create=1`)}
                  className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left hover:bg-accent-soft"
                >
                  <PersonAvatar name={c.customer.name} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-semibold">{c.customer.name}</b>
                    <span className="text-[12px] text-muted-foreground">{c.customer.phone || 'Chưa có số điện thoại'}</span>
                  </span>
                  {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState className="border-0 bg-transparent" title="Không có khách phù hợp" description={conversations?.length ? 'Thử từ khóa khác.' : 'Khi khách nhắn tin, cuộc trò chuyện sẽ hiện ở đây.'} />
      )}
    </PanelDialog>
  )
}
