import type { BadgeTone } from '@/components/Badge'
import type { AdminPackageStatus } from '@/types/admin'

/** Nhãn trạng thái gói phía Admin (cùng nhãn với NCC, thêm "Cần chỉnh sửa" khi Admin đã yêu cầu sửa). */
export const ADMIN_PACKAGE_STATUS: Record<AdminPackageStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Chờ duyệt', tone: 'info' },
  NEEDS_REVISION: { label: 'Cần chỉnh sửa', tone: 'warn' },
  PUBLISHED: { label: 'Đã đăng', tone: 'done' },
  HIDDEN: { label: 'Ẩn', tone: 'neutral' },
}
