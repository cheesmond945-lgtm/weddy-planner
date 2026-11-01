import { Bell, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

/** Một thông báo trong chuông (Admin và NCC dùng chung). */
export interface BellNotification {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  /** ISO */
  createdAt: string
}

/** "5 phút trước", "3 giờ trước", "2 ngày trước"; quá 30 ngày thì ngày tháng. */
function ago(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'Vừa xong'
  if (min < 60) return `${min} phút trước`
  if (min < 24 * 60) return `${Math.floor(min / 60)} giờ trước`
  if (min < 30 * 24 * 60) return `${Math.floor(min / (24 * 60))} ngày trước`
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

interface NotificationBellProps<T extends BellNotification> {
  data: { unread: number; items: T[] } | undefined
  /** Icon theo loại thông báo; loại không có thì dùng chuông */
  icons: Record<string, LucideIcon>
  /** Trang xử lý mà thông báo dẫn tới */
  targetOf: (n: T) => string
  onRead: (id: string) => void
  onReadAll: () => void
  readAllPending?: boolean
}

/** Chuông thông báo ở header: bấm mở danh sách, bấm một thông báo thì đánh dấu đã đọc và chuyển tới trang xử lý. */
export function NotificationBell<T extends BellNotification>({ data, icons, targetOf, onRead, onReadAll, readAllPending }: NotificationBellProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const unread = data?.unread ?? 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function go(n: T) {
    if (!n.isRead) onRead(n.id)
    setOpen(false)
    navigate(targetOf(n))
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Thông báo"
        className={cn('relative grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-ink', open && 'bg-surface-2 text-ink')}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[11px] leading-none font-semibold text-white tabular-nums ring-2 ring-[var(--bg)]"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Thông báo" className="absolute top-[calc(100%+8px)] right-0 z-50 w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-line bg-surface shadow-portal-lift animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <strong className="text-[15px] font-semibold">Thông báo{unread > 0 && <span className="ml-1.5 text-[13px] font-medium text-warn">({unread} chưa đọc)</span>}</strong>
            {unread > 0 && (
              <button type="button" onClick={onReadAll} disabled={readAllPending} className="text-[12.5px] font-medium text-gold-ink hover:underline disabled:opacity-60">
                Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>

          {!data?.items.length ? (
            <p className="px-4 py-10 text-center text-[13.5px] text-muted-foreground">Chưa có thông báo nào.</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {data.items.map((n) => {
                const Icon = icons[n.type] ?? Bell
                return (
                  <li key={n.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => go(n)}
                      className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none', !n.isRead && 'bg-gold-soft/40')}
                    >
                      <span className="mt-0.5 grid size-9 flex-none place-items-center rounded-full bg-surface-2 text-gold-ink">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[13.5px] leading-snug', n.isRead ? 'font-medium' : 'font-semibold')}>{n.title}</span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{n.content}</span>
                        <span className="mt-1 block text-[11.5px] text-muted-foreground tabular-nums">{ago(n.createdAt)}</span>
                      </span>
                      {!n.isRead && <i aria-label="Chưa đọc" className="mt-2 size-2 flex-none rounded-full bg-warn" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
