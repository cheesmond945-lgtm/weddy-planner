import { z } from 'zod'

// Quy tắc và câu báo lỗi lấy theo prototype (doLogin, doRegister, saveProfile)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^0\d{9}$/
export const MIN_PASSWORD = 6

export const loginSchema = z.object({
  identifier: z.string().trim().regex(EMAIL_RE, 'Email chưa hợp lệ.'),
  password: z.string().min(MIN_PASSWORD, `Mật khẩu cần tối thiểu ${MIN_PASSWORD} ký tự.`),
})

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Vui lòng nhập họ và tên.'),
    email: z.string().trim().regex(EMAIL_RE, 'Email chưa hợp lệ.'),
    password: z.string().min(MIN_PASSWORD, `Mật khẩu cần tối thiểu ${MIN_PASSWORD} ký tự.`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại chưa khớp.',
  })

export const otpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, 'Mã OTP gồm 6 chữ số.'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().regex(EMAIL_RE, 'Email chưa hợp lệ.'),
})

export const resetPasswordSchema = z
  .object({
    otp: z.string().trim().regex(/^\d{6}$/, 'Mã OTP gồm 6 chữ số.'),
    password: z.string().min(MIN_PASSWORD, `Mật khẩu cần tối thiểu ${MIN_PASSWORD} ký tự.`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại chưa khớp.',
  })

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Họ và tên không được để trống.'),
  username: z.string().trim().min(1, 'Nhập tên đăng nhập.').max(50, 'Tên đăng nhập tối đa 50 ký tự.'),
  phone: z.union([z.literal(''), z.string().trim().regex(PHONE_RE, 'Số điện thoại cần 10 số, bắt đầu bằng 0.')]),
})

export type FieldErrors<T> = Partial<Record<keyof T, string>>

/** Kiểm tra bằng schema, trả dữ liệu hợp lệ hoặc lỗi đầu tiên của từng trường. */
export function validate<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { data: z.output<S> | null; errors: FieldErrors<z.input<S>> } {
  const result = schema.safeParse(values)
  if (result.success) return { data: result.data, errors: {} }
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '')
    errors[key] ??= issue.message
  }
  return { data: null, errors: errors as FieldErrors<z.input<S>> }
}
