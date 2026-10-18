import { useSyncExternalStore } from 'react'

export type AuthDialogMode = 'login' | 'register'

interface AuthDialogState {
  open: boolean
  mode: AuthDialogMode
  /** Trang mở tiếp sau khi đăng nhập/đăng ký xong (như S._after trong prototype). */
  redirectTo: string | null
  /** Việc làm tiếp sau khi cặp đôi đăng nhập xong (ví dụ thả tim dịch vụ vừa bấm). */
  onAuthenticated: (() => void) | null
}

let state: AuthDialogState = { open: false, mode: 'login', redirectTo: null, onAuthenticated: null }
const listeners = new Set<() => void>()
const set = (next: Partial<AuthDialogState>) => {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

/** Mở modal đăng nhập/đăng ký từ bất cứ đâu. */
export function openAuthDialog(
  mode: AuthDialogMode = 'login',
  redirectTo: string | null = null,
  onAuthenticated: (() => void) | null = null,
) {
  set({ open: true, mode, redirectTo, onAuthenticated })
}

export function closeAuthDialog() {
  set({ open: false, onAuthenticated: null })
}

export function setAuthDialogMode(mode: AuthDialogMode) {
  set({ mode })
}

export function useAuthDialog() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}
