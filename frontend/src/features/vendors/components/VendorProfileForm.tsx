import { Lock, Pencil, Send, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FormField } from '@/components/FormField'
import { ApiError } from '@/api'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { VendorDocument, VendorFile, VendorProfile } from '@/types/vendor'
import { documentSlotsOf, isProfileReadOnly, PHOTO_LABEL, PHOTO_TYPE, photosRequired } from '../constants'
import { useSaveVendorProfile, useSuggestDescription } from '../hooks'
import { MAX_DESCRIPTION, toFormValues, toRequest, mapsUrlFromAddress, validateProfile, type ProfileErrors, type ProfileFormValues } from '../profileForm'
import { ConfirmDialog } from './ConfirmDialog'
import { controlClass, Field, FormSection } from './FormParts'
import { PhotoAlbumCard } from './PhotoAlbumCard'
import { TimeCombobox } from './TimeCombobox'
import { UnsavedChangesGuard } from './UnsavedChangesGuard'

/** Cuộn tới ô lỗi đầu tiên (theo thứ tự trên trang) và đưa con trỏ vào đó để NCC sửa ngay. */
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
const frameGrid = 'grid items-start gap-5 max-sm:grid-cols-1!'
/** Chia đều chiều ngang: số cột bằng số khung trong hàng */
const cols = (n: number) => ({ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` })

/**
 * Form Hồ sơ nhà cung cấp, hai khung: thông tin doanh nghiệp; hình ảnh cơ sở và giấy tờ.
 * Bản nháp / Cần bổ sung: sửa hết, Lưu nháp và Gửi xác minh. Chờ duyệt: chỉ đọc.
 * Đã duyệt: nhóm hiển thị (giới thiệu, giờ làm việc, link Maps) sửa và lưu ngay; nhóm pháp lý (thông tin doanh nghiệp, giấy tờ)
 * chỉ sửa sau khi bấm "Cập nhật hồ sơ", rồi "Gửi cập nhật" (hậu kiểm: ghi ngay, Admin kiểm tra sau).
 * reviewMode: Admin xem cùng bố cục, chỉ đọc, kèm `actions` thay cho hàng nút.
 * Đặt key theo profile.updatedAt để form nạp lại giá trị sau mỗi lần lưu.
 */
export function VendorProfileForm({ profile, reviewMode, actions }: { profile: VendorProfile; reviewMode?: boolean; actions?: ReactNode }) {
  const save = useSaveVendorProfile()
  const suggest = useSuggestDescription()
  const baseline = useMemo(() => toFormValues(profile), [profile])
  const [values, setValues] = useState(baseline)
  // Sau lần bấm đầu tiên thì kiểm tra lại theo từng lần sửa (như prototype)
  const [checkMode, setCheckMode] = useState<'draft' | 'submit' | null>(null)
  // Bản cập nhật bị yêu cầu chỉnh sửa: mở sẵn chế độ sửa để NCC sửa ngay
  const [updating, setUpdating] = useState(profile.revisionRequested)
  const [confirmAi, setConfirmAi] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)

  const verified = profile.status === 'VERIFIED'
  // reviewMode: Admin xem hồ sơ trong đúng bố cục của NCC, mọi ô chỉ đọc, nút bấm do `actions` quyết định
  const readOnly = !!reviewMode || isProfileReadOnly(profile)
  const busy = save.isPending
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline)

  // Nhóm hiển thị khóa khi chỉ đọc; nhóm pháp lý còn khóa khi đã duyệt mà chưa bấm "Cập nhật hồ sơ"
  const displayOff = readOnly || busy
  const legalOff = readOnly || busy || (verified && !updating)

  // Lĩnh vực do Admin gán khi tạo tài khoản, NCC không đổi được
  const category = profile.category
  const slug = category?.slug
  // Lỗi do server trả về (VD mã số thuế đã tồn tại), xóa khi NCC sửa lại bất kỳ ô nào
  const [serverErrors, setServerErrors] = useState<ProfileErrors>({})
  useEffect(() => setServerErrors({}), [values])
  const errors: ProfileErrors = { ...(checkMode ? validateProfile(values, slug, checkMode) : {}), ...serverErrors }

  const set = (patch: Partial<ProfileFormValues>) => setValues((v) => ({ ...v, ...patch }))

  // Link Maps do nút "Tạo từ địa chỉ" sinh ra (hoặc đã khớp địa chỉ lúc mở trang): tự cập nhật theo địa chỉ mới.
  // Link NCC tự dán thì không đụng tới.
  const [autoMapsUrl, setAutoMapsUrl] = useState<string | null>(() => (baseline.googleMapsUrl && baseline.googleMapsUrl === mapsUrlFromAddress(baseline) ? baseline.googleMapsUrl : null))
  const setAddressPart = (patch: Partial<Pick<ProfileFormValues, 'address' | 'ward' | 'province'>>) => {
    const next = { ...values, ...patch }
    const url = mapsUrlFromAddress(next)
    if (autoMapsUrl && values.googleMapsUrl === autoMapsUrl && url) {
      setAutoMapsUrl(url)
      set({ ...patch, googleMapsUrl: url })
    } else set(patch)
  }

  function handleSave(submit: boolean) {
    const mode = submit ? 'submit' : 'draft'
    setCheckMode(mode)
    const found = Object.keys(validateProfile(values, slug, mode)).length
    if (found) {
      toast(`Hồ sơ còn ${found} mục chưa hợp lệ, vui lòng kiểm tra các ô báo đỏ.`)
      return scrollToFirstError()
    }
    // Gửi xác minh / gửi cập nhật: hỏi lại trước khi gửi; lưu nháp thì lưu luôn
    if (submit) return setConfirmSubmit(true)
    doSave(false)
  }

  function doSave(submit: boolean) {
    save.mutate(
      { body: toRequest(values), submit, verified },
      {
        onError: (err) => {
          const details = err instanceof ApiError && err.details && typeof err.details === 'object' ? (err.details as Record<string, string>) : null
          if (!details) return
          const mapped: ProfileErrors = {}
          for (const [key, message] of Object.entries(details)) {
            if (key === 'documents') {
              // Server không nói loại giấy tờ nào: báo ở giấy tờ bắt buộc còn thiếu đầu tiên, nếu không thì giấy tờ đầu tiên
              const target = slots.find((x) => x.required && !values.documents.some((d) => d.type === x.type)) ?? slots[0]
              mapped[`document:${target.type}`] = message
            } else mapped[key as keyof ProfileErrors] = message
          }
          setServerErrors(mapped)
          scrollToFirstError()
        },
      },
    )
  }

  function cancelUpdate() {
    setValues(baseline)
    setCheckMode(null)
    setUpdating(false)
  }

  function generate() {
    suggest.mutate(
      { businessName: values.businessName.trim() || null, ward: values.ward.trim() || null, province: values.province.trim() || null },
      { onSuccess: ({ description }) => set({ description }) },
    )
  }

  const setDocuments = (type: VendorDocument['type'], files: VendorFile[]) =>
    setValues((v) => ({ ...v, documents: [...v.documents.filter((d) => d.type !== type), ...files.map((f) => ({ ...f, type }))] }))
  const setPhotos = (files: VendorFile[]) => setValues((v) => ({ ...v, photos: files.map((f) => ({ ...f, type: PHOTO_TYPE })) }))

  const input = (off: boolean) => cn(controlClass, off && 'bg-surface-2')
  const slots = documentSlotsOf(slug)
  const renderDoc = (s: (typeof slots)[number]) => (
    <PhotoAlbumCard
      key={s.type}
      label={s.label}
      galleryTitle={s.label.toLowerCase()}
      required={s.required}
      photos={values.documents.filter((d) => d.type === s.type)}
      locked={legalOff}
      error={errors[`document:${s.type}`]}
      onChange={(files) => setDocuments(s.type, files)}
    />
  )

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!readOnly && !(verified && !updating)) handleSave(true)
      }}
      className="grid min-w-0 gap-5"
    >
      <div className={card}>
        <FormSection title="Thông tin doanh nghiệp">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-sm:grid-cols-1">
            <FormField
              label="Tên doanh nghiệp *"
              className={input(legalOff)}
              disabled={legalOff}
              value={values.businessName}
              onChange={(e) => set({ businessName: e.target.value })}
              error={errors.businessName}
            />
            <FormField
              label="Mã số thuế *"
              className={input(legalOff)}
              disabled={legalOff}
              inputMode="numeric"
              placeholder="10 hoặc 13 chữ số"
              value={values.taxCode}
              onChange={(e) => set({ taxCode: e.target.value })}
              error={errors.taxCode}
            />
            <FormField
              label="Tên người đại diện *"
              className={input(legalOff)}
              disabled={legalOff}
              value={values.representativeName}
              onChange={(e) => set({ representativeName: e.target.value })}
              error={errors.representativeName}
            />
            <Field label="Lĩnh vực cung cấp" error={errors.categoryId} group>
              <div className={cn(controlClass, 'flex items-center bg-surface-2', !category && 'text-muted-foreground')}>
                <Lock className="mr-2 size-4 flex-none text-muted-foreground" />
                {category?.name ?? 'Chưa được gán'}
              </div>
            </Field>
            <div className="col-span-full">
              <FormField
                label="Địa chỉ cụ thể *"
                className={input(legalOff)}
                disabled={legalOff}
                placeholder="Số nhà, tên đường"
                value={values.address}
                onChange={(e) => setAddressPart({ address: e.target.value })}
                error={errors.address}
              />
            </div>
            <FormField
              label="Tỉnh/Thành phố *"
              className={input(legalOff)}
              disabled={legalOff}
              placeholder="VD: Hà Nội"
              value={values.province}
              onChange={(e) => setAddressPart({ province: e.target.value })}
              error={errors.province}
            />
            <FormField
              label="Phường/Xã *"
              className={input(legalOff)}
              disabled={legalOff}
              placeholder="VD: Khương Đình"
              value={values.ward}
              onChange={(e) => setAddressPart({ ward: e.target.value })}
              error={errors.ward}
            />
            <div className="col-span-full">
              <FormField
                label="Link Google Maps"
                className={input(legalOff)}
                disabled={legalOff}
                type="url"
                placeholder="https://maps.app.goo.gl/…"
                hint={
                  legalOff && values.googleMapsUrl.trim() ? (
                    <a href={values.googleMapsUrl.trim()} target="_blank" rel="noreferrer" className="font-medium text-gold-ink hover:underline">
                      Xem trên Google Maps
                    </a>
                  ) : (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      VD: https://maps.app.goo.gl/…
                      {!legalOff && (
                        <button
                          type="button"
                          disabled={!mapsUrlFromAddress(values)}
                          title={mapsUrlFromAddress(values) ? 'Điền link tìm kiếm Google Maps theo địa chỉ' : 'Nhập địa chỉ cụ thể, phường/xã và tỉnh/thành phố trước'}
                          onClick={() => (setAutoMapsUrl(mapsUrlFromAddress(values)), set({ googleMapsUrl: mapsUrlFromAddress(values) ?? '' }))}
                          className="font-medium text-gold-ink hover:underline disabled:pointer-events-none disabled:opacity-50"
                        >
                          Tạo từ địa chỉ
                        </button>
                      )}
                    </span>
                  )
                }
                value={values.googleMapsUrl}
                onChange={(e) => set({ googleMapsUrl: e.target.value })}
                error={errors.googleMapsUrl}
              />
            </div>
            <TimeCombobox label="Giờ mở cửa" placeholder="VD: 08:00" value={values.openTime} onChange={(openTime) => set({ openTime })} error={errors.openTime} disabled={displayOff} />
            <TimeCombobox label="Giờ đóng cửa" placeholder="VD: 21:00" value={values.closeTime} onChange={(closeTime) => set({ closeTime })} error={errors.closeTime} disabled={displayOff} />
            <p className="col-span-full -mt-2 text-[13px] text-muted-foreground">Chọn giờ từ danh sách hoặc tự điền theo định dạng HH:mm (ví dụ 8:15).</p>
            <div className="col-span-full grid gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="vendor-description" className="text-[13px] font-medium">
                  Giới thiệu
                </label>
                {!reviewMode && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-pill border-line-strong px-4"
                    disabled={displayOff || suggest.isPending}
                    onClick={() => (values.description.trim() ? setConfirmAi(true) : generate())}
                  >
                    <Sparkles className="text-[#7c3aed]" />
                    {suggest.isPending ? 'Đang tạo…' : 'Tạo với AI'}
                  </Button>
                )}
              </div>
              <textarea
                id="vendor-description"
                rows={6}
                maxLength={MAX_DESCRIPTION}
                disabled={displayOff}
                aria-invalid={errors.description ? true : undefined}
                placeholder="Giới thiệu về doanh nghiệp, dịch vụ nổi bật, phong cách và kinh nghiệm của bạn…"
                className={cn(controlClass, 'h-auto min-h-[140px] resize-y py-2.5 leading-relaxed', displayOff && 'bg-surface-2')}
                value={values.description}
                onChange={(e) => set({ description: e.target.value })}
              />
              {errors.description ? (
                <span role="alert" data-field-error className="text-[13px] text-destructive">
                  {errors.description}
                </span>
              ) : (
                <span className="text-[13px] text-muted-foreground">
                  {values.description.length}/{MAX_DESCRIPTION} ký tự
                </span>
              )}
            </div>
          </div>
        </FormSection>
      </div>

      <div className={card}>
        <FormSection
          title="Hình ảnh cơ sở và giấy tờ"
          description={`Bộ hồ sơ cho lĩnh vực ${category?.name ?? 'của bạn'}. Ảnh JPG, PNG, WEBP, tối đa 10MB mỗi ảnh. Chỉ phục vụ xét duyệt, không hiển thị công khai.`}
        >
          <div className="grid gap-6">
            {/* Hàng 1: giấy phép kinh doanh, giấy PCCC (nhà hàng thêm giấy ATTP). Hàng 2: ảnh cơ sở, chứng chỉ tay nghề */}
            <div className={frameGrid} style={cols(slots.filter((s) => s.required).length)}>
              {slots
                .filter((s) => s.required)
                .map((s) => renderDoc(s))}
            </div>
            <div className={frameGrid} style={cols(1 + slots.filter((s) => !s.required).length)}>
              <PhotoAlbumCard
                label={PHOTO_LABEL}
                galleryTitle="cơ sở"
                required={photosRequired(slug)}
                photos={values.photos}
                locked={legalOff}
                error={errors.photos}
                onChange={setPhotos}
              />
              {slots
                .filter((s) => !s.required)
                .map((s) => renderDoc(s))}
            </div>
          </div>
        </FormSection>
      </div>

      {reviewMode ? (
        actions
      ) : (
      <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:[&>button]:flex-1">
        {!readOnly && !verified && (
          <>
            <Button type="button" variant="outline" className="h-10 border-line-strong" disabled={busy} onClick={() => handleSave(false)}>
              {profile.status === 'NEEDS_REVISION' ? 'Lưu' : 'Lưu nháp'}
            </Button>
            <Button type="submit" className="h-10" disabled={busy}>
              {busy ? (
                'Đang gửi…'
              ) : (
                <>
                  <Send />
                  {profile.status === 'NEEDS_REVISION' ? 'Gửi lại xác minh' : 'Gửi xác minh'}
                </>
              )}
            </Button>
          </>
        )}

        {!readOnly && verified && !updating && (
          <>
            <Button type="button" variant="outline" className="h-10 border-line-strong" disabled={busy} onClick={() => setUpdating(true)}>
              <Pencil />
              Cập nhật hồ sơ
            </Button>
            <Button type="button" className="h-10" disabled={busy} onClick={() => (dirty ? handleSave(false) : toast('Chưa có thay đổi nào để lưu.'))}>
              {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </>
        )}

        {!readOnly && verified && updating && (
          <>
            <Button type="button" variant="outline" className="h-10 border-line-strong" disabled={busy} onClick={cancelUpdate}>
              Hủy
            </Button>
            <Button type="submit" className="h-10" disabled={busy}>
              {busy ? (
                'Đang gửi…'
              ) : (
                <>
                  <Send />
                  Gửi cập nhật
                </>
              )}
            </Button>
          </>
        )}
      </div>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        title={verified ? 'Gửi cập nhật hồ sơ?' : profile.status === 'NEEDS_REVISION' ? 'Gửi lại hồ sơ để xác minh?' : 'Gửi hồ sơ để xác minh?'}
        confirmLabel={verified ? 'Gửi cập nhật' : 'Gửi xác minh'}
        onConfirm={() => doSave(true)}
      >
        {verified ? (
          <p>Thông tin mới sẽ có hiệu lực ngay, hồ sơ vẫn hiển thị. Trong lúc Admin kiểm tra lại, hồ sơ chuyển sang chỉ đọc cho tới khi có kết quả.</p>
        ) : (
          <p>Sau khi gửi, hồ sơ chuyển sang chờ duyệt và chỉ đọc cho tới khi Admin xử lý. Bạn đã kiểm tra kỹ thông tin và giấy tờ chưa?</p>
        )}
      </ConfirmDialog>
      <ConfirmDialog open={confirmAi} onOpenChange={setConfirmAi} title="Thay phần giới thiệu hiện tại?" confirmLabel="Tạo mới" onConfirm={generate}>
        <p>Nội dung bạn đã nhập trong ô Giới thiệu sẽ được thay bằng đoạn do AI gợi ý.</p>
      </ConfirmDialog>
      <UnsavedChangesGuard when={dirty && !readOnly && !busy} />
    </form>
  )
}
