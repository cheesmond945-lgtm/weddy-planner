import { EyeOff, Send, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { FormField } from '@/components/FormField'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { controlClass, Field, FormSection } from '@/features/vendors/components/FormParts'
import { PhotoAlbumCard } from '@/features/vendors/components/PhotoAlbumCard'
import { UnsavedChangesGuard } from '@/features/vendors/components/UnsavedChangesGuard'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { CategoryRef } from '@/types/catalog'
import type { VendorFile, VendorProfile } from '@/types/vendor'
import type { VendorPackage } from '@/types/vendorPackage'
import { canSubmitPackage, isVenue, workingCopy } from '../constants'
import { usePackageAction, useSavePackage, useSuggestPackageDescription } from '../hooks'
import { EMPTY_PACKAGE, toFormValues, toRequest, validatePackage, type PackageFormValues } from '../packageForm'
import { useListHref } from './PackageHeader'
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

/** Cuộn tới ô lỗi đầu tiên và đưa con trỏ vào đó. */
function scrollToFirstError() {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-field-error]')
      if (!first) return
      first.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const control = first.matches('input, textarea, select') ? first : first.closest('label, div')?.querySelector<HTMLElement>('input:not([type="file"]), textarea, select')
      control?.focus({ preventScroll: true })
    }),
  )
}

const card = 'rounded-md border border-line bg-surface px-7 pt-[26px] pb-6 shadow-portal max-sm:px-4 max-sm:pt-5 max-sm:pb-4'
const MAX_PACKAGE_PHOTOS = 30

interface PackageEditorProps {
  /** Không có là tạo gói mới */
  pkg?: VendorPackage
  /** Không có khi Admin xem (không có hồ sơ của chính mình) */
  profile?: VendorProfile
  category: CategoryRef
  /** Tên nhà cung cấp, hiện ở đầu form khi Admin xem */
  vendorName?: string
  /** Chỉ xem (gói chờ duyệt, đã đăng, ẩn): mọi ô bị khóa, hàng nút do `actions` quyết định */
  readOnly?: boolean
  actions?: ReactNode
  /** Gói đã đăng: thoát form sửa bản cập nhật về chế độ xem (nút Hủy khi chưa lưu bản cập nhật nào, sau khi xóa bản cập nhật) */
  onExitUpdate?: () => void
}

/**
 * Form gói dịch vụ, hai khung: thông tin gói; hình ảnh dịch vụ (cùng cách trình bày với trang Hồ sơ NCC).
 * Thứ tự: tên gói, giá, tags, sức chứa (trung tâm tổ chức sự kiện), mô tả (có "Tạo với AI"), ảnh.
 * Lưu nháp: cần tên gói và giá. Gửi duyệt: thêm mô tả, ít nhất một ảnh, và hồ sơ đã được duyệt đúng lĩnh vực.
 * Đặt key theo pkg.updatedAt để nạp lại sau khi lưu.
 */
