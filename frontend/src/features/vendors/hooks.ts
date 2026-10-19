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

/** Lưu nháp ('draft') hoặc lưu và gửi xác minh ('submit'). Thành công thì thay hồ sơ trong cache bằng bản BE trả về. */
export function useSaveVendorProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, submit }: { body: UpdateVendorProfileRequest; submit: boolean }) =>
      submit ? vendorsApi.submitMyProfile(body) : vendorsApi.updateMyProfile(body),
    onSuccess: (profile, { submit }) => {
      qc.setQueryData<VendorProfile>(profileKey(user?.id), profile)
      toast(submit ? 'Đã gửi hồ sơ xác minh. Nội dung chuyển sang chỉ đọc trong lúc chờ duyệt.' : 'Đã lưu nháp hồ sơ, chưa gửi xác minh.')
    },
    onError: (err) => toast(err.message),
  })
}

export function useUploadVendorFile(purpose: VendorUploadPurpose) {
  return useMutation({ mutationFn: (file: File) => vendorsApi.uploadFile(file, purpose) })
}
