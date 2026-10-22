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
import { isMock, mockDelay } from './mock'

/** Hợp đồng: docs/api/auth.md */
export const authApi = {
  login: (body: LoginRequest): Promise<Session> =>
    isMock('auth') ? mockDelay(null).then(() => mockAuth.login(body)) : http.post('/auth/login', body),

  register: (body: RegisterRequest): Promise<OtpSent> =>
    isMock('auth') ? mockDelay(null).then(() => mockAuth.register(body)) : http.post('/auth/register', body),

  resendRegisterOtp: (email: string): Promise<OtpSent> =>
    isMock('auth') ? mockDelay(null).then(() => mockAuth.resendOtp(email)) : http.post('/auth/register/resend-otp', { email }),

  verifyRegisterOtp: (body: VerifyRegisterOtpRequest): Promise<Session> =>
    isMock('auth') ? mockDelay(null).then(() => mockAuth.verifyRegisterOtp(body)) : http.post('/auth/register/verify-otp', body),

  me: (): Promise<SessionUser> =>
    isMock('auth') ? mockDelay(null).then(() => mockAuth.me(authStore.getToken())) : http.get('/auth/me'),

  updateProfile: (body: UpdateProfileRequest): Promise<SessionUser> =>
    isMock('auth') ? mockDelay(null).then(() => mockAuth.updateProfile(authStore.getToken(), body)) : http.patch('/auth/me', body),
}
