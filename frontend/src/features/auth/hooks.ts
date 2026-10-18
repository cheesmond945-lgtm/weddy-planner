import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { authStore } from '@/store/auth'

export function useLogin() {
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (session) => authStore.setSession(session),
  })
}

/** Bước 1 đăng ký: gửi thông tin, BE gửi OTP về email. */
export function useRegister() {
  return useMutation({ mutationFn: authApi.register })
}

export function useResendRegisterOtp() {
  return useMutation({ mutationFn: authApi.resendRegisterOtp })
}

/** Bước 2 đăng ký: nhập đúng OTP thì tài khoản được tạo và đăng nhập luôn. */
export function useVerifyRegisterOtp() {
  return useMutation({
    mutationFn: authApi.verifyRegisterOtp,
    onSuccess: (session) => authStore.setSession(session),
  })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (user) => authStore.updateUser(user),
  })
}
