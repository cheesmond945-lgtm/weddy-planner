import { Clock } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { controlClass } from '@/features/vendors/components/FormParts'
import { TimeCombobox } from '@/features/vendors/components/TimeCombobox'
import { durationSteps, durationText, minusMinutes } from '@/lib/dayTime'
import type { PackageDayPlan } from '@/types/vendorPackage'
import { useSavePackageDayPlan } from '../hooks'

const card = 'mb-5 rounded-md border border-line bg-surface px-7 pt-[22px] pb-5 shadow-portal max-sm:px-4 max-sm:pt-4 max-sm:pb-4'
const LEAD_STEPS = durationSteps(0, 12 * 60)
const DURATION_STEPS = durationSteps(30, 16 * 60)
const EXAMPLE_MAIN = '11:00'

/** Ô chọn thời lượng: "Mặc định (x)" hoặc một mốc 30 phút; giá trị khai cũ không nằm trên mốc vẫn giữ trong danh sách. */
function DurationSelect({ id, value, steps, fallback, onChange }: { id: string; value: number | null; steps: number[]; fallback: number; onChange: (v: number | null) => void }) {
  const options = value !== null && !steps.includes(value) ? [...steps, value].sort((a, b) => a - b) : steps
  return (
    <select id={id} className={controlClass} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
      <option value="">Mặc định theo lĩnh vực ({durationText(fallback)})</option>
      {options.map((m) => (
        <option key={m} value={m}>
          {durationText(m)}
        </option>
      ))}
    </select>
  )
}

/**
 * "Thời gian trong ngày cưới" của gói (docs/LICH_TRINH_NGAY_CUOI.md): có mặt trước giờ chính của khách bao lâu, làm trong bao lâu;
 * gói sảnh khai thêm giờ cho đơn vị khác vào setup. Lưu riêng, không qua Admin duyệt (như công việc của gói).
 * Hệ thống dùng để xếp giờ có mặt dự kiến trong lịch trình ngày cưới; NCC vẫn chốt giờ riêng cho từng đơn.
 */
export function PackageDayPlanCard({ packageId, plan }: { packageId: string; plan: PackageDayPlan }) {
  const ids = { lead: useId(), duration: useId() }
  const save = useSavePackageDayPlan(packageId)
  const [lead, setLead] = useState(plan.leadMinutes)
  const [duration, setDuration] = useState(plan.durationMinutes)
  const [open, setOpen] = useState(plan.setupOpenTime ?? '')
  const [error, setError] = useState<string | undefined>()
  const dirty = lead !== plan.leadMinutes || duration !== plan.durationMinutes || (plan.isVenue && (open || null) !== plan.setupOpenTime)

  const effLead = lead ?? plan.defaults.leadMinutes
  const effDuration = duration ?? plan.defaults.durationMinutes
  const arrive = minusMinutes(EXAMPLE_MAIN, effLead)
  const done = minusMinutes(EXAMPLE_MAIN, effLead - effDuration)

  // Không dùng <form>: tab Công việc nằm trong form của trang gói (form lồng nhau sẽ gửi luôn form gói)
  function submit() {
    if (plan.isVenue && open.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(open.trim())) {
      setError('Nhập giờ dạng HH:mm, ví dụ 05:00.')
      return
    }
    save.mutate({ leadMinutes: lead, durationMinutes: duration, setupOpenTime: plan.isVenue ? open.trim() || null : null })
  }

  return (
    <section className={card} aria-labelledby={`${ids.lead}-title`}>
      <h2 id={`${ids.lead}-title`} className="mb-1 flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
        <Clock className="size-4 text-gold-ink" aria-hidden />
        Thời gian trong ngày cưới
      </h2>
      <p className="mb-4 text-[13px] text-muted-foreground">
        Dùng để xếp giờ có mặt dự kiến cho đơn của gói này theo giờ đón khách của từng cặp đôi. Lưu ngay, không cần Admin duyệt; giờ của từng đơn bạn vẫn chốt riêng trong chi tiết đơn.
      </p>
      <div className="grid items-start gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.lead} className="mb-1.5 block text-[13px] font-medium">
            Có mặt trước giờ đón khách
          </label>
          <DurationSelect id={ids.lead} value={lead} steps={LEAD_STEPS} fallback={plan.defaults.leadMinutes} onChange={setLead} />
        </div>
        <div>
          <label htmlFor={ids.duration} className="mb-1.5 block text-[13px] font-medium">
            Làm trong
          </label>
          <DurationSelect id={ids.duration} value={duration} steps={DURATION_STEPS} fallback={plan.defaults.durationMinutes} onChange={setDuration} />
        </div>
        {plan.isVenue && (
          <div>
            <TimeCombobox
              label="Cho đơn vị khác (trang trí, hoa…) vào sảnh setup từ"
              placeholder="Mặc định 06:00"
              value={open}
              onChange={(v) => {
                setOpen(v)
                setError(undefined)
              }}
              error={error}
            />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">Hôm trước sảnh có tiệc khác thì các đơn vị không vào sớm hơn giờ này được; hệ thống cảnh báo nếu thiếu giờ.</p>
          </div>
        )}
      </div>
      <p className="mt-4 rounded-md bg-surface-2 px-3.5 py-2.5 text-[13px]">
        Ví dụ cặp đôi đón khách {EXAMPLE_MAIN}: bạn có mặt <b>{arrive}</b>, xong khoảng <b>{done}</b>.
      </p>
      <div className="mt-4 flex justify-end">
        <Button type="button" disabled={!dirty || save.isPending} onClick={submit}>
          {save.isPending ? 'Đang lưu…' : 'Lưu thời gian'}
        </Button>
      </div>
    </section>
  )
}
