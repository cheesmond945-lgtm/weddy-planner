import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Circle, KeyRound, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/api'
import { authApi } from '@/api/auth'
import { FormField } from '@/components/FormField'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { PASSWORD_RULES, passwordValid } from '@/features/auth/passwordRules'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { controlClass, FormSection } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'

const card = 'rounded-md border border-line bg-surface px-7 pt-[26px] pb-6 shadow-portal max-sm:px-4 max-sm:pt-5 max-sm:pb-4'
type Errors = { currentPassword?: string; newPassword?: string; confirmPassword?: string; form?: string }

/**
 * Tài khoản của tôi (NCC): thông tin đăng nhập (chỉ xem, đổi email / SĐT thì liên hệ Admin) và đổi mật khẩu.
 * Đổi mật khẩu: nhập mật khẩu hiện tại, mật khẩu mới theo quy tắc (hiện đạt / chưa đạt khi gõ), nhập lại; có popup xác nhận.
 */
export default function VendorAccountPage() {
  const { user } = useAuth()
  const me = useQuery({ queryKey: ['auth', 'me', user?.id], queryFn: authApi.me, enabled: !!user, staleTime: 0 })
  const info = me.data ?? user
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [confirm, setConfirm] = useState(false)
  const owner = { username: info?.username, email: info?.email, phone: info?.phone }

  const change = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      setConfirm(false)
      setCurrent('')
      setNext('')
      setAgain('')
      setErrors({})
      toast('Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.')
    },
    onError: (e) => {
      setConfirm(false)
      const details = e instanceof ApiError && e.details && typeof e.details === 'object' ? (e.details as Errors) : {}
      setErrors({ ...details, form: Object.keys(details).length ? undefined : e.message })
    },
  })

  function openConfirm() {
    const found: Errors = {}
    if (!current) found.currentPassword = 'Nhập mật khẩu hiện tại.'
    if (!next) found.newPassword = 'Nhập mật khẩu mới.'
    else if (!passwordValid(next, owner)) found.newPassword = 'Mật khẩu mới chưa đạt các yêu cầu bên dưới.'
    else if (next === current) found.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
    if (again !== next) found.confirmPassword = 'Mật khẩu nhập lại không khớp.'
    setErrors(found)
    if (!Object.keys(found).length) setConfirm(true)
  }

  const readOnly = cn(controlClass, 'bg-surface-2')
  const busy = change.isPending

  return (
    <div className="mx-auto max-w-[980px]">
      <PageTitle title="Tài khoản của tôi" />

      <div className={card}>
        <FormSection title="Thông tin tài khoản" description="Cần đổi email hoặc số điện thoại đăng nhập, vui lòng liên hệ quản trị viên WebPlan.">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-sm:grid-cols-1">
            <FormField label="Người liên hệ" className={readOnly} disabled value={info?.name || '—'} />
            <FormField label="Tên đăng nhập" className={readOnly} disabled value={info?.username || '—'} />
            <FormField label="Email đăng nhập" className={readOnly} disabled value={info?.email || '—'} />
            <FormField label="Số điện thoại" className={readOnly} disabled value={info?.phone || '—'} />
          </div>
        </FormSection>
      </div>

      <form
        noValidate
        className={cn(card, 'mt-5')}
        onSubmit={(e) => {
          e.preventDefault()
          openConfirm()
        }}
      >
        <FormSection title="Đổi mật khẩu" description="Nên đổi mật khẩu được gửi qua email ngay lần đăng nhập đầu tiên. Không dùng lại mật khẩu của tài khoản khác.">
          <div className="grid max-w-[480px] gap-4">
            <PasswordInput label="Mật khẩu hiện tại *" autoComplete="current-password" value={current} disabled={busy} onChange={(e) => setCurrent(e.target.value)} error={errors.currentPassword} />
            <PasswordInput label="Mật khẩu mới *" autoComplete="new-password" maxLength={64} value={next} disabled={busy} onChange={(e) => setNext(e.target.value)} error={errors.newPassword} />
            <ul aria-label="Yêu cầu mật khẩu" className="grid gap-1 text-[13px]">
              {PASSWORD_RULES.map((r) => {
                const ok = r.ok(next, owner)
                return (
                  <li key={r.id} className={cn('flex items-center gap-2', ok ? 'text-sage' : 'text-muted-foreground')}>
                    {ok ? <Check className="size-3.5" strokeWidth={3} /> : <Circle className="size-3" />}
                    {r.label}
                  </li>
                )
              })}
            </ul>
            <PasswordInput label="Nhập lại mật khẩu mới *" autoComplete="new-password" maxLength={64} value={again} disabled={busy} onChange={(e) => setAgain(e.target.value)} error={errors.confirmPassword} />
          </div>
        </FormSection>
        {errors.form && (
          <p role="alert" className="mb-3 text-[13px] text-destructive">
            {errors.form}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" className="h-10" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
            Đổi mật khẩu
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirm}
        onOpenChange={(o) => !o && !busy && setConfirm(false)}
        title="Đổi mật khẩu?"
        confirmLabel="Đổi mật khẩu"
        onConfirm={() => change.mutate({ currentPassword: current, newPassword: next, confirmPassword: again })}
      >
        <p>Lần đăng nhập sau bạn cần dùng mật khẩu mới. Hệ thống sẽ gửi email thông báo tới {info?.email ?? 'email của bạn'}.</p>
      </ConfirmDialog>
    </div>
  )
}
