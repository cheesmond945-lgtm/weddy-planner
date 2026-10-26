import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import type { AuthDialogMode } from '../authDialog'

const TABS: { mode: AuthDialogMode; label: string }[] = [
  { mode: 'login', label: 'Đăng nhập' },
  { mode: 'register', label: 'Đăng ký' },
]

const tabClass = (active: boolean) =>
  cn(
    '-mb-px flex-1 border-b-2 py-3 text-center font-serif text-[15px] font-semibold tracking-[0.2em] uppercase transition-colors',
    active ? 'border-gold-500 text-gold-700' : 'border-transparent text-ink-2 hover:text-ink',
  )

interface AuthTabsProps {
  mode: AuthDialogMode
  /** Modal: đổi tab tại chỗ */
  onChange?: (mode: AuthDialogMode) => void
  /** Trang riêng: mỗi tab là một đường dẫn (giữ state, ví dụ trang định vào) */
  hrefs?: Record<AuthDialogMode, string>
  linkState?: unknown
}

/** Tab Đăng nhập / Đăng ký dạng gạch chân. */
export function AuthTabs({ mode, onChange, hrefs, linkState }: AuthTabsProps) {
  return (
    <div role="tablist" aria-label="Đăng nhập hoặc đăng ký" className="mb-6 flex border-b border-line [@media(max-height:820px)]:mb-4">
      {TABS.map((t) =>
        hrefs ? (
          <Link key={t.mode} to={hrefs[t.mode]} state={linkState} replace role="tab" aria-selected={mode === t.mode} className={tabClass(mode === t.mode)}>
            {t.label}
          </Link>
        ) : (
          <button key={t.mode} type="button" role="tab" aria-selected={mode === t.mode} onClick={() => onChange?.(t.mode)} className={tabClass(mode === t.mode)}>
            {t.label}
          </button>
        ),
      )}
    </div>
  )
}
