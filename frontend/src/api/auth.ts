import { mockAuth } from '@/mocks/auth'
import { authStore } from '@/store/auth'
import type {
  LoginRequest,
  OtpSent,
  RegisterRequest,
  Session,
  SessionUser,
  UpdateProfileRequest,
  VerifyRegisterOtpRequest,
} from '@/types/auth'
import { http } from './client'
import { USE_MOCK, mockDelay } from './mock'

/** Hợp đồng: docs/api/auth.md */
export const authApi = {
  login: (body: LoginRequest): Promise<Session> =>
    USE_MOCK ? mockDelay(null).then(() => mockAuth.login(body)) : http.post('/auth/login', body),

  register: (body: RegisterRequest): Promise<OtpSent> =>
    USE_MOCK ? mockDelay(null).then(() => mockAuth.register(body)) : http.post('/auth/register', body),

  resendRegisterOtp: (email: string): Promise<OtpSent> =>
    USE_MOCK ? mockDelay(null).then(() => mockAuth.resendOtp(email)) : http.post('/auth/register/resend-otp', { email }),

  verifyRegisterOtp: (body: VerifyRegisterOtpRequest): Promise<Session> =>
    USE_MOCK ? mockDelay(null).then(() => mockAuth.verifyRegisterOtp(body)) : http.post('/auth/register/verify-otp', body),

  me: (): Promise<SessionUser> =>
    USE_MOCK ? mockDelay(null).then(() => mockAuth.me(authStore.getToken())) : http.get('/auth/me'),

  updateProfile: (body: UpdateProfileRequest): Promise<SessionUser> =>
    USE_MOCK ? mockDelay(null).then(() => mockAuth.updateProfile(authStore.getToken(), body)) : http.patch('/auth/me', body),
}
