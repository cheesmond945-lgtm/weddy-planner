import type { ServiceSummary } from '@/types/catalog'
import { mockCatalog } from './catalog'

/* Dịch vụ yêu thích giả, lưu theo từng người dùng trong localStorage. Ban đầu trống như prototype. */
const STORAGE_KEY = 'weddy.mock.favorites'

function load(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string[]>
  } catch {
    return {}
  }
}

const save = (data: Record<string, string[]>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // bỏ qua
  }
}

export const mockFavorites = {
  list(userId: string): ServiceSummary[] {
    return (load()[userId] ?? []).map((id) => mockCatalog.getSummary(id))
  },

  add(userId: string, serviceId: string) {
    mockCatalog.getService(serviceId) // 404 nếu không có dịch vụ
    const data = load()
    const ids = data[userId] ?? []
    if (!ids.includes(serviceId)) data[userId] = [...ids, serviceId]
    save(data)
  },

  remove(userId: string, serviceId: string) {
    const data = load()
    data[userId] = (data[userId] ?? []).filter((id) => id !== serviceId)
    save(data)
  },
}
