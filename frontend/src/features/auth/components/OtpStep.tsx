import { useEffect, useState, type FormEvent } from 'react'
import { isMock } from '@/api'
import { FormError, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { MOCK_OTP } from '@/mocks/auth'
import type { OtpSent, Session } from '@/types/auth'
import { useResendRegisterOtp, useVerifyRegisterOtp } from '../hooks'
import { otpSchema, validate } from '../schemas'

interface OtpStepProps {
  sent: OtpSent
  onResent: (sent: OtpSent) => void
  onBack: () => void
  onSuccess: (session: Session) => void
}

/** ngoc.tran@example.com -> ng***@example.com */
export const maskEmail = (e: string) => e.replace(/^(.{1,2})[^@]*(@.*)$/, '$1***$2')

/** Đếm ngược theo giây, về 0 thì dừng. */
export function useCountdown(seconds: number, key: unknown) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    const t = setInterval(() => setLeft((s) => (s <= 1 ? (clearInterval(t), 0) : s - 1)), 1000)
    return () => clearInterval(t)
  }, [seconds, key])
  return left
}

/** Bước 2 của đăng ký: nhập OTP gửi về số điện thoại (1.1). */
export function OtpStep({ sent, onResent, onBack, onSuccess }: OtpStepProps) {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const verify = useVerifyRegisterOtp()
  const resend = useResendRegisterOtp()
  const resendLeft = useCountdown(sent.resendAfter, sent)

  function submit(e: FormEvent) {
    e.preventDefault()
    const { data, errors } = validate(otpSchema, { otp })
    setError(errors.otp)
    if (data) verify.mutate({ email: sent.email, otp: data.otp }, { onSuccess })
  }

  function handleResend() {
    verify.reset()
    resend.mutate(sent.email, {
      onSuccess: (next) => {
        setOtp('')
        onResent(next)
        toast('Đã gửi lại mã OTP')
      },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm">
        Mã OTP gồm 6 chữ số đã được gửi tới email <b>{maskEmail(sent.email)}</b>. Mã có hiệu lực trong {Math.round(sent.expiresIn / 60)} phút.
        Không thấy thư thì kiểm tra cả mục Spam.
      </p>

      <FormField
        label="Mã OTP"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="••••••"
        className="text-center text-xl tracking-[0.5em]"
        value={otp}
        onChange={(e) => {
          setOtp(e.target.value.replace(/\D/g, ''))
          setError(undefined)
        }}
        error={error}
        hint={isMock('auth') ? `Dữ liệu giả: mã OTP là ${MOCK_OTP}.` : undefined}
        autoFocus
      />
      <FormError message={verify.error?.message ?? resend.error?.message} />

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

      <div className="mt-1 flex justify-end">
        <Button type="submit" disabled={verify.isPending}>
          {verify.isPending ? 'Đang xác thực…' : 'Xác nhận và tạo tài khoản'}
        </Button>
      </div>
    </form>
  )
}
