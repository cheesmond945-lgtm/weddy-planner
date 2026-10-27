import { Bell, Handshake, LogOut, MessageCircle, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { SessionUser } from '@/types/auth'

/** Nút "Đăng ký hợp tác" cho nhà cung cấp muốn làm đối tác. Chưa có chức năng. */
export function PartnerButton() {
  return (
    <button
      type="button"
      className="inline-flex h-10 items-center gap-2 rounded-pill border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-gold max-sm:hidden"
    >
      <Handshake className="size-[18px]" aria-hidden />
      Đăng ký hợp tác
    </button>
  )
}

/** Chuông thông báo; chỉ hiện số khi có thông báo chưa đọc. Chưa nối dữ liệu nên luôn là 0. */
export function NotificationBell({ unread = 0 }: { unread?: number }) {
  return (
    <button
      type="button"
      aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
      title="Thông báo"
      className="relative grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-accent-soft hover:text-gold"
    >
      <Bell className="size-[21px]" aria-hidden />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-pill border-2 border-surface bg-[#e5262b] px-1 text-[11px] leading-none font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}

/** Chữ cái đầu của họ và tên (vd "Trịnh Diệu Thảo" → "TT"). */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Avatar chữ cái đầu kèm chấm xanh đang hoạt động; bấm mở menu Thông tin cá nhân / Tin nhắn / Đăng xuất. */
export function UserMenu({
  user,
  onProfile,
  onLogout,
  unreadMessages,
}: {
  user: SessionUser
  onProfile?: () => void
  onLogout: () => void
  /** Số tin NCC chưa đọc; truyền vào (kể cả 0) thì hiện mục Tin nhắn, chỉ dùng cho cặp đôi */
  unreadMessages?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = 'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-[9px] text-left text-[13.5px] [&_svg]:size-4'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Tài khoản: ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.name}
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-11 place-items-center rounded-full border border-[color-mix(in_srgb,var(--gold)_30%,transparent)] bg-accent-soft text-[15px] font-bold text-gold"
      >
        {initials(user.name)}
        <span aria-hidden className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-surface bg-sage" />
      </button>

      {open && (
        <div role="menu" className="absolute top-full right-0 z-50 mt-2 w-56 rounded-lg border border-line bg-surface p-1.5 shadow-card animate-in fade-in zoom-in-95">
          <div className="border-b border-line px-2.5 pt-1.5 pb-2.5">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          </div>
          {onProfile && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onProfile()
              }}
              className={cn(item, 'mt-1 text-ink hover:bg-accent-soft hover:text-gold')}
            >
              <UserRound />
              Thông tin cá nhân
            </button>
          )}
          {unreadMessages !== undefined && (
            <Link
              to={paths.chat}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(item, 'text-ink hover:bg-accent-soft hover:text-gold')}
              aria-label={unreadMessages ? `Tin nhắn, ${unreadMessages} chưa đọc` : 'Tin nhắn'}
            >
              <MessageCircle />
              Tin nhắn
              {unreadMessages > 0 && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-pill bg-notify px-1.5 text-[11px] leading-none font-bold text-white">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className={cn(item, 'text-warn hover:bg-warn-soft')}
          >
            <LogOut />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
