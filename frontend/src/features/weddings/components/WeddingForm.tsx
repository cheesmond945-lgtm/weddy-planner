import { CalendarDays, List, Palette, UserRound, UsersRound, Wallet } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { FormError, FormField } from '@/components/FormField'
import { MoneyInput } from '@/components/MoneyInput'
import { MultiSelect } from '@/components/MultiSelect'
import { Button } from '@/components/ui/button'
import { useCategories } from '@/features/catalog/hooks'
import { addDays, toISODate, today } from '@/lib/date'
import type { Wedding, WeddingInput } from '@/types/wedding'
import { useStyles } from '../hooks'

interface WeddingFormProps {
  initial: Wedding | null
  submitLabel: ReactNode
  pending: boolean
  error?: string | null
  onSubmit: (input: WeddingInput) => void
  /** Nút bên trái hàng nút (Hủy, hoặc Đăng xuất ở hộp thiết lập lần đầu) */
  secondaryAction?: ReactNode
}

type Errors = Partial<Record<'date' | 'guestCount' | 'budget' | 'services', string>>

/** Form thông tin đám cưới (4.1), như wedForm trong prototype. */
export function WeddingForm({ initial, submitLabel, pending, error, onSubmit, secondaryAction }: WeddingFormProps) {
  const { data: categories = [] } = useCategories()
  const { data: styles = [] } = useStyles()
  const ids = { styles: useId(), services: useId() }

  const [groomName, setGroomName] = useState(initial?.groomName ?? '')
  const [brideName, setBrideName] = useState(initial?.brideName ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [guestCount, setGuestCount] = useState(initial?.guestCount ? String(initial.guestCount) : '')
  const [budget, setBudget] = useState(initial?.budget ?? 0)
  const [chosenStyles, setChosenStyles] = useState<string[]>(initial?.styles ?? [])
  // Lần đầu: mặc định chọn tất cả dịch vụ như prototype
  const [services, setServices] = useState<string[] | null>(initial?.categorySlugs ?? null)
  const serviceValue = services ?? categories.map((c) => c.slug)
  const [errors, setErrors] = useState<Errors>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Errors = {}
    const guests = guestCount ? Number(guestCount) : null
    if (!date) errs.date = 'Vui lòng chọn ngày tổ chức.'
    else if (date <= toISODate(today())) errs.date = 'Ngày tổ chức phải sau hôm nay.'
    if (!guestCount || !(guests! >= 1)) errs.guestCount = 'Vui lòng nhập số khách dự kiến (từ 1).'
    if (!(budget > 0)) errs.budget = 'Vui lòng nhập tổng ngân sách lớn hơn 0.'
    if (!serviceValue.length) errs.services = 'Vui lòng chọn ít nhất 1 dịch vụ'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSubmit({ groomName: groomName.trim(), brideName: brideName.trim(), date, guestCount: guests, budget, styles: chosenStyles, categorySlugs: serviceValue })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Tên cô dâu"
          icon={<UserRound />}
          maxLength={100}
          autoComplete="off"
          placeholder="Nhập tên cô dâu"
          value={brideName}
          onChange={(e) => setBrideName(e.target.value)}
          className={FIELD}
        />
        <FormField
          label="Tên chú rể"
          icon={<UserRound />}
          maxLength={100}
          autoComplete="off"
          placeholder="Nhập tên chú rể"
          value={groomName}
          onChange={(e) => setGroomName(e.target.value)}
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
          className={FIELD}
        />
      </div>

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
          Dịch vụ muốn sử dụng
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
          <p className="mt-1.5 truncate text-xs text-muted-foreground">Dịch vụ đã chọn sẽ được đưa vào timeline khung.</p>
        )}
      </div>

      <div>
        <span id={ids.styles} className="mb-1.5 block text-[13px] font-medium">
          Phong cách <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
        </span>
        <MultiSelect
          aria-labelledby={ids.styles}
          icon={<Palette />}
          options={styles.map((s) => ({ value: s, label: s }))}
          value={chosenStyles}
          onChange={setChosenStyles}
          placeholder="Chọn phong cách"
          maxChips={2}
        />
      </div>

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
