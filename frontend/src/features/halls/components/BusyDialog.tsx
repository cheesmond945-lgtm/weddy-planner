import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PanelDialog } from '@/features/vendorOrders/components/PanelDialog'
import { controlClass, Field } from '@/features/vendors/components/FormParts'
import { toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { HallRef } from '@/types/hall'
import { useAddBusy } from '../hooks'

const REASON_MAX = 255

interface BusyDialogProps {
  halls: HallRef[]
  /** Ngày và sảnh điền sẵn (ngày đang chọn trên lịch, sảnh đang lọc) */
  initial: { date: string; packageId: string | null }
  onClose: () => void
}

/**
 * NCC đánh dấu sảnh bận thủ công (bảo trì, nghỉ, lý do riêng…): một hoặc nhiều sảnh, một ngày hoặc từ ngày đến ngày, lý do bắt buộc.
 * Khách thấy những ngày này là "bận" trên lịch của sảnh, không thấy lý do. Gỡ ở danh sách của ngày trên Lịch bận.
 */
export function BusyDialog({ halls, initial, onClose }: BusyDialogProps) {
  const add = useAddBusy()
  const now = toISODate(today())
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(initial.packageId ? [initial.packageId] : halls.length === 1 ? [halls[0].id] : []))
  const [start, setStart] = useState(initial.date >= now ? initial.date : now)
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [checked, setChecked] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  const local: Record<string, string> = {}
  if (!picked.size) local.packageIds = 'Chọn ít nhất một sảnh.'
  if (!start) local.startDate = 'Chọn ngày bắt đầu.'
  else if (start < now) local.startDate = 'Không đánh dấu bận ngày đã qua.'
  if (end && start && end < start) local.endDate = 'Ngày kết thúc không trước ngày bắt đầu.'
  if (!reason.trim()) local.reason = 'Ghi lý do bận (bảo trì, nghỉ, lý do riêng…).'
  const errors = checked ? { ...serverErrors, ...local } : serverErrors
  const all = halls.length > 0 && picked.size === halls.length

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function submit() {
    setChecked(true)
    setFormError('')
    setServerErrors({})
    if (Object.keys(local).length) return
    add.mutate(
      { packageIds: [...picked], startDate: start, endDate: end || undefined, reason: reason.trim() },
      {
        onSuccess: onClose,
        onError: (e) => {
          if (e instanceof ApiError && e.details && typeof e.details === 'object') setServerErrors(e.details as Record<string, string>)
          setFormError(e.message || 'Không lưu được ngày bận, vui lòng thử lại.')
        },
      },
    )
  }

  return (
    <PanelDialog
      open
      size="md"
      onRequestClose={() => !add.isPending && onClose()}
      title="Đánh dấu sảnh bận"
      subtitle="Khách thấy những ngày này là bận trên lịch của sảnh (không thấy lý do) và không đặt cọc được."
      footer={
        <>
          {formError && (
            <p role="alert" className="mr-auto text-[13px] text-destructive">
              {formError}
            </p>
          )}
          <Button type="button" variant="ghost" onClick={onClose} disabled={add.isPending}>
            Hủy
          </Button>
          <Button type="button" onClick={submit} disabled={add.isPending}>
            {add.isPending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Đang lưu…
              </>
            ) : (
              'Đánh dấu bận'
            )}
          </Button>
        </>
      }
    >
      <fieldset disabled={add.isPending} className="grid min-w-0 gap-4">
        <Field label="Sảnh *" error={errors.packageIds} group>
          <div className="flex flex-wrap gap-2">
            {halls.length > 1 && (
              <label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-pill border px-3 py-1.5 text-[13px] font-medium', all ? 'border-ink bg-ink text-bg' : 'border-line bg-surface')}>
                <input type="checkbox" className="sr-only" checked={all} onChange={() => setPicked(all ? new Set() : new Set(halls.map((h) => h.id)))} />
                Tất cả sảnh
              </label>
            )}
            {halls.map((h) => {
              const on = picked.has(h.id)
              return (
                <label key={h.id} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-pill border px-3 py-1.5 text-[13px] font-medium', on ? 'border-ink bg-ink text-bg' : 'border-line bg-surface')}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(h.id)} />
                  {h.name}
                  {h.hidden && <span className={cn('text-[11.5px]', on ? 'opacity-80' : 'text-muted-foreground')}>(đang ẩn)</span>}
                </label>
              )
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Từ ngày *" error={errors.startDate}>
            <Input className={controlClass} type="date" min={now} aria-invalid={errors.startDate ? true : undefined} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Đến ngày" error={errors.endDate} hint="Bỏ trống nếu chỉ bận một ngày.">
            <Input className={controlClass} type="date" min={start || now} aria-invalid={errors.endDate ? true : undefined} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Lý do *" error={errors.reason} hint="Chỉ bạn thấy lý do; khách chỉ thấy sảnh bận.">
          <Input
            className={controlClass}
            maxLength={REASON_MAX}
            placeholder="VD: Bảo trì sảnh, nghỉ Tết, sự kiện riêng"
            aria-invalid={errors.reason ? true : undefined}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </fieldset>
    </PanelDialog>
  )
}
