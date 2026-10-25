import { Copy, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCategories } from '@/features/catalog/hooks'
import { controlClass, Field } from '@/features/vendors/components/FormParts'
import { ApiError } from '@/api/client'
import type { Role } from '@/types/auth'
import type { AdminUser, SaveUserBody } from '@/types/admin'
import { ROLE_LABEL } from '../constants'
import { useSaveUser } from '../hooks'
import { PanelDialog } from '@/features/serviceOrders/components/PanelDialog'

/** Giá trị điền sẵn khi tạo tài khoản NCC từ một yêu cầu tư vấn. */
export interface UserPreset {
  role?: Role
  username?: string
  email?: string
  phone?: string
  categoryId?: string
  consultationId?: string
  /** Tạo từ yêu cầu tư vấn: tên đăng nhập, vai trò, lĩnh vực lấy từ yêu cầu và bị khóa (email, SĐT vẫn sửa được) */
  locked?: boolean
}

interface UserFormDialogProps {
  /** Có: sửa tài khoản này. Không: tạo mới */
  user?: AdminUser
  preset?: UserPreset
  onClose: () => void
  onSaved?: (u: AdminUser) => void
}

type Errors = Partial<Record<'username' | 'email' | 'phone' | 'role' | 'categoryId', string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^0\d{9}$/

