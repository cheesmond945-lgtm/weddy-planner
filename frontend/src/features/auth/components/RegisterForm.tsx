import { useState, type ChangeEvent, type FormEvent } from 'react'
import { FormError, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import type { OtpSent, Session } from '@/types/auth'
import { useRegister } from '../hooks'
import { MIN_PASSWORD, registerSchema, validate, type FieldErrors } from '../schemas'
import { OtpStep } from './OtpStep'

interface RegisterFormProps {
  onSuccess: (session: Session) => void
  onCancel?: () => void
  /** Báo cho modal biết đang ở bước nào để đổi tiêu đề. */
  onStepChange?: (step: 'info' | 'otp') => void
}

type Values = { name: string; phone: string; email: string; password: string; confirmPassword: string }
const EMPTY: Values = { name: '', phone: '', email: '', password: '', confirmPassword: '' }

/** Đăng ký (1.1): bước 1 nhập thông tin, bước 2 nhập OTP gửi về email. */
export function RegisterForm({ onSuccess, onCancel, onStepChange }: RegisterFormProps) {
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors<Values>>({})
  const [sent, setSent] = useState<OtpSent | null>(null)
  const register = useRegister()

  const change = (key: keyof Values) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: undefined }))
  }

  function goTo(next: OtpSent | null) {
    setSent(next)
    onStepChange?.(next ? 'otp' : 'info')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const { data, errors } = validate(registerSchema, values)
    setErrors(errors)
    if (!data) return
    const { confirmPassword: _c, ...body } = data
    register.mutate(body, { onSuccess: goTo })
  }

  if (sent) {
    return <OtpStep sent={sent} onResent={setSent} onBack={() => goTo(null)} onSuccess={onSuccess} />
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField label="Họ và tên" autoComplete="name" value={values.name} onChange={change('name')} error={errors.name} autoFocus />
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FormField
          label="Số điện thoại"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={values.phone}
          onChange={change('phone')}
          error={errors.phone}
        />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={change('email')}
          error={errors.email}
          hint="Mã OTP sẽ gửi về email này"
        />
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FormField
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={change('password')}
          error={errors.password}
          hint={`Tối thiểu ${MIN_PASSWORD} ký tự`}
        />
        <FormField
          label="Nhập lại mật khẩu"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={change('confirmPassword')}
          error={errors.confirmPassword}
        />
      </div>
      <FormError message={register.error?.message} />

      <div className="mt-1 flex flex-wrap justify-end gap-2.5">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
        )}
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Đang gửi mã…' : 'Gửi mã OTP'}
        </Button>
      </div>
    </form>
  )
}
