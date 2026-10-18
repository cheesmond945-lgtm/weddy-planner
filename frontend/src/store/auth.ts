import { useSyncExternalStore } from 'react'
import type { Role, Session, SessionUser } from '@/types/auth'

/*
 * Lưu phiên đăng nhập (token + người dùng) trong localStorage.
 * Dùng external store để cả component React lẫn src/api đọc được cùng một nguồn.
 */
const STORAGE_KEY = 'weddy.session'

function load(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

let session: Session | null = load()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export const authStore = {
  getSession: () => session,
  getToken: () => session?.accessToken ?? null,

  setSession(next: Session) {
    session = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage bị chặn: vẫn giữ phiên trong bộ nhớ
    }
    emit()
  },

  updateUser(user: SessionUser) {
    if (session) authStore.setSession({ ...session, user })
  },

  clear() {
    session = null
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // bỏ qua
    }
    emit()
  },

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

// Đồng bộ khi đăng nhập/đăng xuất ở tab khác
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    session = load()
    emit()
  }
})

export function useAuth() {
  const current = useSyncExternalStore(authStore.subscribe, authStore.getSession)
  return {
    session: current,
    user: current?.user ?? null,
    isAuthenticated: current !== null,
    hasRole: (...roles: Role[]) => (current ? roles.includes(current.user.role) : false),
    login: authStore.setSession,
    logout: authStore.clear,
  }
}
