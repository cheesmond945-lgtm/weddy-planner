/** Lịch khả dụng theo gói của Trung tâm tiệc cưới (docs/api/availability.md). */
export type DayStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'UNKNOWN'

export interface PackageDayStatus {
  packageId: string
  name: string
  status: DayStatus
}

/** GET /availability/services: trạng thái từng gói trong một ngày, theo id dịch vụ */
export interface ServicesAvailability {
  date: string
  services: Record<string, PackageDayStatus[]>
}

export interface PackageMonth {
  packageId: string
  month: string
  days: { date: string; status: DayStatus }[]
}

export interface VendorDay {
  date: string
  /** Trạng thái khách thấy (đã xét gói cùng sảnh) */
  status: DayStatus
  /** Trạng thái NCC tự đặt cho gói này */
  own: DayStatus
  /** Gói cùng sảnh làm ngày này kín / giữ chỗ */
  blockedBy: string | null
}

export interface VendorPackageMonth {
  packageId: string
  month: string
  resource: string | null
  sharedWith: string[]
  lastUpdated: string | null
  today: string
  days: VendorDay[]
}

export interface SetDaysResult {
  updated: number
  status: DayStatus
  conflicts: { date: string; status: DayStatus; packageName: string }[]
  sharedWith: string[]
}

export type AvailabilityReminder =
  | { applicable: false }
  | { applicable: true; packages: number; lastUpdated: string | null; daysSinceUpdate: number | null; missingDays: number; windowDays: number; needsUpdate: boolean }
