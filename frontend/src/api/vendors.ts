import { mockVendors } from '@/mocks/vendors'
import { authStore } from '@/store/auth'
import type { UpdateVendorProfileRequest, VendorFile, VendorProfile, VendorUploadPurpose } from '@/types/vendor'
import { ApiError, http } from './client'
import { isMock, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

/** Hợp đồng: docs/api/vendors.md */
export const vendorsApi = {
  getMyProfile: (): Promise<VendorProfile> =>
    isMock('vendors') ? mockDelay(null).then(() => mockVendors.getMyProfile(mockUserId())) : http.get('/vendors/me/profile'),

  /** Lưu nháp */
  updateMyProfile: (body: UpdateVendorProfileRequest): Promise<VendorProfile> =>
    isMock('vendors') ? mockDelay(null, 500).then(() => mockVendors.updateMyProfile(mockUserId(), body)) : http.patch('/vendors/me/profile', body),

  /** Lưu và gửi xác minh */
  submitMyProfile: (body: UpdateVendorProfileRequest): Promise<VendorProfile> =>
    isMock('vendors') ? mockDelay(null, 600).then(() => mockVendors.submitMyProfile(mockUserId(), body)) : http.post('/vendors/me/profile/submit', body),

  /** Upload qua backend, tệp lưu ở Supabase Storage (thay cho Cloudinary trong docs/api/vendors.md). */
  uploadFile: async (file: File, purpose: VendorUploadPurpose): Promise<VendorFile> => {
    if (isMock('vendors')) return mockDelay(null, 400).then(() => mockVendors.uploadFile(file, purpose))
    const form = new FormData()
    form.append('purpose', purpose)
    form.append('file', file)
    return http.post<VendorFile>('/vendors/me/uploads', form)
  },
}
