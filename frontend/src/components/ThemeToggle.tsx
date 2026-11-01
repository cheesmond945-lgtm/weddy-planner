import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'

export const THEME_KEY = 'weddy.theme'

/** Nạp giao diện sáng / tối đã lưu lên <html> (gọi trong layout cổng Admin, NCC). */
export function applySavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved
  } catch {
    // localStorage bị chặn: theo hệ điều hành
  }
}

/** Nút sáng / tối ở header. */
export function ThemeToggle() {
  const isDark = () => (document.documentElement.dataset.theme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark'
  const [dark, setDark] = useState(isDark)
  function toggle() {
    const next = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // bỏ qua
    }
    setDark(!dark)
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={dark ? 'Giao diện sáng' : 'Giao diện tối'}
      className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  )
}
