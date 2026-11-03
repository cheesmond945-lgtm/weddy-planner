/* Hợp đồng: docs/api/sharing.md */
import type { CategoryRef, ServiceSummary } from './catalog'
import type { Budget, GuestList, Overview, PlanItemStatus, PlanTab, TimelineItem } from './wedding'

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
