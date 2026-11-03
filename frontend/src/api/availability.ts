import type { AvailabilityReminder, DayStatus, PackageDayStatus, PackageMonth, ServicesAvailability, SetDaysResult, VendorPackageMonth } from '@/types/availability'
import { http } from './client'

/* Lịch khả dụng theo gói (docs/api/availability.md). */

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
    http.get(`/availability/services?ids=${ids.map(encodeURIComponent).join(',')}&date=${date}`),

  /** Một dịch vụ trong một ngày (gộp request với các thẻ khác). null: không phải trung tâm tiệc cưới / không hiển thị. */
  forService: (id: string, date: string) =>
    new Promise<PackageDayStatus[] | null>((resolve, reject) => {
      const q = queues.get(date) ?? []
      if (!q.length) setTimeout(() => flush(date), 0)
      q.push({ id, resolve, reject })
      queues.set(date, q)
    }),

  packageMonth: (packageId: string, month: string): Promise<PackageMonth> =>
    http.get(`/availability/packages/${packageId}?month=${month}`),

  // ---- NCC ----

  vendorMonth: (packageId: string, month: string): Promise<VendorPackageMonth> =>
    http.get(`/vendors/me/availability/packages/${packageId}?month=${month}`),

  setDays: (packageId: string, dates: string[], status: DayStatus): Promise<SetDaysResult> =>
    http.put(`/vendors/me/availability/packages/${packageId}`, { dates, status }),

  setResource: (packageId: string, name: string | null): Promise<{ resource: string | null; sharedWith: string[] }> =>
    http.put(`/vendors/me/availability/packages/${packageId}/resource`, { name }),

  reminder: (): Promise<AvailabilityReminder> => http.get('/vendors/me/availability/reminder'),
}
