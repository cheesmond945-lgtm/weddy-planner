import { Send } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { FormField } from '@/components/FormField'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { controlClass, Field, FormSection } from '@/features/vendors/components/FormParts'
import { UnsavedChangesGuard } from '@/features/vendors/components/UnsavedChangesGuard'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { CategoryRef } from '@/types/catalog'
import type { VendorProfile } from '@/types/vendor'
import type { VendorPackage } from '@/types/vendorPackage'
import { canSubmitPackage, isVenue, TAG_SUGGESTIONS } from '../constants'
import { useSavePackage } from '../hooks'
import { EMPTY_PACKAGE, toFormValues, toRequest, validatePackage, type PackageFormValues } from '../packageForm'
import { useListHref } from './PackageHeader'
import { PackagePhotoSet, type PhotoSetValue } from './PackagePhotoSet'
import { TagsInput } from './TagsInput'

/** Ô nhập có chữ đơn vị ở cuối ("đ", "khách"). */
function WithUnit({ unit, children }: { unit: string; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted-foreground">{unit}</span>
    </div>
  )
}

/** "Đã lưu lúc 14:05" (hôm nay) hoặc "Đã lưu lúc 14:05 · 20/10/2026". */
function savedAtLabel(iso: string) {
  const d = new Date(iso)
  const tz = { timeZone: 'Asia/Ho_Chi_Minh' } as const
  const time = d.toLocaleTimeString('vi-VN', { ...tz, hour: '2-digit', minute: '2-digit', hour12: false })
  const day = (x: Date) => x.toLocaleDateString('vi-VN', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric' })
  return `Đã lưu lúc ${time}${day(d) === day(new Date()) ? '' : ` · ${day(d)}`}`
}

function scrollToFirstError() {
  requestAnimationFrame(() =>
    document.querySelector('[data-field-error], [aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
  )
}

interface PackageEditorProps {
  /** Không có là tạo gói mới */
  pkg?: VendorPackage
  profile: VendorProfile
  category: CategoryRef
  /** Mở từ "Gửi duyệt" ở danh sách khi gói còn thiếu: hiện lỗi ngay */
  initialCheck?: boolean
}

/**
 * Form thêm/sửa gói ở trạng thái Bản nháp (như prototype NCC). Đặt key theo pkg.updatedAt để nạp lại sau khi lưu.
 * Lưu nháp: cần tên gói. Gửi duyệt: đủ mô tả, giá, ảnh và hồ sơ đã xác minh đúng lĩnh vực.
 * Gói mới lưu xong thì thay URL /new bằng /vendor/catalog/:id (replace) và ở lại form; lần lưu sau cập nhật gói đó.
 */
export function PackageEditor({ pkg, profile, category, initialCheck }: PackageEditorProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const listHref = useListHref()
  const save = useSavePackage()
  const baseline = useMemo(() => (pkg ? toFormValues(pkg) : EMPTY_PACKAGE), [pkg])
  const [values, setValues] = useState(baseline)
  const [checkMode, setCheckMode] = useState<'draft' | 'submit' | null>(initialCheck ? 'submit' : null)
  const [uploading, setUploading] = useState(0)
  // Id gói vừa tạo: lần lưu sau (trước khi trang kịp chuyển sang gói đó) vẫn cập nhật, không tạo trùng
  const createdId = useRef<string | undefined>(undefined)

  const venue = isVenue(category)
  const canSubmit = canSubmitPackage(profile, category)
  const busy = save.isPending
  const savingDraft = busy && save.variables?.submit === false
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)
  const errors = checkMode ? validatePackage(values, { mode: checkMode, venue, canSubmit }) : {}

  const set = (patch: Partial<PackageFormValues>) => setValues((v) => ({ ...v, ...patch }))
  const setPhotos = (update: (prev: PhotoSetValue) => PhotoSetValue) =>
    setValues((v) => ({ ...v, ...update({ photos: v.photos, coverPublicId: v.coverPublicId }) }))

  function handleSave(submit: boolean) {
    if (busy) return
    if (uploading) {
      toast(`Còn ${uploading} ảnh đang tải lên. Đợi tải xong rồi ${submit ? 'gửi duyệt' : 'lưu nháp'}.`)
      return
    }
    const mode = submit ? 'submit' : 'draft'
    const found = validatePackage(values, { mode, venue, canSubmit })
    setCheckMode(mode)
    const keys = Object.keys(found)
    if (keys.length) {
      // Chỉ thiếu quyền gửi duyệt thì báo ngắn; còn lỗi nhập liệu thì cuộn tới ô lỗi
      if (found.permission) toast(found.permission)
      if (keys.some((k) => k !== 'permission')) scrollToFirstError()
      return
    }
    save.mutate(
      { id: pkg?.id ?? createdId.current, body: toRequest(values, venue), submit },
      {
        // Gói mới: thay /new bằng trang của gói (Back về danh sách, không về form trống), giữ bộ lọc danh sách
        onSuccess: ({ pkg: saved }) => {
          if (pkg) return
          createdId.current = saved.id
          navigate(paths.vendor.package(saved.id), { replace: true, state: location.state })
        },
      },
    )
  }

  const area = cn(controlClass, 'h-auto py-2 leading-relaxed')

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        handleSave(true)
      }}
      className="max-w-[980px] min-w-0 rounded-md border border-line bg-surface px-7 pt-[26px] pb-[22px] shadow-portal max-sm:px-4 max-sm:pt-5 max-sm:pb-4"
    >
      <fieldset disabled={busy} className="min-w-0">
        <FormSection title="Thông tin gói">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-sm:grid-cols-1">
            <div className="col-span-full">
              <FormField
                label="Tên gói *"
                className={controlClass}
                placeholder={venue ? 'VD: Tiệc cưới – Menu A' : 'VD: Gói trang trí gia tiên tông trắng'}
                value={values.name}
                onChange={(e) => set({ name: e.target.value })}
                error={errors.name}
              />
            </div>
            <Field label="Mô tả ngắn *" error={errors.description} full>
              <textarea
                rows={3}
                className={area}
                aria-invalid={errors.description ? true : undefined}
                placeholder="Giới thiệu ngắn gọn điểm nổi bật của gói"
                value={values.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
            <Field label="Tags" hint="Tags hiển thị công khai khi gói được duyệt đăng." full group>
              <TagsInput tags={values.tags} onChange={(tags) => set({ tags })} suggestions={TAG_SUGGESTIONS[category.slug] ?? []} />
            </Field>
            <Field label="Giá *" error={errors.price}>
              <WithUnit unit="đ">
                <MoneyInput
                  className={cn(controlClass, 'pr-8 text-right tabular-nums')}
                  aria-invalid={errors.price ? true : undefined}
                  value={values.price}
                  onChange={(price) => set({ price })}
                />
              </WithUnit>
            </Field>
            {venue && (
              <Field label="Sức chứa tối đa (khách)" error={errors.capacity} hint="Tùy chọn · tính theo khách, không quy đổi sang bàn.">
                <WithUnit unit="khách">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="VD: 500"
                    className={cn(controlClass, 'pr-14 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none')}
                    aria-invalid={errors.capacity ? true : undefined}
                    value={values.capacity}
                    onChange={(e) => set({ capacity: e.target.value })}
                  />
                </WithUnit>
              </Field>
            )}
          </div>
        </FormSection>

        <FormSection title="Hình ảnh dịch vụ">
          <PackagePhotoSet photos={values.photos} coverPublicId={values.coverPublicId} onChange={setPhotos} readOnly={busy} error={errors.photos} onUploadingChange={setUploading} />
        </FormSection>
      </fieldset>

      <div className="sticky bottom-0 z-[5] -mx-7 -mb-[22px] flex flex-wrap items-center gap-2.5 rounded-b-md border-t border-line bg-surface/95 px-7 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur-sm max-sm:-mx-4 max-sm:-mb-4 max-sm:px-4 max-sm:[&>a]:flex-1 max-sm:[&>button]:flex-1">
        <span aria-live="polite" className="flex-1 text-[12.5px] text-muted-foreground max-sm:basis-full">
          {busy ? 'Đang lưu…' : uploading ? `Đang tải ${uploading} ảnh lên…` : dirty ? 'Có thay đổi chưa lưu' : pkg ? savedAtLabel(pkg.updatedAt) : ''}
        </span>
        <Button asChild variant="outline" className={cn('h-10 border-line-strong', busy && 'pointer-events-none opacity-50')} aria-disabled={busy || undefined}>
          <Link to={listHref}>{pkg ? 'Quay lại danh sách' : 'Hủy'}</Link>
        </Button>
        <Button type="button" variant="outline" className="h-10 border-line-strong" disabled={busy} onClick={() => handleSave(false)}>
          {savingDraft ? 'Đang lưu…' : 'Lưu nháp'}
        </Button>
        <Button type="submit" className="h-10" disabled={busy} title={canSubmit ? undefined : 'Cần hồ sơ đã xác minh đúng lĩnh vực'}>
          <Send />
          {busy && !savingDraft ? 'Đang gửi…' : 'Gửi duyệt'}
        </Button>
      </div>

      <UnsavedChangesGuard when={dirty && !busy} />
    </form>
  )
}
