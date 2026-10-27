import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError } from '@/api'
import { FormError, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import type { SessionUser } from '@/types/auth'
import { useUpdateProfile } from '../hooks'
import { profileSchema, validate, type FieldErrors } from '../schemas'
import { ChangeEmailDialog } from './ChangeEmailDialog'

type Values = { name: string; username: string; phone: string }

interface ProfileDialogProps {
  user: SessionUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Thông tin cá nhân (1.3), như profileModal trong prototype. */
export function ProfileDialog({ user, open, onOpenChange }: ProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thông tin cá nhân</DialogTitle>
          <DialogDescription className="sr-only">Sửa họ tên, số điện thoại; đổi email đăng nhập</DialogDescription>
        </DialogHeader>
        {/* key: mở lại modal thì form lấy lại giá trị mới nhất */}
        {open && <ProfileForm key={user.id} user={user} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ProfileForm({ user, onDone }: { user: SessionUser; onDone: () => void }) {
  const [values, setValues] = useState<Values>({ name: user.name, username: user.username ?? '', phone: user.phone ?? '' })
  const [errors, setErrors] = useState<FieldErrors<Values>>({})
  const [changingEmail, setChangingEmail] = useState(false)
  const update = useUpdateProfile()

  const change = (key: keyof Values) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: undefined }))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const { data, errors } = validate(profileSchema, values)
    setErrors(errors)
    if (!data) return
    update.mutate(
      { name: data.name, username: data.username, phone: data.phone || null },
      {
        onSuccess: () => {
          onDone()
          toast('Đã lưu thông tin cá nhân')
        },
        // Lỗi theo trường (VD tên đăng nhập trùng) hiện dưới ô tương ứng
        onError: (err) => err instanceof ApiError && err.details && typeof err.details === 'object' && setErrors(err.details as FieldErrors<Values>),
      },
    )
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Họ và tên" autoComplete="name" maxLength={100} value={values.name} onChange={change('name')} error={errors.name} autoFocus />
          <FormField label="Tên đăng nhập" autoComplete="username" maxLength={50} value={values.username} onChange={change('username')} error={errors.username} />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {/* Email là thông tin đăng nhập: đổi qua hộp riêng (mật khẩu + mã xác minh) */}
          <FormField
            label="Email đăng nhập"
            type="email"
            value={user.email ?? ''}
            readOnly
            className="bg-muted"
            hint={
              <button type="button" onClick={() => setChangingEmail(true)} className="font-medium text-primary underline underline-offset-[3px]">
                Đổi email
              </button>
            }
          />
          <FormField
            label="Số điện thoại"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={values.phone}
            onChange={change('phone')}
            error={errors.phone}
          />
        </div>
        <FormError message={update.error?.message} />
        <DialogFooter className="mt-1">
          <Button type="button" variant="outline" onClick={onDone}>
            Hủy
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </DialogFooter>
      </form>
      {/* Ngoài form: sự kiện submit của hộp con (qua portal) không lan lên form này */}
      <ChangeEmailDialog currentEmail={user.email ?? ''} open={changingEmail} onOpenChange={setChangingEmail} />
    </>
  )
}
