import { useState, type ChangeEvent, type FormEvent } from 'react'
import { isMock } from '@/api'
import { FormError } from '@/components/FormField'
import { toast } from '@/components/ui/toast'
import { MOCK_OTP } from '@/mocks/auth'
import type { OtpSent, Session } from '@/types/auth'
import { useForgotPassword, useResendResetOtp, useResetPassword } from '../hooks'
import { MIN_PASSWORD, forgotPasswordSchema, resetPasswordSchema, validate, type FieldErrors } from '../schemas'
import { AuthField, AuthSubmit } from './AuthField'
import { maskEmail, useCountdown } from './OtpStep'

interface ForgotPasswordFormProps {
  /** Email điền sẵn (lấy từ ô Email ở trang đăng nhập nếu đã nhập) */
  defaultEmail?: string
  onSuccess: (session: Session) => void
  onStepChange?: (step: 'email' | 'reset') => void
}

/** Quên mật khẩu: bước 1 nhập email nhận OTP; bước 2 nhập OTP và mật khẩu mới, đúng mã thì đăng nhập luôn. */
export function ForgotPasswordForm({ defaultEmail = '', onSuccess, onStepChange }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(defaultEmail)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState<OtpSent | null>(null)
  const forgot = useForgotPassword()

  function goTo(next: OtpSent | null) {
    setSent(next)
    onStepChange?.(next ? 'reset' : 'email')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const { data, errors } = validate(forgotPasswordSchema, { email })
    setError(errors.email)
    if (data) forgot.mutate(data.email, { onSuccess: goTo })
  }

  if (sent) {
    return <ResetStep sent={sent} onResent={setSent} onBack={() => goTo(null)} onSuccess={onSuccess} />
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">Nhập email bạn đã dùng để đăng ký. WebPlan sẽ gửi mã OTP về email đó để bạn đặt mật khẩu mới.</p>
      <AuthField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="Nhập email của bạn..."
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          setError(undefined)
          forgot.reset()
        }}
        error={error}
        autoFocus
      />
      <FormError message={forgot.error?.message} />
      <AuthSubmit disabled={forgot.isPending}>{forgot.isPending ? 'Đang gửi mã…' : 'Gửi mã OTP'}</AuthSubmit>
    </form>
  )
}

type Values = { otp: string; password: string; confirmPassword: string }

interface ResetStepProps {
  sent: OtpSent
  onResent: (sent: OtpSent) => void
  onBack: () => void
  onSuccess: (session: Session) => void
}

function ResetStep({ sent, onResent, onBack, onSuccess }: ResetStepProps) {
  const [values, setValues] = useState<Values>({ otp: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors<Values>>({})
  const reset = useResetPassword()
  const resend = useResendResetOtp()
  const resendLeft = useCountdown(sent.resendAfter, sent)

  const change = (key: keyof Values) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = key === 'otp' ? e.target.value.replace(/\D/g, '') : e.target.value
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((er) => ({ ...er, [key]: undefined }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const { data, errors } = validate(resetPasswordSchema, values)
    setErrors(errors)
    if (data) reset.mutate({ email: sent.email, otp: data.otp, password: data.password }, { onSuccess })
  }

  function handleResend() {
    reset.reset()
    resend.mutate(sent.email, {
      onSuccess: (next) => {
        setValues((v) => ({ ...v, otp: '' }))
        onResent(next)
        toast('Đã gửi lại mã OTP')
      },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 [@media(max-height:820px)]:gap-3">
      <p className="text-sm text-ink-2">
        Mã OTP đã gửi tới <b className="text-ink">{maskEmail(sent.email)}</b>, hiệu lực {Math.round(sent.expiresIn / 60)} phút. Không thấy thư thì
        kiểm tra cả mục Spam.
      </p>
      <AuthField
        label="Mã OTP"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="••••••"
        className="text-center text-xl tracking-[0.5em]"
        value={values.otp}
        onChange={change('otp')}
        error={errors.otp}
        hint={isMock('auth') ? `Dữ liệu giả: mã OTP là ${MOCK_OTP}.` : undefined}
        autoFocus
      />
      <AuthField
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        placeholder={`Tối thiểu ${MIN_PASSWORD} ký tự`}
        value={values.password}
        onChange={change('password')}
        error={errors.password}
      />
      <AuthField
        label="Nhập lại mật khẩu mới"
        type="password"
        autoComplete="new-password"
        placeholder="Nhập lại mật khẩu mới..."
        value={values.confirmPassword}
        onChange={change('confirmPassword')}
        error={errors.confirmPassword}
      />
      <FormError message={reset.error?.message ?? resend.error?.message} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <button type="button" onClick={onBack} className="text-muted-foreground underline underline-offset-[3px] hover:text-ink">
          Đổi email
        </button>
        {resendLeft > 0 ? (
          <span className="text-muted-foreground">Gửi lại mã sau {resendLeft}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resend.isPending}
            className="font-medium text-gold-700 underline underline-offset-[3px] disabled:opacity-50"
          >
            {resend.isPending ? 'Đang gửi…' : 'Gửi lại mã'}
          </button>
        )}
      </div>

      <AuthSubmit disabled={reset.isPending}>{reset.isPending ? 'Đang lưu…' : 'Đặt lại mật khẩu'}</AuthSubmit>
    </form>
  )
}
