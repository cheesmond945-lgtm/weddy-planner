import { isVnPhone, PHONE_MESSAGE } from '@/lib/phone'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Info, LayoutGrid, LoaderCircle, Mail, Phone, Store, UserRound } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { ApiError } from '@/api/client'
import { consultationApi } from '@/api/consultations'
import { FormError, FormField } from '@/components/FormField'
import { LetterDialogContent } from '@/components/LetterDialog'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useCategories } from '@/features/catalog/hooks'
import { cn } from '@/lib/utils'

type Errors = Partial<Record<'brandName' | 'contactName' | 'phone' | 'email' | 'categoryId', string>>
type Step = 'form' | 'confirm' | 'done'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMPTY = { brandName: '', contactName: '', phone: '', email: '', categoryId: '' }

const Row = ({ label, children }: { label: string; children: string | undefined }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right font-medium">{children}</dd>
  </div>
)

/**
 * Form "Đăng ký hợp tác" để nhà cung cấp xin tư vấn hợp tác (mở từ nút trên header giao diện khách hàng).
 * Yêu cầu gửi lên sẽ hiện ở trang Yêu cầu hợp tác của Admin. Dùng chung khung "lá thư" với hộp thông tin đám cưới.
 * Số điện thoại đã gửi thì không gửi lại được; muốn đổi thông tin thì báo Admin khi được liên hệ (ngoài hệ thống).
 */
