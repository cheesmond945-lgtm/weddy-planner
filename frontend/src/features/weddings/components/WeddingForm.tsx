import { CalendarDays, List, MapPin, UserRound, UsersRound, Wallet } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { FormError, FormField } from '@/components/FormField'
import { MoneyInput } from '@/components/MoneyInput'
import { MultiSelect } from '@/components/MultiSelect'
import { SearchSelect, type SearchSelectGroup } from '@/components/SearchSelect'
import { Button } from '@/components/ui/button'
import { useCategories, useAreas } from '@/features/catalog/hooks'
import { TimeCombobox } from '@/features/vendors/components/TimeCombobox'
import { addDays, toISODate, today } from '@/lib/date'
import type { BudgetPreset, Wedding, WeddingInput } from '@/types/wedding'
import { validateWeddingForm, type WeddingFormErrors } from '../weddingFormRules'
import { BudgetPresetPicker } from './BudgetPresetPicker'

interface WeddingFormProps {
  initial: Wedding | null
  submitLabel: ReactNode
  pending: boolean
  error?: string | null
  onSubmit: (input: WeddingInput) => void
  /** Nút bên trái hàng nút (Hủy, hoặc Đăng xuất ở hộp thiết lập lần đầu) */
  secondaryAction?: ReactNode
}

// Lỗi từng trường; giờ chính kiểm tra riêng (không bắt buộc)
type Errors = WeddingFormErrors & { mainTime?: string }

