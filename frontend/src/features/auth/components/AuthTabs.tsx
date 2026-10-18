import { cn } from '@/lib/utils'
import type { AuthDialogMode } from '../authDialog'

const TABS: { mode: AuthDialogMode; label: string }[] = [
  { mode: 'login', label: 'Đăng nhập' },
  { mode: 'register', label: 'Đăng ký' },
]

/** Nút chuyển Đăng nhập / Đăng ký, theo .seg trong prototype. */
export function AuthTabs({ mode, onChange }: { mode: AuthDialogMode; onChange: (mode: AuthDialogMode) => void }) {
  return (
    <div className="mb-5 inline-flex gap-0.5 rounded-md border border-line bg-surface p-[3px]">
      {TABS.map((t) => (
        <button
          key={t.mode}
          type="button"
          aria-pressed={mode === t.mode}
          onClick={() => onChange(t.mode)}
          className={cn(
            'rounded-[7px] px-3.5 py-2 text-sm font-medium transition-colors',
            mode === t.mode ? 'bg-ink text-bg' : 'text-muted-foreground hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
