import { ApiError } from '@/api/client'
import type {
  LoginRequest,
  OtpSent,
  RegisterRequest,
  Session,
  SessionUser,
  UpdateProfileRequest,
  VerifyRegisterOtpRequest,
} from '@/types/auth'

/*
 * Dữ liệu giả cho module auth. Lưu vào localStorage để tải lại trang vẫn còn tài khoản đã đăng ký.
 * Mọi tài khoản mẫu dùng mật khẩu 123456. OTP giả luôn là 123456.
 */
export const MOCK_PASSWORD = '123456'
export const MOCK_OTP = '123456'

const OTP_TTL = 300
const RESEND_AFTER = 60
const STORAGE_KEY = 'weddy.mock.accounts'

interface MockAccount extends SessionUser {
  password: string
}

const SEED: MockAccount[] = [
  { id: 'u-couple-1', name: 'Nguyễn Minh Anh', email: 'minh.anh@example.com', phone: '0901234567', role: 'COUPLE', password: MOCK_PASSWORD },
  { id: 'u-vendor-1', name: 'Nhà cung cấp mẫu', email: 'vendor@example.com', phone: '0907654321', role: 'VENDOR', password: MOCK_PASSWORD },
  { id: 'u-admin-1', name: 'Quản trị viên', email: 'admin@example.com', phone: '0900000000', role: 'ADMIN', password: MOCK_PASSWORD },
]

function loadAccounts(): MockAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MockAccount[]
  } catch {
    // bỏ qua
  }
  return [...SEED]
}

let accounts = loadAccounts()

function saveAccounts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
  } catch {
    // bỏ qua
  }
}

/** Đăng ký đang chờ nhập OTP, theo email (chữ thường). */
const pending = new Map<string, { data: RegisterRequest; expiresAt: number; resendAt: number; attempts: number }>()

const toUser = ({ password: _password, ...user }: MockAccount): SessionUser => user
const toSession = (a: MockAccount): Session => ({ accessToken: `mock-token-${a.id}`, user: toUser(a) })
const sameEmail = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
const findByToken = (token: string | null) => accounts.find((a) => token === `mock-token-${a.id}`)

function otpSent(email: string, now: number): OtpSent {
  const p = pending.get(email)!
  return { email, expiresIn: Math.round((p.expiresAt - now) / 1000), resendAfter: Math.max(0, Math.round((p.resendAt - now) / 1000)) }
}

export const mockAuth = {
  login({ identifier, password }: LoginRequest): Session {
    const id = identifier.trim()
    const account = accounts.find((a) => a.phone === id || sameEmail(a.email, id))
    if (!account || account.password !== password) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email/số điện thoại hoặc mật khẩu không đúng.')
    }
    return toSession(account)
  },

  register(data: RegisterRequest): OtpSent {
    if (accounts.some((a) => a.phone === data.phone)) {
      throw new ApiError(409, 'PHONE_ALREADY_EXISTS', 'Số điện thoại đã được đăng ký.')
    }
    if (accounts.some((a) => sameEmail(a.email, data.email))) {
      throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email đã được đăng ký.')
    }
    const key = data.email.toLowerCase()
    const now = Date.now()
    pending.set(key, { data, expiresAt: now + OTP_TTL * 1000, resendAt: now + RESEND_AFTER * 1000, attempts: 0 })
    return otpSent(key, now)
  },

  resendOtp(email: string): OtpSent {
    const key = email.toLowerCase()
    const p = pending.get(key)
    if (!p) throw new ApiError(404, 'REGISTRATION_NOT_FOUND', 'Phiên đăng ký đã hết hạn, vui lòng đăng ký lại.')
    const now = Date.now()
    if (now < p.resendAt) throw new ApiError(429, 'OTP_RESEND_TOO_SOON', 'Vui lòng chờ trước khi gửi lại mã.')
    Object.assign(p, { expiresAt: now + OTP_TTL * 1000, resendAt: now + RESEND_AFTER * 1000, attempts: 0 })
    return otpSent(key, now)
  },

  verifyRegisterOtp({ email, otp }: VerifyRegisterOtpRequest): Session {
    const key = email.toLowerCase()
    const p = pending.get(key)
    if (!p) throw new ApiError(404, 'REGISTRATION_NOT_FOUND', 'Phiên đăng ký đã hết hạn, vui lòng đăng ký lại.')
    if (Date.now() > p.expiresAt) throw new ApiError(400, 'OTP_EXPIRED', 'Mã OTP đã hết hạn, vui lòng gửi lại mã.')
    if (p.attempts >= 5) throw new ApiError(429, 'OTP_TOO_MANY_ATTEMPTS', 'Nhập sai quá nhiều lần, vui lòng gửi lại mã.')
    if (otp !== MOCK_OTP) {
      p.attempts += 1
      throw new ApiError(400, 'OTP_INVALID', 'Mã OTP không đúng.')
    }
    pending.delete(key)
    const account: MockAccount = { id: `u-${Date.now()}`, ...p.data, role: 'COUPLE' }
    accounts.push(account)
    saveAccounts()
    return toSession(account)
  },

  me(token: string | null): SessionUser {
    const account = findByToken(token)
    if (!account) throw new ApiError(401, 'TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.')
    return toUser(account)
  },

  updateProfile(token: string | null, data: UpdateProfileRequest): SessionUser {
    const account = findByToken(token)
    if (!account) throw new ApiError(401, 'TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.')
    if (data.phone && accounts.some((a) => a !== account && a.phone === data.phone)) {
      throw new ApiError(409, 'PHONE_ALREADY_EXISTS', 'Số điện thoại đã được dùng cho tài khoản khác.')
    }
    if (data.email && accounts.some((a) => a !== account && sameEmail(a.email, data.email))) {
      throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email đã được dùng cho tài khoản khác.')
    }
    Object.assign(account, data)
    saveAccounts()
    return toUser(account)
  },
}
