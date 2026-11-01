import type { Invite, InvitePreview, NewInvite, PublicPlan, PublicTabData, ShareLink } from '@/types/sharing'
import type { PlanTab } from '@/types/wedding'
import { http } from './client'

/** Hợp đồng: docs/api/sharing.md. Chưa có dữ liệu giả cho phần này (luôn gọi backend). */
export const sharingApi = {
  // Owner: link mời
  listInvites: (): Promise<Invite[]> => http.get('/weddings/me/invites'),
  createInvite: (body: NewInvite): Promise<Invite> => http.post('/weddings/me/invites', body),
  revokeInvite: (id: string): Promise<null> => http.delete(`/weddings/me/invites/${id}`),

  // Owner: link xem công khai
  getShareLink: (): Promise<ShareLink> => http.get('/weddings/me/share-link'),
  putShareLink: (body: { enabled?: boolean; tabs?: PlanTab[] }): Promise<ShareLink> => http.put('/weddings/me/share-link', body),
  regenerateShareLink: (): Promise<ShareLink> => http.post('/weddings/me/share-link/regenerate'),

  // Người nhận lời mời
  getInvite: (token: string): Promise<InvitePreview> => http.get(`/invites/${encodeURIComponent(token)}`),
  acceptInvite: (token: string, leaveOwnPlan = false): Promise<{ weddingId: string; joined: boolean }> =>
    http.post(`/invites/${encodeURIComponent(token)}/accept`, { leaveOwnPlan }),

  // Xem công khai
  getPublicPlan: (token: string): Promise<PublicPlan> => http.get(`/public/plans/${encodeURIComponent(token)}`),
  getPublicTab: <T extends PlanTab>(token: string, tab: T): Promise<PublicTabData[T]> => http.get(`/public/plans/${encodeURIComponent(token)}/${tab}`),
}

/** Link đầy đủ để sao chép (ghép theo địa chỉ trang đang mở). */
export const fullLink = (path: string) => `${window.location.origin}${path}`
