import { useMutation } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ApiError } from '@/api'
import { authApi } from '@/api/auth'
import { FormError, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import type { OtpSent } from '@/types/auth'
import { useVerifyEmailChange } from '../hooks'
import { maskEmail, useCountdown } from './OtpStep'
import { PasswordInput } from './PasswordInput'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Errors = { currentPassword?: string; newEmail?: string }

/**
 * Đổi email đăng nhập (mọi vai trò): bước 1 nhập mật khẩu hiện tại + email mới, bước 2 nhập OTP gửi tới email mới.
 * Đổi xong hệ thống gửi thông báo về email cũ.
 */
export function ChangeEmailDialog({ currentEmail, open, onOpenChange }: { currentEmail: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đổi email đăng nhập</DialogTitle>
          <DialogDescription>
            Email hiện tại: <b className="text-ink">{currentEmail || '—'}</b>
          </DialogDescription>
        </DialogHeader>
        {open && <ChangeEmailFlow onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ChangeEmailFlow({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  const [sent, setSent] = useState<OtpSent | null>(null)

  const request = useMutation({ mutationFn: authApi.requestEmailChange })

  function submit(e: FormEvent) {
    e.preventDefault()
    const found: Errors = {}
    if (!password) found.currentPassword = 'Nhập mật khẩu hiện tại.'
    if (!EMAIL_RE.test(email.trim())) found.newEmail = 'Email chưa hợp lệ.'
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) return
    request.mutate(
      { currentPassword: password, newEmail: email.trim() },
      {
        onSuccess: setSent,
        onError: (err) => {
          const details = err instanceof ApiError && err.details && typeof err.details === 'object' ? (err.details as Errors) : {}
          if (Object.keys(details).length) setErrors(details)
          else setFormError(err.message)
        },
      },
    )
  }

  if (sent) return <VerifyStep sent={sent} onResent={setSent} onBack={() => setSent(null)} onDone={onDone} />

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <PasswordInput
        label="Mật khẩu hiện tại"
        autoComplete="current-password"
        value={password}
        disabled={request.isPending}
        onChange={(e) => (setPassword(e.target.value), setErrors((x) => ({ ...x, currentPassword: undefined })))}
        error={errors.currentPassword}
        autoFocus
      />
      <FormField
        label="Email mới"
        type="email"
        // Không để trình duyệt điền sẵn email cũ đã lưu
        autoComplete="off"
        name="new-login-email"
        value={email}
        disabled={request.isPending}
        onChange={(e) => (setEmail(e.target.value), setErrors((x) => ({ ...x, newEmail: undefined })))}
        error={errors.newEmail}
        hint="Chúng tôi sẽ gửi mã xác minh tới email này."
      />
      <FormError message={formError} />
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onDone} disabled={request.isPending}>
          Hủy
        </Button>
        <Button type="submit" disabled={request.isPending}>
          {request.isPending && <LoaderCircle className="animate-spin" />}
          Gửi mã xác minh
        </Button>
      </DialogFooter>
    </form>
  )
}

function VerifyStep({ sent, onResent, onBack, onDone }: { sent: OtpSent; onResent: (s: OtpSent) => void; onBack: () => void; onDone: () => void }) {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string>()
  const verify = useVerifyEmailChange()
  const resend = useMutation({ mutationFn: authApi.resendEmailChangeOtp })
  const resendLeft = useCountdown(sent.resendAfter, sent)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(otp)) return setError('Mã OTP gồm 6 chữ số.')
    verify.mutate(otp, {
      onSuccess: (u) => {
        onDone()
        toast(`Đã đổi email đăng nhập sang ${u.email}. Lần sau hãy đăng nhập bằng email mới.`)
      },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm">
        Mã OTP gồm 6 chữ số đã được gửi tới <b>{maskEmail(sent.email)}</b>, có hiệu lực trong {Math.round(sent.expiresIn / 60)} phút. Không thấy thư thì kiểm tra cả mục Spam.
      </p>
      <FormField
        label="Mã OTP"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="••••••"
        className="text-center text-xl tracking-[0.5em]"
        value={otp}
        onChange={(e) => (setOtp(e.target.value.replace(/\D/g, '')), setError(undefined))}
        error={error}
        autoFocus
      />
      <FormError message={verify.error?.message ?? resend.error?.message} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <button type="button" onClick={onBack} className="text-muted-foreground underline underline-offset-[3px] hover:text-ink">
          Nhập email khác
        </button>
        {resendLeft > 0 ? (
          <span className="text-muted-foreground">Gửi lại mã sau {resendLeft}s</span>
        ) : (
          <button
            type="button"
            disabled={resend.isPending}
            onClick={() => {
              verify.reset()
              resend.mutate(undefined, { onSuccess: (next) => (setOtp(''), onResent(next), toast('Đã gửi lại mã OTP')) })
            }}
            className="font-medium text-primary underline underline-offset-[3px] disabled:opacity-50"
          >
            {resend.isPending ? 'Đang gửi…' : 'Gửi lại mã'}
          </button>
        )}
      </div>
      <DialogFooter className="mt-1">
        <Button type="submit" disabled={verify.isPending}>
          {verify.isPending && <LoaderCircle className="animate-spin" />}
          Xác nhận đổi email
        </Button>
      </DialogFooter>
    </form>
  )
}
