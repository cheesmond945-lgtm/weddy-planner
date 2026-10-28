import type { AiQuota, AiSuggestion } from '@/types/ai'
import type { UpdateVendorProfileRequest, VendorFile, VendorNotificationList, VendorProfile, VendorUploadPurpose } from '@/types/vendor'
import { http } from './client'

/** Hợp đồng: docs/api/vendors.md */
export const vendorsApi = {
  getMyProfile: (): Promise<VendorProfile> =>
    http.get('/vendors/me/profile'),

  /** Lưu nháp */
  updateMyProfile: (body: UpdateVendorProfileRequest): Promise<VendorProfile> =>
    http.patch('/vendors/me/profile', body),

  /** Lưu và gửi xác minh */
  submitMyProfile: (body: UpdateVendorProfileRequest): Promise<VendorProfile> =>
    http.post('/vendors/me/profile/submit', body),

  /** Gợi ý đoạn giới thiệu (nút "Tạo với AI") */
  suggestDescription: (body: { style: string; businessName: string | null; ward: string | null; province: string | null; hint?: string | null }): Promise<AiSuggestion> =>
    http.post('/vendors/me/profile/suggest-description', body),

  /** Số lượt Tạo với AI còn lại hôm nay (dùng chung cho hồ sơ và gói) */
  aiQuota: (): Promise<AiQuota> => http.get('/vendors/me/ai-quota'),

  listNotifications: (): Promise<VendorNotificationList> => http.get('/vendors/me/notifications', { query: { limit: 20 } }),
  readNotification: (id: string): Promise<null> => http.post(`/vendors/me/notifications/${id}/read`),
  readAllNotifications: (): Promise<null> => http.post('/vendors/me/notifications/read-all'),

  /** Upload qua backend, tệp lưu ở Supabase Storage (thay cho Cloudinary trong docs/api/vendors.md). */
  uploadFile: async (file: File, purpose: VendorUploadPurpose): Promise<VendorFile> => {
    const form = new FormData()
    form.append('purpose', purpose)
    form.append('file', file)
    return http.post<VendorFile>('/vendors/me/uploads', form)
  },
}
