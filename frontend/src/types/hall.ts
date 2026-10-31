/*
 * Lịch bận theo sảnh của Trung tâm tổ chức sự kiện (docs/LICH_BAN_SANH.md). Sảnh = một gói dịch vụ của trung tâm.
 * Bận khi có đơn Đã cọc / Hoàn thành của sảnh vào ngày thực hiện (nguồn "Đơn"), hoặc NCC tự đánh dấu (nguồn "Thủ công").
 */

/** Một sảnh của NCC (gói đang đăng hoặc đã ẩn). */
export interface HallRef {
  id: string
  name: string
  /** Gói đã ẩn: không nhận đơn mới nhưng có thể còn đơn cũ */
  hidden: boolean
}

export type BusySource =
  | { kind: 'ORDER'; orderId: string; orderCode: string; customerName: string }
  /** startDate, endDate: cả khoảng của lần đánh dấu (gỡ là gỡ cả khoảng) */
  | { kind: 'MANUAL'; busyId: string; reason: string; startDate: string; endDate: string }

/** Một ngày bận của một sảnh, kèm nguồn (phía NCC). */
export interface BusyDay {
  packageId: string
  /** "YYYY-MM-DD" */
  date: string
  source: BusySource
}

/** GET /vendors/me/busy-dates: enabled = false nếu NCC không phải Trung tâm tổ chức sự kiện. */
export interface VendorBusyCalendar {
  enabled: boolean
  halls: HallRef[]
  items: BusyDay[]
}

/** POST /vendors/me/busy-dates */
export interface BusyInput {
  packageIds: string[]
  startDate: string
  /** Bỏ trống: một ngày */
  endDate?: string
  reason: string
}

export interface AddBusyResult {
  created: number
  /** Đơn chờ cọc / chờ chỉnh sửa rơi vào khoảng vừa đánh dấu: khách sẽ không đặt cọc được */
  waitingOrders: { orderCode: string; date: string; hallName: string }[]
}

/** GET /halls/free: số sảnh (gói đang đăng) và số sảnh còn trống của một trung tâm sự kiện trong một ngày. */
export interface HallsFree {
  halls: number
  free: number
}
