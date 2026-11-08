import { CalendarDays, List, MapPin, UserRound, UsersRound, Wallet } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { FormError, FormField } from '@/components/FormField'
import { MoneyInput } from '@/components/MoneyInput'
import { MultiSelect } from '@/components/MultiSelect'
import { SearchSelect, type SearchSelectGroup } from '@/components/SearchSelect'
import { Button } from '@/components/ui/button'
import { useAreas, useCategories, useCategoryMinCosts } from '@/features/catalog/hooks'
import { addDays, toISODate, today } from '@/lib/date'
import type { BudgetPreset, Wedding, WeddingInput } from '@/types/wedding'
import { presetOptionsFor } from '../presets'
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

type Errors = WeddingFormErrors

/** Form thông tin đám cưới (4.1), như wedForm trong prototype. Dùng chung cho tạo mới và chỉnh sửa: cùng thứ tự trường, cùng validate. */
export function WeddingForm({ initial, submitLabel, pending, error, onSubmit, secondaryAction }: WeddingFormProps) {
  const { data: categories = [] } = useCategories()
  const ids = { services: useId() }

  const [groomName, setGroomName] = useState(initial?.groomName ?? '')
  const [brideName, setBrideName] = useState(initial?.brideName ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [ward, setWard] = useState(initial?.ward ?? '')
  const [guestCount, setGuestCount] = useState(initial?.guestCount ? String(initial.guestCount) : '')
  const [budget, setBudget] = useState(initial?.budget ?? 0)
  // Tùy chỉnh chỉ đặt ở tab Ngân sách; form chỉ gửi khi khách chọn một trong ba mức
  const [budgetPreset, setBudgetPreset] = useState<BudgetPreset>(initial?.budgetPreset ?? 'BALANCED')
  // Lần đầu: mặc định chọn tất cả dịch vụ như prototype
  const [services, setServices] = useState<string[] | null>(initial?.categorySlugs ?? null)
  const serviceValue = services ?? categories.map((c) => c.slug)
  // Mức Ưu tiên mà khách bỏ hết dịch vụ được ưu tiên thì không còn tác dụng: khóa thẻ, đang chọn thì tính là Cân bằng
  const presetOptions = presetOptionsFor(serviceValue, (slug) => categories.find((c) => c.slug === slug)?.name ?? slug)
  const preset = presetOptions.find((o) => o.value === budgetPreset)?.disabled ? 'BALANCED' : budgetPreset
  // Giá thấp nhất từng hạng mục theo số khách đang nhập: kiểm tra ngân sách đủ tối thiểu cho các dịch vụ đã chọn
  const { data: minCosts } = useCategoryMinCosts(Number(guestCount) > 0 ? Math.floor(Number(guestCount)) : 0)
  const [errors, setErrors] = useState<Errors>({})
  const [tried, setTried] = useState(false)
  const validate = () => validateWeddingForm({ brideName, groomName, date, ward, guestCount, budget, services: serviceValue }, toISODate(today()), minCosts)
  // Ngân sách và dịch vụ phụ thuộc nhau (và số khách): sau lần bấm lưu đầu, kiểm lại ngay khi sửa một trong ba ô
  const live = tried ? validate() : {}
  const budgetError = tried ? live.budget : errors.budget
  const servicesError = tried ? live.services : errors.services
  // Còn ô báo đỏ thì làm mờ nút lưu để khách biết phải sửa trước, không nghĩ nút bị lỗi
  const blocked = Object.values({ ...errors, budget: budgetError, services: servicesError }).some(Boolean)

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    const guests = guestCount ? Number(guestCount) : null
    setErrors(errs)
    setTried(true)
    if (Object.keys(errs).length) return
    onSubmit({ groomName: groomName.trim(), brideName: brideName.trim(), date, ward, guestCount: guests, budget, ...(preset !== 'CUSTOM' && { budgetPreset: preset }), categorySlugs: serviceValue, ...(initial?.version && { version: initial.version }) })
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
          hint="Nhập số khách tối đa"
          className={FIELD}
        />
      </div>

      <WardField
        value={ward}
        onChange={(v) => {
          setWard(v)
          setErrors((x) => ({ ...x, ward: undefined }))
        }}
        error={errors.ward}
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
          invalid={!!servicesError}
        />
        {servicesError ? (
          <p role="alert" className="mt-1.5 text-[13px] text-destructive">
            {servicesError}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">Bỏ chọn dịch vụ thì các việc của dịch vụ đó tạm ẩn khỏi timeline.</p>
        )}
      </div>

      {/* Ngân sách sau dịch vụ (ước tiền khi đã biết cần gì), liền với mức chia (mô tả mức chia kể tên dịch vụ đã chọn) */}
      <BudgetField
        value={budget}
        onChange={(v) => {
          setBudget(v)
          setErrors((x) => ({ ...x, budget: undefined }))
        }}
        error={budgetError}
      />

      <BudgetPresetPicker value={preset} onChange={setBudgetPreset} options={presetOptions} />

      <FormError message={error} />

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line pt-3.5">
        {blocked && <span className="mr-auto text-xs text-muted-foreground">Sửa các ô báo đỏ để lưu</span>}
        {secondaryAction}
        <Button type="submit" disabled={pending || blocked} className="h-10 gap-2 px-5">
          {pending ? 'Đang lưu…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Ô nhập trong form này: cao hơn, bo tròn, nền trắng mờ để nổi trên ảnh nền hộp thiết lập */
const FIELD = 'h-10 rounded-xl border-line bg-surface/85 py-1.5 text-sm'

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
