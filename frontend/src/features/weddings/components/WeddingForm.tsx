import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { FormError, FormField } from '@/components/FormField'
import { MoneyInput } from '@/components/MoneyInput'
import { MultiSelect } from '@/components/MultiSelect'
import { Button } from '@/components/ui/button'
import { useCategories, useLocations } from '@/features/catalog/hooks'
import { addDays, toISODate, today } from '@/lib/date'
import type { Wedding, WeddingInput } from '@/types/wedding'
import { useStyles } from '../hooks'

interface WeddingFormProps {
  initial: Wedding | null
  submitLabel: string
  pending: boolean
  error?: string | null
  onSubmit: (input: WeddingInput) => void
  /** Nút bên trái hàng nút (Hủy, hoặc Đăng xuất ở hộp thiết lập lần đầu) */
  secondaryAction?: ReactNode
}

type Errors = Partial<Record<'date' | 'location' | 'guestCount' | 'budget', string>>

const styleSummary = (a: string[]) => (!a.length ? 'Chọn một hoặc nhiều phong cách' : a.length <= 2 ? a.join(', ') : `${a.length} phong cách đã chọn`)

/** Form thông tin đám cưới (4.1), như wedForm trong prototype. */
export function WeddingForm({ initial, submitLabel, pending, error, onSubmit, secondaryAction }: WeddingFormProps) {
  const { data: categories = [] } = useCategories()
  const { data: locations = [] } = useLocations()
  const { data: styles = [] } = useStyles()
  const ids = { loc: useId(), styles: useId(), services: useId() }

  const [date, setDate] = useState(initial?.date ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [guestCount, setGuestCount] = useState(initial?.guestCount ? String(initial.guestCount) : '')
  const [budget, setBudget] = useState(initial?.budget ?? 0)
  const [chosenStyles, setChosenStyles] = useState<string[]>(initial?.styles ?? [])
  // Lần đầu: mặc định chọn tất cả dịch vụ như prototype
  const [services, setServices] = useState<string[] | null>(initial?.categorySlugs ?? null)
  const serviceValue = services ?? categories.map((c) => c.slug)
  const [errors, setErrors] = useState<Errors>({})

  const total = categories.length
  const serviceSummary = (a: string[]) => (!a.length ? 'Chọn dịch vụ bạn dự định cần' : a.length === total ? `Tất cả dịch vụ (${a.length}/${total})` : `Đã chọn ${a.length}/${total} dịch vụ`)

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs: Errors = {}
    const guests = guestCount ? Number(guestCount) : null
    if (!date) errs.date = 'Vui lòng chọn ngày tổ chức.'
    else if (date <= toISODate(today())) errs.date = 'Ngày tổ chức phải sau hôm nay.'
    if (!location) errs.location = 'Vui lòng chọn địa điểm tổ chức.'
    if (!guestCount || !(guests! >= 1)) errs.guestCount = 'Vui lòng nhập số khách dự kiến (từ 1).'
    if (!(budget > 0)) errs.budget = 'Vui lòng nhập tổng ngân sách lớn hơn 0.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSubmit({ date, location, guestCount: guests, budget, styles: chosenStyles, categorySlugs: serviceValue })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FormField
          label="Ngày tổ chức"
          type="date"
          min={toISODate(addDays(today(), 1))}
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setErrors((x) => ({ ...x, date: undefined }))
          }}
          error={errors.date}
        />
        <div>
          <label htmlFor={ids.loc} className="mb-1.5 block text-[13px] font-medium">
            Địa điểm tổ chức
          </label>
          <select
            id={ids.loc}
            value={location}
            aria-invalid={errors.location ? true : undefined}
            onChange={(e) => {
              setLocation(e.target.value)
              setErrors((x) => ({ ...x, location: undefined }))
            }}
            className="w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring aria-invalid:border-destructive"
          >
            <option value="">Chọn khu vực</option>
            {locations.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          {errors.location && <p className="mt-1.5 text-[13px] text-destructive">{errors.location}</p>}
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <FormField
          label="Sức chứa dự kiến (khách) *"
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="Ví dụ 250"
          value={guestCount}
          onChange={(e) => {
            setGuestCount(e.target.value)
            setErrors((x) => ({ ...x, guestCount: undefined }))
          }}
          error={errors.guestCount}
        />
        <BudgetField
          value={budget}
          onChange={(v) => {
            setBudget(v)
            setErrors((x) => ({ ...x, budget: undefined }))
          }}
          error={errors.budget}
        />
      </div>

      <div>
        <span id={ids.styles} className="mb-1.5 block text-[13px] font-medium">
          Phong cách mong muốn <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
        </span>
        <MultiSelect aria-labelledby={ids.styles} options={styles.map((s) => ({ value: s, label: s }))} value={chosenStyles} onChange={setChosenStyles} summary={styleSummary} />
        <p className="mt-1.5 text-[13px] text-muted-foreground">Dùng để gợi ý nhà cung cấp phù hợp; bạn có thể thay đổi sau.</p>
      </div>

      <div>
        <span id={ids.services} className="mb-1.5 block text-[13px] font-medium">
          Dịch vụ muốn sử dụng
        </span>
        <MultiSelect
          aria-labelledby={ids.services}
          options={categories.map((c) => ({ value: c.slug, label: c.name }))}
          value={serviceValue}
          onChange={setServices}
          summary={serviceSummary}
          selectAll
        />
        <p className="mt-1.5 text-[13px] text-muted-foreground">Dịch vụ đã chọn sẽ được đưa vào timeline khung. Bạn có thể bổ sung sau.</p>
      </div>

      <FormError message={error} />

      <div className="mt-1 flex flex-wrap items-center justify-end gap-2.5">
        {secondaryAction}
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function BudgetField({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        Tổng ngân sách (đồng)
      </label>
      <MoneyInput id={id} placeholder="Ví dụ 300.000.000" value={value} onChange={onChange} aria-invalid={error ? true : undefined} />
      {error && <p className="mt-1.5 text-[13px] text-destructive">{error}</p>}
    </div>
  )
}
