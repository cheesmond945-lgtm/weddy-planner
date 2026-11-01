/* Hợp đồng: docs/api/sharing.md */
import type { CategoryRef, ServiceSummary } from './catalog'
import type { Budget, GuestList, MemberRole, Overview, PlanItemStatus, PlanTab, TimelineItem } from './wedding'

export type InviteRelation = 'BRIDE' | 'GROOM' | 'RELATIVE'

/** Link mời đang chờ (owner xem) */
export interface Invite {
  id: string
  /** Mã trong link; FE ghép thành \`\${location.origin}\${path}\` */
  token: string
  path: string
  relation: InviteRelation
  displayName: string | null
  role: Exclude<MemberRole, 'OWNER'>
  tabs: PlanTab[]
  expiresDate: string
  createdDate: string
}

export interface NewInvite {
  relation: InviteRelation
  displayName?: string
  role?: Exclude<MemberRole, 'OWNER'>
  tabs?: PlanTab[]
}

/** Lời mời người nhận xem trước (không cần đăng nhập) */
export interface InvitePreview {
  status: 'VALID' | 'USED' | 'REVOKED' | 'EXPIRED'
  wedding: { groomName: string; brideName: string; date: string }
  inviterName: string
  relation: InviteRelation
  displayName: string | null
  role: Exclude<MemberRole, 'OWNER'>
  tabs: PlanTab[]
  expiresDate: string
}

export interface ShareLink {
  enabled: boolean
  tabs: PlanTab[]
  token: string | null
  path: string | null
  updatedDate: string | null
}

export interface PublicPlan {
  wedding: { groomName: string; brideName: string; date: string }
  tabs: PlanTab[]
  /** Chỉ tên, không email */
  members: { name: string; role: MemberRole }[]
}

export interface PublicServices {
  categorySlugs: string[]
  /** price null khi tab Ngân sách không được chia sẻ */
  items: { id: string; service: ServiceSummary; status: PlanItemStatus; packageName: string; price: number | null }[]
}

export type PublicTabData = {
  overview: Overview
  timeline: { items: TimelineItem[] }
  services: PublicServices
  budget: Omit<Budget, 'version'>
  guests: GuestList
}

export type { CategoryRef }
