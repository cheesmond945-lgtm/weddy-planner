import { mockVendors } from '@/mocks/vendors'
import { authStore } from '@/store/auth'
import type { UpdateVendorProfileRequest, UploadSignature, VendorFile, VendorProfile, VendorUploadPurpose } from '@/types/vendor'
import { ApiError, http } from './client'
import { USE_MOCK, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

/** Upload thẳng lên Cloudinary bằng chữ ký BE cấp (docs/api/README.md mục 9). */
async function uploadToCloudinary(file: File, sig: UploadSignature): Promise<VendorFile> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sig.apiKey)
  form.append('timestamp', String(sig.timestamp))
  form.append('signature', sig.signature)
  form.append('folder', sig.folder)

  let res: Response
  try {
    res = await fetch(sig.uploadUrl, { method: 'POST', body: form })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không tải được tệp lên, kiểm tra kết nối mạng.')
  }
  if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', 'Tải tệp lên không thành công, vui lòng thử lại.')
  const body = (await res.json()) as { secure_url: string; public_id: string }
  return { url: body.secure_url, publicId: body.public_id, fileName: file.name, size: file.size, mimeType: file.type }
}

/** Hợp đồng: docs/api/vendors.md */
export const vendorsApi = {
  getMyProfile: (): Promise<VendorProfile> =>
    USE_MOCK ? mockDelay(null).then(() => mockVendors.getMyProfile(mockUserId())) : http.get('/vendors/me/profile'),

  /** Lưu nháp */
  updateMyProfile: (body: UpdateVendorProfileRequest): Promise<VendorProfile> =>
    USE_MOCK ? mockDelay(null, 500).then(() => mockVendors.updateMyProfile(mockUserId(), body)) : http.patch('/vendors/me/profile', body),

  /** Lưu và gửi xác minh */
  submitMyProfile: (body: UpdateVendorProfileRequest): Promise<VendorProfile> =>
    USE_MOCK ? mockDelay(null, 600).then(() => mockVendors.submitMyProfile(mockUserId(), body)) : http.post('/vendors/me/profile/submit', body),

  uploadFile: async (file: File, purpose: VendorUploadPurpose): Promise<VendorFile> => {
    if (USE_MOCK) return mockDelay(null, 400).then(() => mockVendors.uploadFile(file, purpose))
    const sig = await http.post<UploadSignature>('/vendors/me/uploads/signature', { purpose })
    return uploadToCloudinary(file, sig)
  },
}
