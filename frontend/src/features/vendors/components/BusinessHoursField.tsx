import { WEEKDAYS, type Weekday } from '@/types/vendor'
import { HALF_HOURS, WEEKDAY_LABEL } from '../constants'
import type { ProfileFormValues } from '../profileForm'
import { controlClass, Field } from './FormParts'

type Hours = ProfileFormValues['hours']

/** "Thứ 2 – Chủ nhật · 09:00 – 21:00"; chưa chọn đủ thì rỗng. */
function summary({ fromDay, toDay, openTime, closeTime }: Hours) {
  if (!fromDay || !toDay || !openTime || !closeTime) return ''
  const days = fromDay === toDay ? WEEKDAY_LABEL[fromDay] : `${WEEKDAY_LABEL[fromDay]} – ${WEEKDAY_LABEL[toDay]}`
  return `${days} · ${openTime} – ${closeTime}`
}

interface BusinessHoursFieldProps {
  value: Hours
  onChange: (value: Hours) => void
  error?: string
}

/** Giờ hoạt động: một khung giờ chung, tùy chọn (như prototype NCC). */
export function BusinessHoursField({ value, onChange, error }: BusinessHoursFieldProps) {
  const text = summary(value)
  const set = (patch: Partial<Hours>) => onChange({ ...value, ...patch })
  const select = `${controlClass} ${error ? 'border-destructive' : ''}`

  return (
    <fieldset className="mt-[18px] grid min-w-0 gap-2">
      <legend className="mb-2 text-[13px] font-medium">
        Giờ hoạt động <span className="font-normal text-muted-foreground">Tùy chọn</span>
      </legend>
      <div className="grid max-w-[760px] grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        <Field label="Từ ngày">
          <select className={select} value={value.fromDay} onChange={(e) => set({ fromDay: e.target.value as Weekday | '' })}>
            <option value="">Chọn</option>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Đến ngày">
          <select className={select} value={value.toDay} onChange={(e) => set({ toDay: e.target.value as Weekday | '' })}>
            <option value="">Chọn</option>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Giờ mở cửa">
          <select className={select} value={value.openTime} onChange={(e) => set({ openTime: e.target.value })}>
            <option value="">--:--</option>
            {HALF_HOURS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Giờ đóng cửa">
          <select className={select} value={value.closeTime} onChange={(e) => set({ closeTime: e.target.value })}>
            <option value="">--:--</option>
            {HALF_HOURS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      {error ? (
        <span role="alert" data-field-error className="text-[13px] text-destructive">
          {error}
        </span>
      ) : (
        text && <span className="justify-self-start rounded-pill bg-gold-soft px-2.5 py-1 text-[13px] font-medium text-gold-ink">{text}</span>
      )}
    </fieldset>
  )
}
