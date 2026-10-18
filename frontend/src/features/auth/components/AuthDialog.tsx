import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { closeAuthDialog, setAuthDialogMode, useAuthDialog } from '../authDialog'
import { useAfterAuth } from '../useAfterAuth'
import { AuthTabs } from './AuthTabs'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

/** Modal đăng nhập / đăng ký phía cặp đôi (như authModal trong prototype). Đặt một lần trong CoupleLayout. */
export function AuthDialog() {
  const { open, mode, redirectTo, onAuthenticated } = useAuthDialog()
  const [step, setStep] = useState<'info' | 'otp'>('info')
  const afterAuth = useAfterAuth()

  const title = mode === 'login' ? 'Đăng nhập' : step === 'otp' ? 'Xác thực email' : 'Tạo tài khoản'

  function handleOpenChange(next: boolean) {
    if (!next) {
      closeAuthDialog()
      setStep('info')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {mode === 'login' ? 'Đăng nhập bằng email hoặc số điện thoại' : 'Đăng ký tài khoản cặp đôi'}
          </DialogDescription>
        </DialogHeader>

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
            onCancel={() => handleOpenChange(false)}
            onSuccess={(session) => {
              handleOpenChange(false)
              void afterAuth(session, 'Đăng nhập thành công', redirectTo, onAuthenticated)
            }}
          />
        ) : (
          <RegisterForm
            onCancel={() => handleOpenChange(false)}
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
