import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { closeAuthDialog, setAuthDialogMode, useAuthDialog } from '../authDialog'
import { useAfterAuth } from '../useAfterAuth'
import { AuthBrandHeader } from './AuthBrandHeader'
import { AuthTabs } from './AuthTabs'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

/** Modal đăng nhập / đăng ký phía cặp đôi (như authModal trong prototype), cùng giao diện với trang đăng nhập. */
export function AuthDialog() {
  const { open, mode, redirectTo, onAuthenticated } = useAuthDialog()
  const [step, setStep] = useState<'info' | 'otp'>('info')
  const afterAuth = useAfterAuth()

  const title = mode === 'login' ? 'Đăng nhập' : step === 'otp' ? 'Xác thực email' : 'Đăng ký'

  function handleOpenChange(next: boolean) {
    if (!next) {
      closeAuthDialog()
      setStep('info')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[470px] rounded-[20px] px-6 py-8 sm:px-10">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {mode === 'login' ? 'Đăng nhập bằng email' : 'Đăng ký tài khoản cặp đôi'}
        </DialogDescription>
        <AuthBrandHeader />

        {step === 'otp' && <p className="mb-4 text-center font-serif text-xl font-semibold">Xác thực email</p>}
        {step === 'info' && (
          <AuthTabs
            mode={mode}
            onChange={(m) => {
              setAuthDialogMode(m)
              setStep('info')
            }}
          />
        )}

        {mode === 'login' ? (
          <LoginForm
            onSuccess={(session) => {
              handleOpenChange(false)
              void afterAuth(session, 'Đăng nhập thành công', redirectTo, onAuthenticated)
            }}
          />
        ) : (
          <RegisterForm
            onStepChange={setStep}
            onSuccess={(session) => {
              handleOpenChange(false)
              void afterAuth(session, 'Đã tạo tài khoản', redirectTo, onAuthenticated)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
