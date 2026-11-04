import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Circle, KeyRound, LoaderCircle, Mail, Save } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/api'
import { authApi } from '@/api/auth'
import { FormField } from '@/components/FormField'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { ChangeEmailDialog } from '@/features/auth/components/ChangeEmailDialog'
import { PasswordInput } from '@/features/auth/components/PasswordInput'
import { PASSWORD_RULES, passwordValid } from '@/features/auth/passwordRules'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { controlClass, FormSection } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'
import { useUpdateProfile } from '../hooks'
import { PHONE_RE } from '../schemas'

const card = 'rounded-md border border-line bg-surface px-7 pt-[26px] pb-6 shadow-portal max-sm:px-4 max-sm:pt-5 max-sm:pb-4'
type Errors = { currentPassword?: string; newPassword?: string; confirmPassword?: string; form?: string }

/**
 * Tài khoản của tôi (cặp đôi, NCC, Admin): sửa họ tên, tên đăng nhập; đổi email (hộp riêng, mật khẩu + OTP); đổi mật khẩu.
 * Đổi mật khẩu: nhập mật khẩu hiện tại, mật khẩu mới theo quy tắc (hiện đạt / chưa đạt khi gõ), nhập lại; có popup xác nhận.
 */
export function AccountSettings({
  nameLabel,
  infoNote,
  passwordNote,
  editablePhone = false,
}: {
  nameLabel: string
  infoNote: string
  passwordNote: string
  /** Cặp đôi tự sửa số điện thoại (NCC, Admin: chỉ xem) */
  editablePhone?: boolean
}) {
  const { user } = useAuth()
  const me = useQuery({ queryKey: ['auth', 'me', user?.id], queryFn: authApi.me, enabled: !!user, staleTime: 0 })
  const info = me.data ?? user
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [confirm, setConfirm] = useState(false)
  const [changingEmail, setChangingEmail] = useState(false)
  const owner = { username: info?.username, email: info?.email, phone: info?.phone }

  // Họ tên, tên đăng nhập: chưa sửa thì lấy theo dữ liệu mới nhất từ máy chủ
  const saved = { name: info?.name ?? '', username: info?.username ?? '', phone: info?.phone ?? '' }
  const [edited, setEdited] = useState<typeof saved | null>(null)
  const draft = edited ?? saved
  const [infoErrors, setInfoErrors] = useState<{ name?: string; username?: string; phone?: string }>({})
  const infoDirty = draft.name.trim() !== saved.name || draft.username.trim() !== saved.username || (editablePhone && draft.phone.trim() !== saved.phone)
  const qc = useQueryClient()
  const update = useUpdateProfile()

  function saveInfo() {
    const found: typeof infoErrors = {}
    if (!draft.name.trim()) found.name = `Nhập ${nameLabel.toLowerCase()}.`
    if (!draft.username.trim()) found.username = 'Nhập tên đăng nhập.'
    if (editablePhone && draft.phone.trim() && !PHONE_RE.test(draft.phone.trim())) found.phone = 'Số điện thoại cần 10 số, bắt đầu bằng 0.'
    setInfoErrors(found)
    if (Object.keys(found).length) return
    update.mutate(
      { name: draft.name.trim(), username: draft.username.trim(), ...(editablePhone && { phone: draft.phone.trim() || null }) },
      {
        onSuccess: (u) => {
          qc.setQueryData(['auth', 'me', user?.id], u)
          setEdited(null)
          toast('Đã lưu thông tin tài khoản.')
        },
        onError: (e) => {
          const details = e instanceof ApiError && e.details && typeof e.details === 'object' ? (e.details as typeof infoErrors) : {}
          if (Object.keys(details).length) setInfoErrors(details)
          else toast(e.message)
        },
      },
    )
  }

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

      <form
        noValidate
        className={card}
        onSubmit={(e) => {
          e.preventDefault()
          saveInfo()
        }}
      >
        <FormSection title="Thông tin tài khoản" description={infoNote}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-sm:grid-cols-1">
            <FormField
              label={`${nameLabel} *`}
              className={controlClass}
              autoComplete="name"
              maxLength={100}
              disabled={update.isPending}
              value={draft.name}
              onChange={(e) => (setEdited({ ...draft, name: e.target.value }), setInfoErrors((x) => ({ ...x, name: undefined })))}
              error={infoErrors.name}
            />
            <FormField
              label="Tên đăng nhập *"
              className={controlClass}
              autoComplete="username"
              maxLength={50}
              disabled={update.isPending}
              value={draft.username}
              onChange={(e) => (setEdited({ ...draft, username: e.target.value }), setInfoErrors((x) => ({ ...x, username: undefined })))}
              error={infoErrors.username}
            />
            <FormField label="Email đăng nhập" className={readOnly} disabled value={info?.email || '—'} />
            {editablePhone ? (
              <FormField
                label="Số điện thoại"
                className={controlClass}
                type="tel"
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
                disabled={update.isPending}
                value={draft.phone}
                onChange={(e) => (setEdited({ ...draft, phone: e.target.value }), setInfoErrors((x) => ({ ...x, phone: undefined })))}
                error={infoErrors.phone}
              />
            ) : (
              <FormField label="Số điện thoại" className={readOnly} disabled value={info?.phone || '—'} />
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2.5">
            <Button type="button" variant="outline" className="h-10" onClick={() => setChangingEmail(true)}>
              <Mail />
              Đổi email đăng nhập
            </Button>
            <Button type="submit" className="h-10" disabled={update.isPending || !infoDirty}>
              {update.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
              Lưu thông tin
            </Button>
          </div>
        </FormSection>
      </form>

      <form
        noValidate
        className={cn(card, 'mt-5')}
        onSubmit={(e) => {
          e.preventDefault()
          openConfirm()
        }}
      >
        <FormSection title="Đổi mật khẩu" description={passwordNote}>
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
      <ChangeEmailDialog currentEmail={info?.email ?? ''} open={changingEmail} onOpenChange={setChangingEmail} />
    </div>
  )
}