export function PackageEditor({ pkg, profile, category, vendorName, readOnly, actions, onExitUpdate }: PackageEditorProps) {
  const navigate = useNavigate()
  const listHref = useListHref()
  const save = useSavePackage()
  const action = usePackageAction()
  const suggest = useSuggestPackageDescription()
  // Gói đã đăng: form là bản cập nhật (nếu đã có), bản đang đăng giữ nguyên tới khi Admin duyệt
  const baseline = useMemo(() => (pkg ? toFormValues(workingCopy(pkg)) : EMPTY_PACKAGE), [pkg])
  const [values, setValues] = useState(baseline)
  const [checkMode, setCheckMode] = useState<'draft' | 'submit' | null>(null)
  const [confirm, setConfirm] = useState<'submit' | 'remove' | 'hide' | 'ai' | null>(null)
  const isUpdate = pkg?.status === 'PUBLISHED'
  const hasUpdate = isUpdate && !!pkg.pendingUpdate
  const resubmit = pkg?.status === 'NEEDS_REVISION' || pkg?.pendingUpdate?.status === 'NEEDS_REVISION'

  const venue = isVenue(category)
  const canSubmit = canSubmitPackage(profile, category)
  const busy = save.isPending || action.isPending
  const off = busy || !!readOnly
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)
  const errors = checkMode ? validatePackage(values, { mode: checkMode, venue, canSubmit }) : {}

  const set = (patch: Partial<PackageFormValues>) => setValues((v) => ({ ...v, ...patch }))
  const input = (invalid?: boolean) => cn(controlClass, off && 'bg-surface-2', invalid && 'border-destructive')

  function handleSave(submit: boolean) {
    const mode = submit ? 'submit' : 'draft'
    const found = validatePackage(values, { mode, venue, canSubmit })
    setCheckMode(mode)
    const keys = Object.keys(found)
    if (keys.length) {
      // Chỉ thiếu quyền gửi duyệt thì báo ngắn; còn lỗi nhập liệu thì báo đỏ và cuộn tới ô lỗi
      if (found.permission) toast(found.permission)
      if (keys.some((k) => k !== 'permission')) {
        toast(`Gói còn ${keys.filter((k) => k !== 'permission').length} mục chưa hợp lệ, vui lòng kiểm tra các ô báo đỏ.`)
        scrollToFirstError()
      }
      return
    }
    if (submit) return setConfirm('submit')
    doSave(false)
  }

  function doSave(submit: boolean) {
    save.mutate(
      { id: pkg?.id, body: toRequest(values, venue), submit },
      {
        // Gói mới: sang trang của gói vừa tạo
        onSuccess: ({ pkg: saved }) => !pkg && navigate(paths.vendor.package(saved.id), { replace: true }),
      },
    )
  }

  function generate() {
    suggest.mutate(
      { name: values.name.trim() || null, tags: values.tags, price: values.price || null, capacity: venue && values.capacity.trim() ? Number(values.capacity) : null },
      { onSuccess: ({ description }) => set({ description }) },
    )
  }

  const setPhotos = (files: VendorFile[]) => set({ photos: files })

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!readOnly) handleSave(true)
      }}
      className="grid min-w-0 gap-5"
    >
      <div className={card}>
        <FormSection title="Thông tin gói">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-sm:grid-cols-1">
            {vendorName && (
              <div className="col-span-full">
                <FormField label="Nhà cung cấp" className={input()} disabled value={vendorName} readOnly />
              </div>
            )}
            <div className="col-span-full">
              <FormField
                label="Tên gói *"
                className={input()}
                disabled={off}
                placeholder={venue ? 'VD: Tiệc cưới – Menu A' : 'VD: Gói trang trí gia tiên tông trắng'}
                value={values.name}
                onChange={(e) => set({ name: e.target.value })}
                error={errors.name}
              />
            </div>
            <Field label="Giá *" error={errors.price}>
              <WithUnit unit="đ">
                <MoneyInput
                  className={cn(input(!!errors.price), 'pr-8 text-right tabular-nums')}
                  disabled={off}
                  aria-invalid={errors.price ? true : undefined}
                  value={values.price}
                  onChange={(price) => set({ price })}
                />
              </WithUnit>
            </Field>
            <Field label="Tags" full group>
              <TagsInput tags={values.tags} onChange={(tags) => set({ tags })} disabled={off} />
            </Field>
            {venue && (
              <Field label="Sức chứa tối đa (khách)" error={errors.capacity} hint="Tính theo khách, không quy đổi sang bàn.">
                <WithUnit unit="khách">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    disabled={off}
                    placeholder="VD: 500"
                    className={cn(input(!!errors.capacity), 'pr-14 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none')}
                    aria-invalid={errors.capacity ? true : undefined}
                    value={values.capacity}
                    onChange={(e) => set({ capacity: e.target.value })}
                  />
                </WithUnit>
              </Field>
            )}
            <div className="col-span-full grid gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="package-description" className="text-[13px] font-medium">
                  Mô tả *
                </label>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-pill border-line-strong px-4"
                    disabled={off || suggest.isPending}
                    onClick={() => (values.description.trim() ? setConfirm('ai') : generate())}
                  >
                    <Sparkles className="text-[#7c3aed]" />
                    {suggest.isPending ? 'Đang tạo…' : 'Tạo với AI'}
                  </Button>
                )}
              </div>
              <textarea
                id="package-description"
                rows={6}
                maxLength={3000}
                disabled={off}
                aria-invalid={errors.description ? true : undefined}
                placeholder="Giới thiệu điểm nổi bật, những gì có trong gói và đối tượng phù hợp…"
                className={cn(input(!!errors.description), 'h-auto min-h-[140px] resize-y py-2.5 leading-relaxed')}
                value={values.description}
                onChange={(e) => set({ description: e.target.value })}
              />
              {errors.description ? (
                <span role="alert" data-field-error className="text-[13px] text-destructive">
                  {errors.description}
                </span>
              ) : (
                <span className="text-[13px] text-muted-foreground">{values.description.length}/3000 ký tự</span>
              )}
            </div>
          </div>
        </FormSection>
      </div>

      <div className={card}>
        <FormSection title="Hình ảnh dịch vụ">
          <div>
            <PhotoAlbumCard
              label="Ảnh dịch vụ"
              galleryTitle="dịch vụ"
              required
              purpose="PACKAGE_PHOTO"
              maxMB={5}
              maxPhotos={MAX_PACKAGE_PHOTOS}
              mosaic
              photos={values.photos}
              locked={off}
              error={errors.photos}
              onChange={setPhotos}
            />
          </div>
        </FormSection>
      </div>

      {readOnly ? (
        actions
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:[&>a]:flex-1 max-sm:[&>button]:flex-1">
          {pkg && (!isUpdate || hasUpdate) && (
            <Button type="button" variant="outline" className="mr-auto h-10 border-warn/50 text-warn hover:bg-warn-soft" disabled={busy} onClick={() => setConfirm('remove')}>
              <Trash2 />
              Xóa bản nháp
            </Button>
          )}
          {hasUpdate && (
            <Button type="button" variant="outline" className="h-10 border-line-strong" disabled={busy} onClick={() => setConfirm('hide')}>
              <EyeOff />
              Ẩn dịch vụ
            </Button>
          )}
          {isUpdate && !hasUpdate && onExitUpdate ? (
            <Button type="button" variant="outline" className="h-10 border-line-strong" disabled={busy} onClick={onExitUpdate}>
              Hủy
            </Button>
          ) : (
            <Button asChild variant="outline" className="h-10 border-line-strong">
              <Link to={listHref}>Hủy</Link>
            </Button>
          )}
          <Button type="button" variant="outline" className="h-10 border-line-strong" disabled={busy} onClick={() => handleSave(false)}>
            Lưu nháp
          </Button>
          <Button type="submit" className="h-10" disabled={busy} title={canSubmit ? undefined : 'Cần hồ sơ đã được duyệt đúng lĩnh vực'}>
            <Send />
            {busy ? 'Đang lưu…' : resubmit ? 'Gửi lại duyệt' : 'Gửi duyệt'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'submit'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={isUpdate ? (resubmit ? 'Gửi lại bản cập nhật để duyệt?' : 'Gửi bản cập nhật để duyệt?') : resubmit ? 'Gửi lại gói để duyệt?' : 'Gửi gói để duyệt?'}
        confirmLabel="Gửi duyệt"
        onConfirm={() => doSave(true)}
      >
        <p>
          {isUpdate
            ? 'Sau khi gửi, bản cập nhật chỉ đọc cho tới khi Admin xử lý. Trong thời gian này khách vẫn thấy phiên bản đang đăng.'
            : 'Sau khi gửi, gói chuyển sang chờ duyệt và chỉ đọc cho tới khi Admin xử lý. Gói chưa hiển thị công khai cho tới khi được duyệt.'}
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'remove'}
        onOpenChange={(o) => !o && setConfirm(null)}
        danger
        title={isUpdate ? 'Xóa bản cập nhật nháp?' : 'Xóa bản nháp?'}
        confirmLabel={isUpdate ? 'Xóa bản cập nhật' : 'Xóa gói'}
        onConfirm={() =>
          pkg &&
          (isUpdate
            ? action.mutate({ action: 'discardUpdate', pkg }, { onSuccess: () => onExitUpdate?.() })
            : action.mutate({ action: 'remove', pkg }, { onSuccess: () => navigate(listHref, { replace: true }) }))
        }
      >
        <p>
          {isUpdate
            ? `Mọi thay đổi chưa được duyệt sẽ bị bỏ. Gói “${pkg?.name}” giữ nguyên phiên bản đang đăng.`
            : `Gói “${pkg?.name}” và toàn bộ ảnh của nó sẽ bị xóa. Không thể hoàn tác.`}
        </p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'hide'} onOpenChange={(o) => !o && setConfirm(null)} title="Ẩn dịch vụ?" confirmLabel="Ẩn dịch vụ" onConfirm={() => pkg && action.mutate({ action: 'hide', pkg })}>
        <p>Khách sẽ không còn thấy dịch vụ này. Bản cập nhật đang sửa được giữ lại, bạn sửa tiếp được sau khi khôi phục.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'ai'} onOpenChange={(o) => !o && setConfirm(null)} title="Thay phần mô tả hiện tại?" confirmLabel="Tạo mới" onConfirm={generate}>
        <p>Nội dung bạn đã nhập trong ô Mô tả sẽ được thay bằng đoạn do AI gợi ý.</p>
      </ConfirmDialog>
      <UnsavedChangesGuard when={dirty && !readOnly && !busy} />
    </form>
  )
}
