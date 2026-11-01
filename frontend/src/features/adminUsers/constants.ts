import type { BadgeTone } from '@/components/Badge'
import type { Role } from '@/types/auth'
import type { AdminUserStatus } from '@/types/admin'

export const ROLE_LABEL: Record<Role, string> = {
  COUPLE: 'Cặp đôi',
  VENDOR: 'Nhà cung cấp',
  ADMIN: 'Quản trị viên',
}

export const USER_STATUS: Record<AdminUserStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Hoạt động', tone: 'done' },
  LOCKED: { label: 'Ngừng hoạt động', tone: 'warn' },
}

export const PAGE_SIZE = 10
