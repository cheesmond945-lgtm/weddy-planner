import { useCallback, useSyncExternalStore } from 'react'

/*
 * Nhà cung cấp đang chọn để so sánh (3.3), như S.cmp trong prototype.
 * Giữ trong tab đang mở (sessionStorage): quay lại từ trang so sánh hoặc tải lại trang vẫn còn.
 * Không lưu lên BE.
 */
export const MAX_COMPARE = 3
const STORAGE_KEY = 'weddy.compare'

export interface CompareItem {
  id: string
  name: string
  imageUrl: string
  categorySlug: string
  categoryName: string
}

/** Kết quả một lần chọn/bỏ chọn, để giao diện báo cho người dùng. */
export type ToggleResult = { kind: 'added' | 'removed' } | { kind: 'switched'; categoryName: string } | { kind: 'full' }

function load(): CompareItem[] {
  try {
    const items = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as CompareItem[]
    return Array.isArray(items) && items.every((i) => i.id && i.categorySlug) ? items : []
  } catch {
    return []
  }
}

let items: CompareItem[] = load()
const listeners = new Set<() => void>()

function set(next: CompareItem[]) {
  items = next
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // bỏ qua
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const compareStore = {
  getItems: () => items,

  /**
   * Chọn/bỏ chọn (toggleCmp trong prototype):
   * - khác hạng mục với lựa chọn đang có: thay hết bằng mục mới (không chặn);
   * - đã đủ 3 cùng hạng mục: không thêm.
   */
  toggle(item: CompareItem): ToggleResult {
    if (items.some((i) => i.id === item.id)) {
      set(items.filter((i) => i.id !== item.id))
      return { kind: 'removed' }
    }
    if (items.length && items[0].categorySlug !== item.categorySlug) {
      set([item])
      return { kind: 'switched', categoryName: item.categoryName }
    }
    if (items.length >= MAX_COMPARE) return { kind: 'full' }
    set([...items, item])
    return { kind: 'added' }
  },

  /** Chọn đúng danh sách này (So sánh cả nhóm). */
  replace: (next: CompareItem[]) => set(next.slice(0, MAX_COMPARE)),
  remove: (id: string) => items.some((i) => i.id === id) && set(items.filter((i) => i.id !== id)),
  clear: () => items.length && set([]),
}

/** Toàn bộ danh sách đang chọn (thanh so sánh). */
export function useCompare() {
  return useSyncExternalStore(subscribe, () => items)
}

/**
 * Trạng thái của một thẻ: 'on' (đang chọn), 'off' (bị khóa vì đã đủ 3 cùng hạng mục), 'idle'.
 * Trả chuỗi nên chỉ thẻ đổi trạng thái mới vẽ lại, các thẻ khác giữ nguyên.
 */
export function useCompareState(id: string, categorySlug: string): 'on' | 'off' | 'idle' {
  const get = useCallback(() => {
    if (items.some((i) => i.id === id)) return 'on'
    if (items.length >= MAX_COMPARE && items[0].categorySlug === categorySlug) return 'off'
    return 'idle'
  }, [id, categorySlug])
  return useSyncExternalStore(subscribe, get)
}
