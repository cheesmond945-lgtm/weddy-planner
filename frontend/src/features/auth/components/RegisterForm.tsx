import { useState, type ChangeEvent, type FormEvent } from 'react'
import { FormError } from '@/components/FormField'
import type { OtpSent, Session } from '@/types/auth'
import { useRegister } from '../hooks'
import { MIN_PASSWORD, registerSchema, validate, type FieldErrors } from '../schemas'
import { AuthField, AuthSubmit } from './AuthField'
import { OtpStep } from './OtpStep'

interface RegisterFormProps {
  onSuccess: (session: Session) => void
  /** Báo cho modal / trang biết đang ở bước nào để đổi tiêu đề, ẩn tab. */
  onStepChange?: (step: 'info' | 'otp') => void
}

type Values = { name: string; email: string; password: string; confirmPassword: string }
const EMPTY: Values = { name: '', email: '', password: '', confirmPassword: '' }
const ALL_TOUCHED: Touched = { name: true, email: true, password: true, confirmPassword: true }
type Touched = Partial<Record<keyof Values, boolean>>

/** Lỗi của từng ô. Tự so khớp mật khẩu vì refine của schema chỉ chạy khi các ô khác đã hợp lệ. */
function fieldErrors(values: Values): FieldErrors<Values> {
  const { errors } = validate(registerSchema, values)
  if (values.confirmPassword && values.password !== values.confirmPassword) {
    errors.confirmPassword ??= 'Mật khẩu nhập lại chưa khớp.'
  }
  return errors
}

/** Đăng ký (1.1): bước 1 nhập họ tên, email, mật khẩu; bước 2 nhập OTP gửi về email. Không còn ô số điện thoại. */
export function RegisterForm({ onSuccess, onStepChange }: RegisterFormProps) {
  const [values, setValues] = useState<Values>(EMPTY)
  // Ô nào đã nhập rồi rời đi (hoặc đã bấm Đăng ký) mới hiện lỗi; từ đó lỗi cập nhật ngay khi gõ
  const [touched, setTouched] = useState<Touched>({})
  const [sent, setSent] = useState<OtpSent | null>(null)
  const register = useRegister()

  const allErrors = fieldErrors(values)
  const errors: FieldErrors<Values> = {}
  for (const key of Object.keys(allErrors) as (keyof Values)[]) {
    if (touched[key]) errors[key] = allErrors[key]
  }

  const change = (key: keyof Values) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
  }
  const blur = (key: keyof Values) => () => {
    if (values[key]) setTouched((t) => ({ ...t, [key]: true }))
  }

  function goTo(next: OtpSent | null) {
    setSent(next)
    onStepChange?.(next ? 'otp' : 'info')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(ALL_TOUCHED)
    const { data } = validate(registerSchema, values)
    if (!data) return
    const { confirmPassword: _c, ...body } = data
    register.mutate(body, { onSuccess: goTo })
  }

  if (sent) {
    return <OtpStep sent={sent} onResent={setSent} onBack={() => goTo(null)} onSuccess={onSuccess} />
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 [@media(max-height:820px)]:gap-3">
      <AuthField
        label="Họ và tên"
        autoComplete="name"
        placeholder="Nhập họ và tên..."
        value={values.name}
        onChange={change('name')}
        onBlur={blur('name')}
        error={errors.name}
        autoFocus
      />
      <AuthField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="Nhập email của bạn..."
        value={values.email}
        onChange={change('email')}
        onBlur={blur('email')}
        error={errors.email}
        hint="Mã OTP sẽ gửi về email này"
      />
      <AuthField
        label="Mật khẩu"
        type="password"
        autoComplete="new-password"
        placeholder={`Tối thiểu ${MIN_PASSWORD} ký tự`}
        value={values.password}
        onChange={change('password')}
        onBlur={blur('password')}
        error={errors.password}
      />
      <AuthField
        label="Nhập lại mật khẩu"
        type="password"
        autoComplete="new-password"
        placeholder="Nhập lại mật khẩu..."
        value={values.confirmPassword}
        onChange={change('confirmPassword')}
        onBlur={blur('confirmPassword')}
        error={errors.confirmPassword}
      />
      <FormError message={register.error?.message} />
      <AuthSubmit disabled={register.isPending}>{register.isPending ? 'Đang gửi mã…' : 'Đăng ký'}</AuthSubmit>
    </form>
  )
}
