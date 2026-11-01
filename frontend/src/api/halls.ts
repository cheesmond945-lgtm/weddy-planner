import type { AddBusyResult, BusyInput, HallRef, HallsFree, VendorBusyCalendar } from '@/types/hall'
import { http } from './client'

/** Lịch bận theo sảnh (Trung tâm tổ chức sự kiện). Hợp đồng: docs/LICH_BAN_SANH.md */
export const hallsApi = {
  /** Các sảnh của NCC (form đơn chọn sảnh, tab Lịch bận); enabled = false nếu không phải trung tâm sự kiện. */
  vendorHalls: (): Promise<{ enabled: boolean; halls: HallRef[] }> =>
    http.get('/vendors/me/halls'),

  /** Lịch bận của NCC trong [from, to] (YYYY-MM-DD, tối đa 100 ngày): từng (sảnh, ngày, nguồn). */
  vendorBusy: (from: string, to: string): Promise<VendorBusyCalendar> =>
    http.get('/vendors/me/busy-dates', { query: { from, to } }),

  /** NCC đánh dấu bận thủ công (một hoặc nhiều sảnh, một ngày hoặc khoảng ngày, lý do). */
  addBusy: (body: BusyInput): Promise<AddBusyResult> =>
    http.post('/vendors/me/busy-dates', body),

  /** Gỡ một lần đánh dấu bận thủ công (cả khoảng ngày của lần đó). */
  removeBusy: (id: string): Promise<{ id: string }> =>
    http.delete(`/vendors/me/busy-dates/${id}`),

  /** Ngày bận của một sảnh cho khách (công khai, chỉ ngày): hall = false nếu gói không thuộc trung tâm sự kiện. */
  hallDates: (packageId: string, from: string, to: string): Promise<{ hall: boolean; dates: string[] }> =>
    http.get(`/halls/${packageId}/busy`, { query: { from, to } }),

  /** Số sảnh còn trống ngày `date` của các trung tâm sự kiện trong `ids` (tối đa 100); NCC khác không có mặt. */
  free: (date: string, ids: readonly string[]): Promise<Record<string, HallsFree>> =>
    http.get('/halls/free', { query: { date, ids: ids.join(',') } }),
}
