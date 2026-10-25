import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorsApi } from '@/api/vendors'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { UpdateVendorProfileRequest, VendorProfile, VendorUploadPurpose } from '@/types/vendor'

const profileKey = (userId: string | undefined) => ['vendor-profile', userId] as const

/** Hồ sơ của NCC đang đăng nhập. */
export function useVendorProfile() {
  const { user } = useAuth()
  return useQuery({ queryKey: profileKey(user?.id), queryFn: vendorsApi.getMyProfile, enabled: user?.role === 'VENDOR' })
}

/** Thông báo sau khi lưu: lưu nháp, gửi xác minh, lưu nhóm hiển thị của hồ sơ đã duyệt, hoặc gửi cập nhật. */
function savedMessage(submit: boolean, verified: boolean) {
  if (submit) return verified ? 'Đã gửi cập nhật. Hồ sơ vẫn hiển thị, Admin sẽ kiểm tra lại thông tin.' : 'Đã gửi hồ sơ xác minh. Nội dung chuyển sang chỉ đọc trong lúc chờ duyệt.'
  return verified ? 'Đã lưu thay đổi.' : 'Đã lưu hồ sơ, chưa gửi xác minh.'
}

/** Lưu ('submit' false) hoặc lưu và gửi xác minh / gửi cập nhật ('submit' true). Thành công thì thay hồ sơ trong cache bằng bản BE trả về. */
export function useSaveVendorProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, submit }: { body: UpdateVendorProfileRequest; submit: boolean; verified: boolean }) =>
      submit ? vendorsApi.submitMyProfile(body) : vendorsApi.updateMyProfile(body),
    onSuccess: (profile, { submit, verified }) => {
      qc.setQueryData<VendorProfile>(profileKey(user?.id), profile)
      toast(savedMessage(submit, verified))
    },
    onError: (err) => toast(err.message),
  })
}

export function useUploadVendorFile(purpose: VendorUploadPurpose) {
  return useMutation({ mutationFn: (file: File) => vendorsApi.uploadFile(file, purpose) })
}

/** "Tạo với AI": gợi ý đoạn giới thiệu từ thông tin đang nhập. */
export function useSuggestDescription() {
  return useMutation({ mutationFn: vendorsApi.suggestDescription, onError: (err) => toast(err.message) })
}
