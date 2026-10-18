import { useState } from 'react'
import { Link } from 'react-router'
import { PageTitle } from '@/components/PageTitle'
import { RegisterForm } from '@/features/auth/components/RegisterForm'
import { useAfterAuth } from '@/features/auth/useAfterAuth'
import { paths } from '@/routes/paths'

/** Trang đăng ký riêng (cùng form với modal), cho link chia sẻ trực tiếp. */
export default function RegisterPage() {
  const [step, setStep] = useState<'info' | 'otp'>('info')
  const afterAuth = useAfterAuth()

  return (
    <>
      <PageTitle title={step === 'otp' ? 'Xác thực email' : 'Tạo tài khoản'} />
      <RegisterForm onStepChange={setStep} onSuccess={(session) => void afterAuth(session, 'Đã tạo tài khoản')} />
      {step === 'info' && (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link to={paths.login} className="text-primary underline underline-offset-[3px]">
            Đăng nhập
          </Link>
        </p>
      )}
    </>
  )
}
