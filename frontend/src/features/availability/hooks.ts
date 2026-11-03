import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { availabilityApi } from '@/api/availability'
import { useWedding } from '@/features/weddings/hooks'
import type { DayStatus } from '@/types/availability'

export const availabilityKeys = {
  service: (id: string, date: string) => ['availability', 'service', id, date] as const,
  month: (packageId: string, month: string) => ['availability', 'month', packageId, month] as const,
  vendorMonth: (packageId: string, month: string) => ['availability', 'vendor', packageId, month] as const,
  reminder: ['availability', 'reminder'] as const,
}

/** SQL chưa chạy (503) hay lỗi khác: phía khách ẩn phần lịch, không thử lại liên tục. */
const quiet = { retry: false, staleTime: 60_000 } as const

/** Ngày cưới và số khách trong hồ sơ đám cưới của khách đang đăng nhập (chưa đăng nhập / chưa có: null). */
export function useWeddingDate() {
  const { data } = useWedding()
  return { date: data?.date ?? null, guestCount: data?.guestCount ?? null }
}

export function useServiceAvailability(serviceId: string, date: string | null, enabled = true) {
  return useQuery({
    queryKey: availabilityKeys.service(serviceId, date ?? ''),
    queryFn: () => availabilityApi.forService(serviceId, date!),
    enabled: enabled && !!date,
    ...quiet,
  })
}

export function usePackageMonth(packageId: string, month: string) {
  return useQuery({ queryKey: availabilityKeys.month(packageId, month), queryFn: () => availabilityApi.packageMonth(packageId, month), ...quiet })
}

export function useVendorMonth(packageId: string, month: string) {
  return useQuery({ queryKey: availabilityKeys.vendorMonth(packageId, month), queryFn: () => availabilityApi.vendorMonth(packageId, month), retry: false })
}

export function useAvailabilityReminder() {
  return useQuery({ queryKey: availabilityKeys.reminder, queryFn: availabilityApi.reminder, retry: false, staleTime: 5 * 60_000 })
}

/** Ghi lịch / sảnh: làm mới mọi lịch (gói cùng sảnh cũng đổi) và nhắc cập nhật. */
export function useAvailabilityMutations(packageId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['availability'] })
  return {
    setDays: useMutation({ mutationFn: ({ dates, status }: { dates: string[]; status: DayStatus }) => availabilityApi.setDays(packageId, dates, status), onSuccess: refresh }),
    setResource: useMutation({ mutationFn: (name: string | null) => availabilityApi.setResource(packageId, name), onSuccess: refresh }),
  }
}
