import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hallsApi } from '@/api/halls'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { BusyInput } from '@/types/hall'

/** Khóa cache. Phía NCC nằm dưới ['vendor', uid, …] như các khóa khác của NCC (RealtimeBridge làm mới theo tiền tố). */
export const hallKeys = {
  vendorHalls: (uid: string | undefined) => ['vendor', uid, 'halls'] as const,
  vendorBusy: (uid: string | undefined, from?: string, to?: string) => (from && to ? (['vendor', uid, 'busy', from, to] as const) : (['vendor', uid, 'busy'] as const)),
  hallDates: (packageId: string, from: string, to: string) => ['halls', 'busy', packageId, from, to] as const,
  free: (date: string, ids: readonly string[]) => ['halls', 'free', date, ids] as const,
}

/** Số trung tâm tối đa một lần hỏi số sảnh trống (giới hạn của API). */
const FREE_MAX_IDS = 100

function useVendorId() {
  const { user } = useAuth()
  return user?.role === 'VENDOR' ? user.id : undefined
}

/** Các sảnh của NCC (form đơn, tab Lịch bận); enabled = false nếu không phải trung tâm sự kiện. */
export function useVendorHalls() {
  const uid = useVendorId()
  return useQuery({ queryKey: hallKeys.vendorHalls(uid), queryFn: hallsApi.vendorHalls, enabled: !!uid, staleTime: 5 * 60_000 })
}

/** Lịch bận của NCC trong khoảng ngày của lưới tháng đang xem. */
export function useVendorBusy(from: string, to: string, enabled = true) {
  const uid = useVendorId()
  return useQuery({
    queryKey: hallKeys.vendorBusy(uid, from, to),
    queryFn: () => hallsApi.vendorBusy(from, to),
    enabled: !!uid && enabled,
    placeholderData: keepPreviousData,
  })
}

/** Đánh dấu bận thủ công; báo nếu có đơn chờ cọc rơi vào khoảng đó (khách sẽ không cọc được). */
export function useAddBusy() {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BusyInput) => hallsApi.addBusy(body),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: hallKeys.vendorBusy(uid) })
      void qc.invalidateQueries({ queryKey: ['halls'] })
      const waiting = r.waitingOrders.length
        ? ` Có ${r.waitingOrders.length} đơn chờ cọc trong khoảng này (${r.waitingOrders.map((o) => o.orderCode).join(', ')}): khách sẽ không đặt cọc được, hãy nhắn khách đổi ngày hoặc sảnh.`
        : ''
      toast(`Đã đánh dấu bận cho ${r.created} sảnh.${waiting}`, waiting ? 9000 : undefined)
    },
  })
}

/** Gỡ một lần đánh dấu bận thủ công. */
export function useRemoveBusy() {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => hallsApi.removeBusy(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hallKeys.vendorBusy(uid) })
      void qc.invalidateQueries({ queryKey: ['halls'] })
      toast('Đã gỡ ngày bận')
    },
    onError: (e) => toast(e.message),
  })
}

/** Ngày bận của một sảnh (công khai): lưới tháng của khách, kiểm ngày cưới (from = to), cảnh báo trong form đơn của NCC. */
export function useHallDates(packageId: string | null | undefined, from: string, to: string) {
  return useQuery({
    queryKey: hallKeys.hallDates(packageId ?? '', from, to),
    queryFn: () => hallsApi.hallDates(packageId!, from, to),
    enabled: !!packageId && !!from && !!to,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  })
}

/** Số sảnh còn trống ngày `date` của các trung tâm sự kiện đang hiện (nhãn ngày cưới); quá 100 thì chỉ hỏi 100 NCC đầu. */
export function useHallsFree(date: string | null | undefined, ids: readonly string[]) {
  const asked = ids.slice(0, FREE_MAX_IDS)
  return useQuery({
    queryKey: hallKeys.free(date ?? '', asked),
    queryFn: () => hallsApi.free(date!, asked),
    enabled: !!date && asked.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
