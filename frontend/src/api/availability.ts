import type { AvailabilityReminder, DayStatus, PackageDayStatus, PackageMonth, ServicesAvailability, SetDaysResult, VendorPackageMonth } from '@/types/availability'
import { http } from './client'
import { isMock, mockDelay } from './mock'

/*
 * Lịch khả dụng theo gói (docs/api/availability.md). Phía khách đi theo nhóm 'catalog', phía NCC theo nhóm 'vendors'.
 * Dữ liệu giả: trạng thái sinh cố định theo (gói, ngày) để chạy thử giao diện khi chưa bật API thật.
 */

const STATUSES: DayStatus[] = ['AVAILABLE', 'AVAILABLE', 'AVAILABLE', 'HELD', 'BOOKED', 'UNKNOWN']
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const mockStatus = (packageId: string, date: string) => STATUSES[hash(`${packageId}|${date}`) % STATUSES.length]
const mockDays = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}
const mockOwn = new Map<string, DayStatus>()
const mockResource = new Map<string, string | null>()

// Gộp các thẻ dịch vụ cùng hiện một lúc thành một request (mỗi thẻ hỏi một dịch vụ)
type Pending = { id: string; resolve: (v: PackageDayStatus[] | null) => void; reject: (e: unknown) => void }
const queues = new Map<string, Pending[]>()

function flush(date: string) {
  const batch = queues.get(date) ?? []
  queues.delete(date)
  const ids = [...new Set(batch.map((b) => b.id))]
  availabilityApi.forServices(ids, date).then(
    (r) => batch.forEach((b) => b.resolve(r.services[b.id] ?? null)),
    (e) => batch.forEach((b) => b.reject(e)),
  )
}

export const availabilityApi = {
  forServices: (ids: string[], date: string): Promise<ServicesAvailability> =>
    isMock('catalog')
      ? mockDelay({ date, services: {} }, 200)
      : http.get(`/availability/services?ids=${ids.map(encodeURIComponent).join(',')}&date=${date}`),

  /** Một dịch vụ trong một ngày (gộp request với các thẻ khác). null: không phải trung tâm tiệc cưới / không hiển thị. */
  forService: (id: string, date: string) =>
    new Promise<PackageDayStatus[] | null>((resolve, reject) => {
      const q = queues.get(date) ?? []
      if (!q.length) setTimeout(() => flush(date), 0)
      q.push({ id, resolve, reject })
      queues.set(date, q)
    }),

  packageMonth: (packageId: string, month: string): Promise<PackageMonth> =>
    isMock('catalog')
      ? mockDelay({ packageId, month, days: mockDays(month).map((date) => ({ date, status: mockOwn.get(`${packageId}|${date}`) ?? mockStatus(packageId, date) })) }, 200)
      : http.get(`/availability/packages/${packageId}?month=${month}`),

  // ---- NCC ----

  vendorMonth: (packageId: string, month: string): Promise<VendorPackageMonth> =>
    isMock('vendors')
      ? mockDelay(
          {
            packageId,
            month,
            resource: mockResource.get(packageId) ?? null,
            sharedWith: [],
            lastUpdated: null,
            today: new Date().toISOString().slice(0, 10),
            days: mockDays(month).map((date) => {
              const own = mockOwn.get(`${packageId}|${date}`) ?? 'UNKNOWN'
              return { date, status: own, own, blockedBy: null }
            }),
          },
          200,
        )
      : http.get(`/vendors/me/availability/packages/${packageId}?month=${month}`),

  setDays: (packageId: string, dates: string[], status: DayStatus): Promise<SetDaysResult> =>
    isMock('vendors')
      ? mockDelay(null, 250).then(() => {
          for (const d of dates) {
            if (status === 'UNKNOWN') mockOwn.delete(`${packageId}|${d}`)
            else mockOwn.set(`${packageId}|${d}`, status)
          }
          return { updated: dates.length, status, conflicts: [], sharedWith: [] }
        })
      : http.put(`/vendors/me/availability/packages/${packageId}`, { dates, status }),

  setResource: (packageId: string, name: string | null): Promise<{ resource: string | null; sharedWith: string[] }> =>
    isMock('vendors')
      ? mockDelay(null, 250).then(() => (mockResource.set(packageId, name?.trim() || null), { resource: name?.trim() || null, sharedWith: [] }))
      : http.put(`/vendors/me/availability/packages/${packageId}/resource`, { name }),

  reminder: (): Promise<AvailabilityReminder> => (isMock('vendors') ? mockDelay({ applicable: false as const }, 200) : http.get('/vendors/me/availability/reminder')),
}
