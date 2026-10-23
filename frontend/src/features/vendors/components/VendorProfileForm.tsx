import { Lock, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VendorDocument, VendorPhoto, VendorProfile } from '@/types/vendor'
import { documentSlotsOf, isProfileLocked, photoSlotsOf, photosRequired, PROVINCE, RESTAURANT_SLUG } from '../constants'
import { useSaveVendorProfile } from '../hooks'
import { toFormValues, toRequest, validateProfile, type ProfileFormValues } from '../profileForm'
import { BusinessHoursField } from './BusinessHoursField'
import { DistrictCombobox } from './DistrictCombobox'
import { DocumentRow } from './DocumentRow'
import { controlClass, Field, FormSection } from './FormParts'
import { PhotoSlot } from './PhotoSlot'
import { UnsavedChangesGuard } from './UnsavedChangesGuard'

/** Cuộn tới lỗi đầu tiên sau khi bấm Lưu nháp / Gửi xác minh. */
function scrollToFirstError() {
  requestAnimationFrame(() =>
    document.querySelector('[data-field-error], [aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
  )
}

/**
 * Form Hồ sơ nhà cung cấp: thông tin doanh nghiệp, ảnh cơ sở, giấy tờ, lưu nháp và gửi xác minh.
 * Đặt key theo profile.updatedAt để form nạp lại giá trị sau mỗi lần lưu.
 */
export function VendorProfileForm({ profile }: { profile: VendorProfile }) {
  const save = useSaveVendorProfile()
  const baseline = useMemo(() => toFormValues(profile), [profile])
  const [values, setValues] = useState(baseline)
  // Sau lần bấm đầu tiên thì kiểm tra lại theo từng lần sửa (như prototype)
  const [checkMode, setCheckMode] = useState<'draft' | 'submit' | null>(null)

  const locked = isProfileLocked(profile.status)
  const busy = save.isPending
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)

  // Lĩnh vực do Admin gán khi tạo tài khoản, NCC không đổi được
  const category = profile.category
  const slug = category?.slug
  const errors = checkMode ? validateProfile(values, slug, checkMode) : {}

  const set = (patch: Partial<ProfileFormValues>) => setValues((v) => ({ ...v, ...patch }))

  function handleSave(submit: boolean) {
    const mode = submit ? 'submit' : 'draft'
    setCheckMode(mode)
    if (Object.keys(validateProfile(values, slug, mode)).length) return scrollToFirstError()
    save.mutate({ body: toRequest(values), submit })
  }

  const setDocument = (type: VendorDocument['type'], file: VendorDocument | null) =>
    setValues((v) => ({ ...v, documents: [...v.documents.filter((d) => d.type !== type), ...(file ? [file] : [])] }))
  const addPhotos = (added: VendorPhoto[]) => setValues((v) => ({ ...v, photos: [...v.photos, ...added] }))
  const removePhoto = (publicId: string) => setValues((v) => ({ ...v, photos: v.photos.filter((p) => p.publicId !== publicId) }))

  const input = cn(controlClass, 'disabled:bg-surface-2')

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        handleSave(true)
      }}
      className="max-w-[980px] min-w-0 rounded-md border border-line bg-surface px-7 pt-[26px] pb-[22px] shadow-portal max-sm:px-4 max-sm:pt-5 max-sm:pb-4"
    >
      <fieldset disabled={locked || busy} className="min-w-0">
        <FormSection title="Thông tin doanh nghiệp">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-sm:grid-cols-1">
            <FormField
              label="Tên doanh nghiệp *"
              className={input}
              value={values.businessName}
              onChange={(e) => set({ businessName: e.target.value })}
              error={errors.businessName}
            />
            <FormField
              label="Mã số thuế *"
              className={input}
              inputMode="numeric"
              placeholder="10 hoặc 13 chữ số"
              value={values.taxCode}
              onChange={(e) => set({ taxCode: e.target.value })}
              error={errors.taxCode}
            />
            <FormField
              label="Tên người đại diện *"
              className={input}
              value={values.representativeName}
              onChange={(e) => set({ representativeName: e.target.value })}
              error={errors.representativeName}
            />
            <Field label="Lĩnh vực cung cấp" error={errors.categoryId} hint="Liên hệ WebPlan nếu cần đổi lĩnh vực." group>
              <div className={cn(controlClass, 'flex items-center bg-surface-2', !category && 'text-muted-foreground')}>
                <Lock className="mr-2 size-4 flex-none text-muted-foreground" />
                {category?.name ?? 'Chưa được gán'}
              </div>
            </Field>
            <Field label="Tỉnh/Thành phố" group>
              <div className={cn(controlClass, 'flex items-center bg-surface-2')}>
                <Lock className="mr-2 size-4 flex-none text-muted-foreground" />
                {PROVINCE}
              </div>
            </Field>
            <Field label="Quận *" error={errors.district} group>
              <DistrictCombobox value={values.district} onChange={(district) => set({ district })} disabled={locked || busy} invalid={!!errors.district} />
            </Field>
            <div className="col-span-full">
              <FormField
                label="Địa chỉ cụ thể *"
                className={input}
                placeholder="Số nhà, tên đường"
                value={values.address}
                onChange={(e) => set({ address: e.target.value })}
                error={errors.address}
              />
            </div>
            <div className="col-span-full">
              <FormField
                label="Link Google Maps"
                className={input}
                type="url"
                placeholder="https://maps.app.goo.gl/…"
                hint="Tùy chọn · VD: https://maps.app.goo.gl/…"
                value={values.googleMapsUrl}
                onChange={(e) => set({ googleMapsUrl: e.target.value })}
                error={errors.googleMapsUrl}
              />
            </div>
          </div>
          <BusinessHoursField value={values.hours} onChange={(hours) => set({ hours })} error={errors.hours} />
        </FormSection>
      </fieldset>

      <FormSection
        title="Ảnh cơ sở"
        description={
          slug === RESTAURANT_SLUG
            ? 'Nhà hàng cần ảnh mặt tiền. Ảnh hồ sơ tách biệt với album ảnh của gói dịch vụ và không tự công khai.'
            : 'Ảnh mặt tiền hoặc nơi hoạt động. Tách biệt với album ảnh của gói dịch vụ, không tự công khai.'
        }
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
          {photoSlotsOf(slug).map((s) => (
            <PhotoSlot
              key={`${slug}-${s.type}`}
              slot={s}
              required={photosRequired(slug)}
              photos={values.photos.filter((p) => p.type === s.type)}
              locked={locked || busy}
              error={errors[`photo:${s.type}`]}
              onAdd={addPhotos}
              onRemove={removePhoto}
            />
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Giấy tờ"
        description={`Bộ giấy tờ cho lĩnh vực ${category?.name ?? 'của bạn'}. Chỉ phục vụ xét duyệt, không hiển thị công khai.`}
      >
        {documentSlotsOf(slug).map((s) => (
          <DocumentRow
            key={s.type}
            slot={s}
            file={values.documents.find((d) => d.type === s.type)}
            locked={locked || busy}
            error={errors[`document:${s.type}`]}
            onChange={(file) => setDocument(s.type, file)}
          />
        ))}
      </FormSection>

      <div className="sticky bottom-0 z-[5] -mx-7 -mb-[22px] flex flex-wrap items-center gap-2.5 rounded-b-md border-t border-line bg-surface/95 px-7 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur-sm max-sm:-mx-4 max-sm:-mb-4 max-sm:px-4 max-sm:[&>button]:flex-1">
        <span className="flex-1 text-[12.5px] text-muted-foreground max-sm:basis-full">
          {locked ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" /> Hồ sơ đang chỉ đọc
            </span>
          ) : dirty ? (
            'Có thay đổi chưa lưu'
          ) : (
            'Đã lưu'
          )}
        </span>
        <Button type="button" variant="outline" className="h-10 border-line-strong" disabled={locked || busy} onClick={() => handleSave(false)}>
          Lưu nháp
        </Button>
        <Button type="submit" className="h-10" disabled={locked || busy}>
          {busy ? (
            'Đang gửi…'
          ) : (
            <>
              <Send />
              {profile.status === 'NEEDS_REVISION' ? 'Gửi xác minh lại' : 'Gửi xác minh'}
            </>
          )}
        </Button>
      </div>

      <UnsavedChangesGuard when={dirty && !locked && !busy} />
    </form>
  )
}
