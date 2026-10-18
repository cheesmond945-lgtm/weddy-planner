/*
 * CHỜ ĐỐI CHIẾU docs/database.md: giá trị role và tên trường người dùng đang suy từ prototype.
 * Khi database.md được chốt, sửa ở đây trước rồi sửa mocks/ và docs/api/auth.md theo.
 */
export const ROLES = ['COUPLE', 'VENDOR', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]

export interface SessionUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: Role
}

export interface Session {
  accessToken: string
  user: SessionUser
}

// ---- Request / response theo docs/api/auth.md ----

export interface LoginRequest {
  /** Email hoặc số điện thoại */
  identifier: string
  password: string
}

export interface RegisterRequest {
  name: string
  phone: string
  email: string
  password: string
}

/** Kết quả gửi OTP về email (đăng ký hoặc gửi lại). */
export interface OtpSent {
  email: string
  /** Số giây OTP còn hiệu lực */
  expiresIn: number
  /** Số giây phải chờ trước khi được gửi lại */
  resendAfter: number
}

export interface VerifyRegisterOtpRequest {
  email: string
  otp: string
}

export interface UpdateProfileRequest {
  name: string
  email: string | null
  phone: string | null
}
