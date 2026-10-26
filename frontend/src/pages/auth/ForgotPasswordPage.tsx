import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'
import { useAfterAuth } from '@/features/auth/useAfterAuth'
import { paths } from '@/routes/paths'

/** Trang quên mật khẩu: gửi OTP về email rồi đặt mật khẩu mới. Không có tab nên có link quay về đăng nhập. */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const location = useLocation()
  const state = location.state as { email?: string; from?: string } | null
  const afterAuth = useAfterAuth()

  return (
    <>
      {/* Cùng kiểu chữ với tab đang chọn ở trang đăng nhập / đăng ký */}
      <h1 className="mb-6 border-b border-line pb-3 text-center font-serif text-[15px] font-semibold tracking-[0.2em] text-gold-700 uppercase [@media(max-height:820px)]:mb-4">
        {step === 'email' ? 'Quên mật khẩu' : 'Đặt mật khẩu mới'}
      </h1>
      <ForgotPasswordForm
        defaultEmail={state?.email}
        onStepChange={setStep}
        onSuccess={(session) => void afterAuth(session, 'Đã đổi mật khẩu', state?.from)}
      />
      <p className="mt-4 text-center text-sm text-ink-2">
        Nhớ ra mật khẩu?{' '}
        <Link to={paths.login} state={state?.from ? { from: state.from } : null} className="font-semibold text-gold-700 hover:underline hover:underline-offset-[3px]">
          Đăng nhập
        </Link>
      </p>
    </>
  )
}
