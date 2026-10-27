import { useState, type ChangeEvent, type FormEvent } from 'react'
import { FormError, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import type { SessionUser } from '@/types/auth'
import { useUpdateProfile } from '../hooks'
import { profileSchema, validate, type FieldErrors } from '../schemas'

type Values = { name: string; email: string }

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
          <DialogDescription className="sr-only">Sửa họ tên, email</DialogDescription>
        </DialogHeader>
        {/* key: mở lại modal thì form lấy lại giá trị mới nhất */}
        {open && <ProfileForm key={user.id} user={user} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ProfileForm({ user, onDone }: { user: SessionUser; onDone: () => void }) {
  const [values, setValues] = useState<Values>({ name: user.name, email: user.email ?? '' })
  const [errors, setErrors] = useState<FieldErrors<Values>>({})
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
      // Không còn ô số điện thoại: gửi lại số cũ (nếu có) để không bị xóa
      { name: data.name, email: data.email || null, phone: user.phone ?? null },
      {
        onSuccess: () => {
          onDone()
          toast('Đã lưu thông tin cá nhân')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField label="Họ và tên" autoComplete="name" value={values.name} onChange={change('name')} error={errors.name} autoFocus />
      <FormField label="Email" type="email" autoComplete="email" value={values.email} onChange={change('email')} error={errors.email} />
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
  )
}