/** Form thông tin đám cưới (4.1), như wedForm trong prototype. Dùng chung cho tạo mới và chỉnh sửa: cùng thứ tự trường, cùng validate. */
export function WeddingForm({ initial, submitLabel, pending, error, onSubmit, secondaryAction }: WeddingFormProps) {
  const { data: categories = [] } = useCategories()
  const ids = { services: useId() }

  const [groomName, setGroomName] = useState(initial?.groomName ?? '')
  const [brideName, setBrideName] = useState(initial?.brideName ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [ward, setWard] = useState(initial?.ward ?? '')
  const [mainTime, setMainTime] = useState(initial?.mainTime ?? '')
  const [guestCount, setGuestCount] = useState(initial?.guestCount ? String(initial.guestCount) : '')
  const [budget, setBudget] = useState(initial?.budget ?? 0)
  // Tùy chỉnh chỉ đặt ở tab Ngân sách; form chỉ gửi khi khách chọn một trong ba mức
  const [budgetPreset, setBudgetPreset] = useState<BudgetPreset>(initial?.budgetPreset ?? 'BALANCED')
  // Lần đầu: mặc định chọn tất cả dịch vụ như prototype
  const [services, setServices] = useState<string[] | null>(initial?.categorySlugs ?? null)
  const serviceValue = services ?? categories.map((c) => c.slug)
  const [errors, setErrors] = useState<Errors>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs = validateWeddingForm({ brideName, groomName, date, ward, guestCount, budget, services: serviceValue }, toISODate(today()))
    const guests = guestCount ? Number(guestCount) : null
    if (mainTime.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(mainTime.trim())) (errs as Errors).mainTime = 'Nhập giờ dạng HH:mm, ví dụ 11:00.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSubmit({ groomName: groomName.trim(), brideName: brideName.trim(), date, mainTime: mainTime.trim() || null, ward, guestCount: guests, budget, ...(budgetPreset !== 'CUSTOM' && { budgetPreset }), categorySlugs: serviceValue, ...(initial?.version && { version: initial.version }) })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label={<Required>Tên cô dâu</Required>}
          icon={<UserRound />}
          maxLength={100}
          autoComplete="off"
          placeholder="Nhập tên cô dâu"
          value={brideName}
          onChange={(e) => {
            setBrideName(e.target.value)
            setErrors((x) => ({ ...x, brideName: undefined }))
          }}
          error={errors.brideName}
          className={FIELD}
        />
        <FormField
          label={<Required>Tên chú rể</Required>}
          icon={<UserRound />}
          maxLength={100}
          autoComplete="off"
          placeholder="Nhập tên chú rể"
          value={groomName}
          onChange={(e) => {
            setGroomName(e.target.value)
            setErrors((x) => ({ ...x, groomName: undefined }))
          }}
          error={errors.groomName}
          className={FIELD}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label={<Required>Ngày tổ chức</Required>}
          icon={<CalendarDays />}
          type="date"
          min={toISODate(addDays(today(), 1))}
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setErrors((x) => ({ ...x, date: undefined }))
          }}
          error={errors.date}
          className={FIELD}
        />
        <FormField
          label={<Required>Số khách dự kiến</Required>}
          icon={<UsersRound />}
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="Ví dụ: 250"
          value={guestCount}
          onChange={(e) => {
            setGuestCount(e.target.value)
            setErrors((x) => ({ ...x, guestCount: undefined }))
          }}
          error={errors.guestCount}
          hint="Nên nhập số khách tối đa dự kiến"
          className={FIELD}
        />
      </div>

      <div className="grid items-start gap-3.5 sm:grid-cols-2">
        <TimeCombobox
          label="Giờ đón khách / làm lễ (không bắt buộc)"
          placeholder="Ví dụ 11:00"
          value={mainTime}
          onChange={(v) => {
            setMainTime(v)
            setErrors((x) => ({ ...x, mainTime: undefined }))
          }}
          error={errors.mainTime}
        />
        <p className="text-[13px] text-muted-foreground sm:mt-7">Mốc để xếp giờ có mặt cho trang trí, makeup, hoa, chụp ảnh… trong ngày cưới. Nhập sau cũng được.</p>
      </div>

      <WardField
        value={ward}
        onChange={(v) => {
          setWard(v)
          setErrors((x) => ({ ...x, ward: undefined }))
        }}
        error={errors.ward}
      />

      <BudgetField
        value={budget}
        onChange={(v) => {
          setBudget(v)
          setErrors((x) => ({ ...x, budget: undefined }))
        }}
        error={errors.budget}
      />

      <div>
        <span id={ids.services} className="mb-1.5 block text-[13px] font-medium">
          <Required>Dịch vụ muốn sử dụng</Required>
        </span>
        <MultiSelect
          aria-labelledby={ids.services}
          icon={<List />}
          options={categories.map((c) => ({ value: c.slug, label: c.name }))}
          value={serviceValue}
          onChange={(v) => {
            setServices(v)
            setErrors((x) => ({ ...x, services: undefined }))
          }}
          placeholder="Chọn dịch vụ"
          allLabel="Tất cả dịch vụ"
          maxChips={2}
          selectAll
          invalid={!!errors.services}
        />
        {errors.services ? (
          <p role="alert" className="mt-1.5 text-[13px] text-destructive">
            {errors.services}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">Dịch vụ đã chọn sẽ được đưa vào timeline khung. Bỏ chọn thì việc của dịch vụ đó tạm ẩn, chọn lại sẽ hiện lại cùng các việc đã tích.</p>
        )}
      </div>

      <BudgetPresetPicker value={budgetPreset} onChange={setBudgetPreset} />

      <FormError message={error} />

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line pt-3.5">
        {secondaryAction}
        <Button type="submit" disabled={pending} className="h-10 gap-2 px-5">
          {pending ? 'Đang lưu…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Ô nhập trong form này: cao hơn, bo tròn, nền trắng mờ để nổi trên ảnh nền hộp thiết lập */
const FIELD = 'h-10 rounded-xl border-line bg-white/85 py-1.5 text-sm'

/** Nhãn trường bắt buộc: dấu * đỏ */
function Required({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <span className="text-destructive">*</span>
    </>
  )
}

function BudgetField({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        <Required>Tổng ngân sách (đồng)</Required>
      </label>
      <div className="relative">
        <Wallet aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-gold-700" />
        <MoneyInput id={id} placeholder="Ví dụ: 300.000.000" value={value} onChange={onChange} aria-invalid={error ? true : undefined} className={`${FIELD} pl-11`} />
      </div>
      {error && <p className="mt-1.5 text-[13px] text-destructive">{error}</p>}
    </div>
  )
}

/** Nơi tổ chức: một phường/xã của Hà Nội (NCC hiện chỉ có ở Hà Nội). Giá trị lưu có tiền tố "Phường …"/"Xã …". */
/** Nhóm Phường / Xã từ danh sách khu vực (cùng danh sách với bộ lọc Khu vực ở trang Dịch vụ) */
const wardGroups = (areas: string[]): SearchSelectGroup[] => [
  { label: 'Phường', options: areas.filter((a) => a.startsWith('Phường ')).map((a) => ({ value: a, label: a.replace(/^Phường /, '') })) },
  { label: 'Xã', options: areas.filter((a) => a.startsWith('Xã ')).map((a) => ({ value: a, label: a.replace(/^Xã /, '') })) },
]

function WardField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const id = useId()
  // Cùng danh sách với bộ lọc Khu vực; đám cưới cũ đã chọn phường/xã không còn trong danh sách thì vẫn giữ giá trị đó
  const { data: areas = [] } = useAreas()
  const options = value && !areas.includes(value) ? [value, ...areas] : areas
  return (
    <div>
      <span id={`${id}-label`} className="mb-1.5 block text-[13px] font-medium">
        <Required>Nơi tổ chức (Hà Nội)</Required>
      </span>
      <SearchSelect
        aria-labelledby={`${id}-label`}
        aria-describedby={error ? `${id}-err` : undefined}
        icon={<MapPin />}
        groups={wardGroups(options)}
        value={value}
        onChange={onChange}
        placeholder={areas.length ? 'Chọn phường/xã' : 'Đang tải khu vực…'}
        searchPlaceholder="Tìm phường/xã, vd: cau giay"
        display={(v) => `${v}, Hà Nội`}
        invalid={!!error}
      />
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
