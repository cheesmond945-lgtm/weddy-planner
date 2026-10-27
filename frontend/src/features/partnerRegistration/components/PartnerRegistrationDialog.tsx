import { useMutation } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Info, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/api/client'
import { consultationApi } from '@/api/consultations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCategories } from '@/features/catalog/hooks'
import { controlClass, Field } from '@/features/vendors/components/FormParts'

type Errors = Partial<Record<'brandName' | 'contactName' | 'phone' | 'email' | 'categoryId', string>>
type Step = 'form' | 'confirm' | 'done'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^0\d{9}$/
const EMPTY = { brandName: '', contactName: '', phone: '', email: '', categoryId: '' }

const Row = ({ label, children }: { label: string; children: string | undefined }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right font-medium">{children}</dd>
  </div>
)

/**
 * Form "Đăng ký thông tin" để nhà cung cấp xin tư vấn hợp tác. Yêu cầu gửi lên sẽ hiện ở trang Yêu cầu tư vấn của Admin.
 * Số điện thoại đã gửi thì không gửi lại được; muốn đổi thông tin thì báo Admin khi được liên hệ (ngoài hệ thống).
 * Đang gắn ở header Admin để thử; sau này đặt ở header giao diện khách hàng.
 */
export function PartnerRegistrationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categories = [] } = useCategories()
  const [v, setV] = useState(EMPTY)
  const [step, setStep] = useState<Step>('form')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  // Đã gửi trước đó (trùng số hoặc email): khung thông báo trung tính, không phải lỗi nhập liệu
  const [notice, setNotice] = useState('')

  const register = useMutation({ mutationFn: consultationApi.register })
  const category = categories.find((c) => c.id === v.categoryId)

  const set = (patch: Partial<typeof v>) => {
    setV((x) => ({ ...x, ...patch }))
    setErrors((e) => ({ ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }))
    setNotice('')
  }

  function close(next: boolean) {
    if (register.isPending) return
    onOpenChange(next)
    if (!next) {
      // Gửi xong thì lần mở sau là form trống; chưa gửi được thì giữ nguyên dữ liệu đã nhập
      if (step === 'done') setV(EMPTY)
      setStep('form')
      setErrors({})
      setFormError('')
      setNotice('')
    }
  }

  function review() {
    const e: Errors = {}
    if (!v.brandName.trim()) e.brandName = 'Nhập tên thương hiệu.'
    if (!v.contactName.trim()) e.contactName = 'Nhập tên người liên hệ.'
    if (!PHONE_RE.test(v.phone.trim())) e.phone = 'Số điện thoại cần 10 số, bắt đầu bằng 0.'
    if (!EMAIL_RE.test(v.email.trim())) e.email = 'Email chưa hợp lệ.'
    if (!v.categoryId) e.categoryId = 'Chọn lĩnh vực hoạt động.'
    setErrors(e)
    if (Object.keys(e).length) return
    setFormError('')
    setNotice('')
    setStep('confirm')
  }

  function submit() {
    register.mutate(
      { brandName: v.brandName.trim(), contactName: v.contactName.trim(), phone: v.phone.trim(), email: v.email.trim(), categoryId: v.categoryId },
      {
        onSuccess: () => setStep('done'),
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : ''
          // Quay lại form để người gửi thấy đúng chỗ cần xem lại
          setStep('form')
          if (code === 'CONSULTATION_ALREADY_EXISTS') setNotice(err.message)
          else if (code === 'EMAIL_ALREADY_EXISTS') setErrors({ email: err.message })
          else if (code === 'PHONE_ALREADY_EXISTS') setErrors({ phone: err.message })
          else setFormError(err.message)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[94dvh] max-w-[560px] overflow-y-auto rounded-[32px] px-10 py-10 max-sm:rounded-none max-sm:px-5">
        {step === 'done' ? (
          <div className="grid justify-items-center gap-3 py-4 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-sage-soft text-sage">
              <CircleCheck className="size-8" />
            </span>
            <DialogTitle className="text-[26px] leading-tight">Đã gửi đăng ký</DialogTitle>
            <DialogDescription className="text-[14px] leading-relaxed text-muted-foreground">
              Cảm ơn bạn đã quan tâm. Chúng tôi sẽ liên hệ qua số <b className="text-ink">{v.phone}</b> và gửi thông tin tài khoản tới <b className="text-ink">{v.email}</b>. Nếu cần
              thay đổi email hay thông tin khác, bạn vui lòng báo khi chúng tôi liên hệ.
            </DialogDescription>
            <dl className="mt-2 grid w-full gap-1.5 rounded-md bg-surface-2 px-4 py-3 text-[13.5px]">
              <Row label="Thương hiệu">{v.brandName}</Row>
              <Row label="Lĩnh vực">{category?.name}</Row>
              <Row label="Người liên hệ">{v.contactName}</Row>
            </dl>
            <Button size="lg" className="mt-3 h-12 rounded-pill px-10" onClick={() => close(false)}>
              Đóng
            </Button>
          </div>
        ) : step === 'confirm' ? (
          <>
            <DialogTitle className="text-[26px] leading-tight">Xác nhận thông tin</DialogTitle>
            <DialogDescription className="mt-2 text-[14px] leading-relaxed text-muted-foreground">Vui lòng kiểm tra kỹ thông tin trước khi gửi.</DialogDescription>
            <div className="mt-5 grid gap-3 rounded-md border border-gold/30 bg-gold-soft px-5 py-4 text-[14px] text-gold-ink">
              <p>
                Chúng tôi sẽ liên hệ qua <b>số điện thoại</b>
                <span className="mt-0.5 block text-[22px] font-semibold tabular-nums">{v.phone}</span>
              </p>
              <p>
                và gửi tài khoản tới <b>email</b>
                <span className="mt-0.5 block text-[18px] font-semibold break-all">{v.email}</span>
              </p>
            </div>
            <dl className="mt-4 grid gap-1.5 text-[13.5px]">
              <Row label="Thương hiệu">{v.brandName}</Row>
              <Row label="Lĩnh vực">{category?.name}</Row>
              <Row label="Người liên hệ">{v.contactName}</Row>
            </dl>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <Button variant="outline" size="lg" className="h-12 rounded-pill border-line-strong" disabled={register.isPending} onClick={() => setStep('form')}>
                Sửa lại
              </Button>
              <Button size="lg" className="h-12 rounded-pill bg-ink text-bg hover:bg-ink hover:brightness-125" disabled={register.isPending} onClick={submit}>
                {register.isPending && <LoaderCircle className="animate-spin" />}
                Đã đúng, gửi
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle className="text-[30px] leading-tight tracking-wide uppercase">Đăng ký thông tin</DialogTitle>
            <span aria-hidden className="mt-2 block h-[3px] w-10 rounded-full bg-gold" />
            <DialogDescription className="mt-3 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Trở thành đối tác chiến lược cùng WebPlan</DialogDescription>

            <form
              noValidate
              onSubmit={(ev) => {
                ev.preventDefault()
                review()
              }}
              className="mt-7 grid gap-5"
            >
              <Field label="Tên thương hiệu / Studio" error={errors.brandName}>
                <Input className={controlClass} placeholder="VD: Dream Wedding Studio" maxLength={150} aria-invalid={errors.brandName ? true : undefined} value={v.brandName} onChange={(e) => set({ brandName: e.target.value })} />
              </Field>
              <Field label="Lĩnh vực hoạt động" error={errors.categoryId}>
                <select className={controlClass} aria-invalid={errors.categoryId ? true : undefined} value={v.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
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
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <Field label="Người liên hệ" error={errors.contactName}>
                  <Input className={controlClass} placeholder="Họ và tên" maxLength={100} aria-invalid={errors.contactName ? true : undefined} value={v.contactName} onChange={(e) => set({ contactName: e.target.value })} />
                </Field>
                <Field label="Số điện thoại" error={errors.phone}>
                  <Input className={controlClass} type="tel" inputMode="numeric" placeholder="09xx..." aria-invalid={errors.phone ? true : undefined} value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
                </Field>
              </div>
              <Field label="Email" error={errors.email}>
                <Input className={controlClass} type="email" placeholder="email@thuonghieu.vn" aria-invalid={errors.email ? true : undefined} value={v.email} onChange={(e) => set({ email: e.target.value })} />
              </Field>

              {notice && (
                <div role="status" className="flex gap-2.5 rounded-md border border-info/30 bg-info-soft px-4 py-3 text-[13.5px] leading-relaxed text-info">
                  <Info className="mt-0.5 size-4 flex-none" />
                  <p>{notice}</p>
                </div>
              )}
              {formError && (
                <p role="alert" className="text-[13px] text-destructive">
                  {formError}
                </p>
              )}
              <Button type="submit" size="lg" className="mt-2 h-14 rounded-pill bg-ink text-[12.5px] font-bold tracking-[0.18em] text-bg uppercase shadow-portal-lift hover:bg-ink hover:brightness-125">
                Tiếp tục
                <ArrowRight />
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