/** Thêm mới / sửa thông tin tài khoản (hộp "Thêm mới tài khoản", "Sửa thông tin tài khoản"). */
export function UserFormDialog({ user, preset, onClose, onSaved }: UserFormDialogProps) {
  const save = useSaveUser(user?.id ?? null)
  const { data: categories = [] } = useCategories()
  const [v, setV] = useState({
    username: user?.username ?? preset?.username ?? '',
    email: user?.email ?? preset?.email ?? '',
    phone: user?.phone ?? preset?.phone ?? '',
    role: (user?.role ?? preset?.role ?? '') as Role | '',
    categoryId: preset?.categoryId ?? '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  // Mật khẩu hệ thống vừa sinh: hiện một lần sau khi tạo, đóng hộp là mất
  const [created, setCreated] = useState<AdminUser | null>(null)
  const [copied, setCopied] = useState(false)

  const set = (patch: Partial<typeof v>) => {
    setV((x) => ({ ...x, ...patch }))
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
  }
  const needCategory = !user && v.role === 'VENDOR'
  const locked = !!preset?.locked

  function submit() {
    const e: Errors = {}
    if (!v.username.trim()) e.username = 'Nhập tên đăng nhập.'
    if (!EMAIL_RE.test(v.email.trim())) e.email = 'Email chưa hợp lệ.'
    if (!PHONE_RE.test(v.phone.trim())) e.phone = 'Số điện thoại cần 10 số, bắt đầu bằng 0.'
    if (!v.role) e.role = 'Chọn vai trò người dùng.'
    if (needCategory && !v.categoryId) e.categoryId = 'Chọn lĩnh vực cung cấp.'
    setErrors(e)
    if (Object.keys(e).length) return
    setFormError('')
    const body: SaveUserBody = {
      username: v.username.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      role: v.role as Role,
      categoryId: needCategory ? v.categoryId : undefined,
      consultationId: preset?.consultationId,
    }
    save.mutate(body, {
      onSuccess: (u) => {
        onSaved?.(u)
        // Đã gửi email: chỉ cần toast. Chỉ mở hộp mật khẩu khi gửi lỗi để Admin chuyển tay
        if (u.generatedPassword) setCreated(u)
        else onClose()
      },
      onError: (err) => {
        const code = err instanceof ApiError ? err.code : ''
        if (code === 'EMAIL_ALREADY_EXISTS') setErrors({ email: err.message })
        else if (code === 'PHONE_ALREADY_EXISTS') setErrors({ phone: err.message })
        else setFormError(err.message)
      },
    })
  }

  if (created) {
    const password = created.generatedPassword
    return (
      <PanelDialog
        open
        size="md"
        onRequestClose={onClose}
        title="Đã tạo tài khoản"
        subtitle="Chưa gửi được email nên mật khẩu hiện ở đây, chỉ hiện một lần. Hãy gửi cho người dùng, họ có thể đổi mật khẩu sau khi đăng nhập."
        footer={<Button onClick={onClose}>Đóng</Button>}
      >
        <dl className="grid gap-3 text-[14px]">
          <div>
            <dt className="text-muted-foreground">Email đăng nhập</dt>
            <dd className="font-semibold">{created.email}</dd>
          </div>
          {password && (
            <div>
              <dt className="text-muted-foreground">Mật khẩu</dt>
              <dd className="flex items-center gap-2">
                <code className="rounded-lg bg-muted px-3 py-2 text-[15px] font-semibold tracking-wider">{password}</code>
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(password)
                    setCopied(true)
                  }}
                >
                  <Copy />
                  {copied ? 'Đã sao chép' : 'Sao chép'}
                </Button>
              </dd>
            </div>
          )}
        </dl>
      </PanelDialog>
    )
  }

  return (
    <PanelDialog
      open
      size="md"
      onRequestClose={() => !save.isPending && onClose()}
      title={user ? 'Sửa thông tin tài khoản' : 'Thêm mới tài khoản'}
      subtitle={preset?.consultationId ? 'Điền sẵn từ yêu cầu đăng ký. Tên đăng nhập là tên người liên hệ; email và số điện thoại có thể chỉnh nếu nhà cung cấp gửi sai.' : undefined}
      footer={
        <>
          {formError && (
            <p role="alert" className="mr-auto text-[13px] text-destructive max-sm:basis-full">
              {formError}
            </p>
          )}
          <Button variant="ghost" className="text-warn hover:bg-warn-soft hover:text-warn" onClick={onClose} disabled={save.isPending}>
            Đóng
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <LoaderCircle className="animate-spin" />}
            Lưu
          </Button>
        </>
      }
    >
      <fieldset disabled={save.isPending} className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 max-sm:grid-cols-1">
        <Field label={<>Tên đăng nhập <b className="text-destructive">*</b></>} error={errors.username}>
          <Input className={controlClass} placeholder="Tên đăng nhập" aria-invalid={errors.username ? true : undefined} disabled={locked} value={v.username} onChange={(e) => set({ username: e.target.value })} />
        </Field>
        <Field label={<>Email <b className="text-destructive">*</b></>} error={errors.email} hint={user ? 'Email là thông tin đăng nhập nên không sửa được.' : undefined}>
          <Input className={controlClass} type="email" placeholder="Email" aria-invalid={errors.email ? true : undefined} disabled={!!user} value={v.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label={<>Số điện thoại <b className="text-destructive">*</b></>} error={errors.phone}>
          <Input className={controlClass} type="tel" inputMode="numeric" placeholder="Số điện thoại" aria-invalid={errors.phone ? true : undefined} value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label={<>Vai trò người dùng <b className="text-destructive">*</b></>} error={errors.role} hint={user ? 'Không đổi được vai trò của tài khoản đã tạo.' : undefined}>
          <select className={controlClass} disabled={!!user || locked} aria-invalid={errors.role ? true : undefined} value={v.role} onChange={(e) => set({ role: e.target.value as Role })}>
            <option value="" disabled>
              Vai trò người dùng
            </option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        {needCategory && (
          <Field label={<>Lĩnh vực cung cấp <b className="text-destructive">*</b></>} error={errors.categoryId} full hint={locked ? undefined : 'Chọn đúng lĩnh vực đã xác minh với nhà cung cấp.'}>
            <select className={controlClass} disabled={locked} aria-invalid={errors.categoryId ? true : undefined} value={v.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="" disabled>
                Chọn lĩnh vực
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </fieldset>
    </PanelDialog>
  )
}
