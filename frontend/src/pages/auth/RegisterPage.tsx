import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { AuthTabs } from '@/features/auth/components/AuthTabs'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { useAfterAuth } from '@/features/auth/useAfterAuth'
import { paths } from '@/routes/paths'

/** Trang đăng ký riêng (cùng form với modal). Bước OTP ẩn tab. */
export default function RegisterPage() {
  const [step, setStep] = useState<'info' | 'otp'>('info')
  const location = useLocation()
  const state = location.state as { from?: string } | null
  const afterAuth = useAfterAuth()

  return (
    <>
      <h1 className={step === 'otp' ? 'mb-4 text-center text-xl' : 'sr-only'}>{step === 'otp' ? 'Xác thực email' : 'Đăng ký'}</h1>
      {step === 'info' && <AuthTabs mode="register" hrefs={{ login: paths.login, register: paths.register }} linkState={state} />}
      <RegisterForm onStepChange={setStep} onSuccess={(session) => void afterAuth(session, 'Đã tạo tài khoản', state?.from)} />
      {step === 'info' && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link to={paths.login} state={state} replace className="font-semibold text-gold hover:underline">
            Đăng nhập
          </Link>
        </p>
      )}
    </>
  )
}
