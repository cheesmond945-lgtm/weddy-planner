import type {
  ChangeEmailRequest,
  ChangePasswordRequest,
  LoginRequest,
  OtpSent,
  RegisterRequest,
  Session,
  SessionUser,
  UpdateProfileRequest,
  VerifyRegisterOtpRequest,
} from '@/types/auth'
import { http } from './client'

/** Hợp đồng: docs/api/auth.md */
export const authApi = {
  login: (body: LoginRequest): Promise<Session> =>
    http.post('/auth/login', body),

  register: (body: RegisterRequest): Promise<OtpSent> =>
    http.post('/auth/register', body),

  resendRegisterOtp: (email: string): Promise<OtpSent> =>
    http.post('/auth/register/resend-otp', { email }),

  verifyRegisterOtp: (body: VerifyRegisterOtpRequest): Promise<Session> =>
    http.post('/auth/register/verify-otp', body),

  me: (): Promise<SessionUser> =>
    http.get('/auth/me'),

  updateProfile: (body: UpdateProfileRequest): Promise<SessionUser> =>
    http.patch('/auth/me', body),

  /** Đổi mật khẩu khi đang đăng nhập (quy tắc ở features/auth/passwordRules.ts) */
  changePassword: (body: ChangePasswordRequest): Promise<null> =>
    http.post('/auth/me/password', body),

  /** Đổi email đăng nhập: bước 1 gửi OTP tới email mới, bước 2 nhập OTP */
  requestEmailChange: (body: ChangeEmailRequest): Promise<OtpSent> =>
    http.post('/auth/me/email', body),

  resendEmailChangeOtp: (): Promise<OtpSent> =>
    http.post('/auth/me/email/resend-otp'),

  verifyEmailChange: (otp: string): Promise<SessionUser> =>
    http.post('/auth/me/email/verify-otp', { otp }),
}
