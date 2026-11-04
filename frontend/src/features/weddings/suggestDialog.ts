import { useSyncExternalStore } from 'react'

/** Popup "Gợi ý {dịch vụ}" (SuggestionsDialog, gắn một lần ở CoupleLayout): slug hạng mục đang mở, null là đóng. */
let slug: string | null = null
const listeners = new Set<() => void>()
const set = (next: string | null) => {
  slug = next
  listeners.forEach((l) => l())
}

export const openSuggestions = (categorySlug: string) => set(categorySlug)
export const closeSuggestions = () => set(null)

export function useSuggestDialog() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => slug,
  )
}
