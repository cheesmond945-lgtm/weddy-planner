/*
 * CHỜ ĐỐI CHIẾU docs/database.md: giá trị role và tên trường người dùng đang suy từ prototype.
 * Khi database.md được chốt, sửa ở đây trước rồi sửa docs/api/auth.md theo.
 */
export const ROLES = ['COUPLE', 'VENDOR', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]

export interface SessionUser {
  id: string
  /** Tên đăng nhập (tài khoản NCC do Admin tạo) */
  username?: string | null
  name: string
  email: string | null
  phone: string | null
  role: Role
}

/** Body của POST /auth/me/password. */
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface Session {
  accessToken: string
  user: SessionUser
}

// ---- Request / response theo docs/api/auth.md ----

export interface LoginRequest {
  /** Email */
  identifier: string
  password: string
}

/** Đăng ký không còn ô số điện thoại; cặp đôi bổ sung số ở Thông tin cá nhân nếu muốn. */
export interface RegisterRequest {
  name: string
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

/** Bước 2 quên mật khẩu: OTP gửi về email kèm mật khẩu mới. */
export interface ResetPasswordRequest {
  email: string
  otp: string
  password: string
}

/** Trường không gửi thì giữ nguyên. Email không đổi ở đây mà qua đổi email (mật khẩu + OTP) */
export interface UpdateProfileRequest {
  name?: string
  username?: string
  phone?: string | null
}

/** Đổi email đăng nhập, bước 1: BE gửi OTP tới email mới (phản hồi OtpSent) */
export interface ChangeEmailRequest {
  currentPassword: string
  newEmail: string
}