export function PartnerRegistrationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categories = [] } = useCategories()
  const categoryFieldId = useId()
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
    if (!isVnPhone(v.phone)) e.phone = PHONE_MESSAGE
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

  const title = step === 'done' ? 'Đã gửi đăng ký' : step === 'confirm' ? 'Xác nhận thông tin' : 'Đăng ký hợp tác'
  const description =
    step === 'done' ? 'Chúng tôi sẽ liên hệ lại với bạn' : step === 'confirm' ? 'Kiểm tra kỹ thông tin trước khi gửi' : 'Trở thành đối tác cùng Forever'

  return (
    <Dialog open={open} onOpenChange={close}>
      {/* Cùng khung "lá thư" với hộp Thiết lập / Chỉnh sửa thông tin đám cưới */}
      <LetterDialogContent title={title} description={description}>
        {step === 'done' ? (
          <div className="grid justify-items-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-sage-soft text-sage">
              <CircleCheck className="size-7" />
            </span>
            <p className="text-sm leading-relaxed text-ink-2">
              Cảm ơn bạn đã quan tâm. Chúng tôi sẽ liên hệ qua số <b className="text-ink">{v.phone}</b> và gửi thông tin tài khoản tới <b className="text-ink">{v.email}</b>. Nếu cần
              thay đổi email hay thông tin khác, bạn vui lòng báo khi chúng tôi liên hệ.
            </p>
            <Summary brandName={v.brandName} category={category?.name} contactName={v.contactName} />
            <Footer>
              <Button type="button" className="h-10 px-6" onClick={() => close(false)}>
                Đóng
              </Button>
            </Footer>
          </div>
        ) : step === 'confirm' ? (
          <div className="grid gap-4">
            <div className="grid gap-2.5 rounded-xl border border-gold/30 bg-white/85 px-4 py-3.5 text-sm text-ink-2">
              <p>
                Chúng tôi sẽ liên hệ qua <b className="text-ink">số điện thoại</b>
                <span className="mt-0.5 block text-xl font-semibold text-gold-800 tabular-nums">{v.phone}</span>
              </p>
              <p>
                và gửi tài khoản tới <b className="text-ink">email</b>
                <span className="mt-0.5 block text-base font-semibold break-all text-gold-800">{v.email}</span>
              </p>
            </div>
            <Summary brandName={v.brandName} category={category?.name} contactName={v.contactName} />
            <Footer>
              <Button type="button" variant="outline" className="h-10" disabled={register.isPending} onClick={() => setStep('form')}>
                Sửa lại
              </Button>
              <Button type="button" className="h-10 gap-2 px-5" disabled={register.isPending} onClick={submit}>
                {register.isPending && <LoaderCircle className="animate-spin" />}
                Đã đúng, gửi
              </Button>
            </Footer>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault()
              review()
            }}
            className="flex flex-col gap-4"
          >
            <FormField
              label={<Required>Tên thương hiệu / Studio</Required>}
              icon={<Store />}
              placeholder="VD: Dream Wedding Studio"
              maxLength={150}
              value={v.brandName}
              onChange={(e) => set({ brandName: e.target.value })}
              error={errors.brandName}
              className={FIELD}
            />
            <div>
              <label htmlFor={categoryFieldId} className="mb-1.5 block text-[13px] font-medium">
                <Required>Lĩnh vực hoạt động</Required>
              </label>
              <div className="relative">
                <LayoutGrid aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-gold-700" />
                <select
                  id={categoryFieldId}
                  className={cn(
                    'w-full border px-3 pl-11 text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring aria-invalid:border-destructive',
                    FIELD,
                    !v.categoryId && 'text-muted-foreground',
                  )}
                  aria-invalid={errors.categoryId ? true : undefined}
                  value={v.categoryId}
                  onChange={(e) => set({ categoryId: e.target.value })}
                >
                  <option value="" disabled>
                    Chọn lĩnh vực
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="text-ink">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {errors.categoryId && <p className="mt-1.5 text-[13px] text-destructive">{errors.categoryId}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label={<Required>Người liên hệ</Required>}
                icon={<UserRound />}
                placeholder="Họ và tên"
                maxLength={100}
                value={v.contactName}
                onChange={(e) => set({ contactName: e.target.value })}
                error={errors.contactName}
                className={FIELD}
              />
              <FormField
                label={<Required>Số điện thoại</Required>}
                icon={<Phone />}
                type="tel"
                inputMode="numeric"
                placeholder="09xx..."
                value={v.phone}
                onChange={(e) => set({ phone: e.target.value })}
                error={errors.phone}
                className={FIELD}
              />
            </div>
            <FormField
              label={<Required>Email</Required>}
              icon={<Mail />}
              type="email"
              placeholder="email@thuonghieu.vn"
              value={v.email}
              onChange={(e) => set({ email: e.target.value })}
              error={errors.email}
              className={FIELD}
            />

            {notice && (
              <div role="status" className="flex gap-2.5 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-[13px] leading-relaxed text-info">
                <Info className="mt-0.5 size-4 flex-none" />
                <p>{notice}</p>
              </div>
            )}
            <FormError message={formError} />

            <Footer>
              <Button type="button" variant="outline" className="h-10" onClick={() => close(false)}>
                Hủy
              </Button>
              <Button type="submit" className="h-10 gap-2 px-5">
                Tiếp tục
                <ArrowRight aria-hidden className="size-[18px]" />
              </Button>
            </Footer>
          </form>
        )}
      </LetterDialogContent>
    </Dialog>
  )
}

/** Ô nhập cùng kiểu form thông tin đám cưới: cao 40px, bo tròn, nền trắng mờ để nổi trên ảnh nền lá thư */
const FIELD = 'h-10 rounded-xl border-line bg-white/85 py-1.5 text-sm'

/** Nhãn trường bắt buộc: dấu * đỏ */
function Required({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <span className="text-destructive">*</span>
    </>
  )
}

/** Hàng nút cuối form, kẻ một đường mảnh phía trên như form thông tin đám cưới */
function Footer({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-wrap items-center justify-end gap-2.5 border-t border-line pt-3.5">{children}</div>
}

/** Tóm tắt thương hiệu, lĩnh vực, người liên hệ */
function Summary({ brandName, category, contactName }: { brandName: string; category?: string; contactName: string }) {
  return (
    <dl className="grid w-full gap-1.5 rounded-xl bg-white/70 px-4 py-3 text-[13.5px]">
      <Row label="Thương hiệu">{brandName}</Row>
      <Row label="Lĩnh vực">{category}</Row>
      <Row label="Người liên hệ">{contactName}</Row>
    </dl>
  )
}
