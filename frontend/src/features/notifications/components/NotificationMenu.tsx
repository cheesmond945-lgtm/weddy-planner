import { Bell, CheckCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { formatMessageTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/types/notification'
import { describeVendorNotification, vendorNotificationHref } from '../format'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationList, useNotificationUnread } from '../hooks'

/**
 * Chuông thông báo cổng NCC: chấm đỏ kèm số chưa đọc; bấm mở danh sách (mới nhất trước). Bấm một thông báo thì đánh dấu đã đọc
 * và mở đúng chỗ (hội thoại hoặc đơn); "Đánh dấu tất cả đã đọc" ở đầu danh sách.
 */
export function VendorNotificationMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const unread = useNotificationUnread()
  const { data, isPending, isError } = useNotificationList(open)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(n: AppNotification) {
    if (!n.isRead) markRead.mutate(n.id)
    setOpen(false)
    const href = vendorNotificationHref(n)
    if (href) navigate(href)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Thông báo"
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-accent-soft hover:text-gold-ink"
      >
        <Bell className="size-[21px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-1 grid h-[20px] min-w-[20px] place-items-center rounded-pill border-2 border-surface bg-[#e5262b] px-1 text-[10.5px] leading-none font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          className="absolute top-full right-0 z-50 mt-2 w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-line bg-surface shadow-card animate-in fade-in zoom-in-95 max-sm:fixed max-sm:top-[66px] max-sm:right-3 max-sm:left-3 max-sm:w-auto"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <strong className="text-sm font-semibold text-ink">Thông báo</strong>
            <button
              type="button"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gold-ink hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Đánh dấu tất cả đã đọc
            </button>
          </div>

          <div className="max-h-[min(440px,70dvh)] overflow-y-auto">
            {isPending && <div aria-busy="true" aria-label="Đang tải" className="m-4 h-16 animate-pulse rounded-md bg-muted" />}
            {isError && <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Chưa tải được thông báo.</p>}
            {data && !data.length && <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Chưa có thông báo nào.</p>}
            {data?.map((n) => {
              const { text, detail } = describeVendorNotification(n)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => pick(n)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-line-soft px-4 py-3 text-left last:border-b-0 hover:bg-accent-soft',
                    !n.isRead && 'bg-[color-mix(in_srgb,var(--gold)_7%,var(--surface))]',
                  )}
                >
                  <span aria-hidden className={cn('mt-[7px] size-2 flex-none rounded-full', n.isRead ? 'bg-transparent' : 'bg-[#e5262b]')} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[13px] leading-snug [overflow-wrap:anywhere]', n.isRead ? 'text-muted-foreground' : 'font-medium text-ink')}>{text}</span>
                    {detail && <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{detail}</span>}
                  </span>
                  <time dateTime={n.createdDate} className="flex-none pt-0.5 text-[11px] text-muted-foreground">
                    {formatMessageTime(n.createdDate)}
                  </time>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
