import { AlertTriangle, BellRing, CalendarCheck2, X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { formatDate, formatRelativeTime, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { DayStatus } from '@/types/availability'
import { useAvailabilityMutations, useAvailabilityReminder, useVendorMonth } from '../hooks'
import { DAY_STATUSES, STATUS_VIEW, monthOf, shiftMonth } from '../status'
import { MonthCalendar, StatusLegend } from './AvailabilityParts'

/**
 * Lịch khả dụng của một gói (trang gói phía NCC): khai sảnh / nguồn lực dùng chung, chọn ngày trên lịch rồi
 * đặt Còn trống / Giữ chỗ / Đã kín / Chưa cập nhật. Gói cùng sảnh đang kín hoặc giữ chỗ thì ô hiện ghi chú và khách thấy theo gói đó.
 */
export function VendorAvailabilityManager({ packageId, packageName }: { packageId: string; packageName: string }) {
  const thisMonth = monthOf(toISODate(today()))
  const [month, setMonth] = useState(thisMonth)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const cal = useVendorMonth(packageId, month)
  const { setDays } = useAvailabilityMutations(packageId)
  const data = cal.data
  const byDate = new Map(data?.days.map((d) => [d.date, d]))

  if (cal.isError) {
    const pending = cal.error instanceof ApiError && cal.error.status === 503
    return (
      <Shell>
        <p className="text-sm text-ink-2">{pending ? 'Lịch khả dụng chưa sẵn sàng: cần chạy file SQL lịch khả dụng lên cơ sở dữ liệu.' : cal.error.message}</p>
      </Shell>
    )
  }

  const toggle = (d: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(d)) n.delete(d)
      else n.add(d)
      return n
    })

  const futureUnknown = (data?.days ?? []).filter((d) => d.own === 'UNKNOWN' && d.date >= (data?.today ?? '')).map((d) => d.date)

  function apply(status: DayStatus, dates = [...selected]) {
    if (!dates.length) return toast('Chọn ít nhất một ngày trên lịch.')
    setDays.mutate(
      { dates, status },
      {
        onSuccess: (r) => {
          setSelected(new Set())
          toast(`Đã cập nhật ${r.updated} ngày: ${STATUS_VIEW[status].label}`)
          if (r.conflicts.length) {
            const c = r.conflicts[0]
            toast(`${r.conflicts.length} ngày trùng lịch sảnh với gói ${c.packageName} (ví dụ ${formatDate(c.date)}: ${STATUS_VIEW[c.status].label}). Khách sẽ thấy theo gói đó.`)
          } else if (r.sharedWith.length) {
            toast(`Các gói cùng sảnh (${r.sharedWith.join(', ')}) cũng hiện ${STATUS_VIEW[status].label} các ngày này.`)
          }
        },
        onError: (e) => toast(e.message),
      },
    )
  }

  return (
    <Shell lastUpdated={data?.lastUpdated}>
      <ResourceField packageId={packageId} resource={data?.resource ?? null} sharedWith={data?.sharedWith ?? []} loading={cal.isPending} />

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <MonthCalendar
            month={month}
            onMonth={(m) => (setMonth(m), setSelected(new Set()))}
            statusOf={(d) => byDate.get(d)?.status}
            noteOf={(d) => {
              const x = byDate.get(d)
              return x?.blockedBy ? `${STATUS_VIEW[x.status].short}: ${x.blockedBy}` : null
            }}
            minMonth={thisMonth}
            maxMonth={shiftMonth(thisMonth, 24)}
            loading={cal.isPending}
            selected={selected}
            onToggle={toggle}
          />
          <StatusLegend className="mt-3" />
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-sm text-ink-2">
            {selected.size ? (
              <>
                Đã chọn <b className="text-ink">{selected.size} ngày</b>. Đặt trạng thái cho {packageName}:
              </>
            ) : (
              'Bấm các ngày trên lịch để chọn, rồi đặt trạng thái.'
            )}
          </p>
          {DAY_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!selected.size || setDays.isPending}
              onClick={() => apply(s)}
              className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold ring-1 ring-inset transition-[filter] hover:brightness-95 disabled:opacity-50', STATUS_VIEW[s].chip)}
            >
              <span aria-hidden className={cn('size-2.5 rounded-full', STATUS_VIEW[s].dot)} />
              {s === 'UNKNOWN' ? 'Xóa (Chưa cập nhật)' : STATUS_VIEW[s].label}
            </button>
          ))}
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setSelected(new Set())}>
              <X />
              Bỏ chọn
            </Button>
          )}
          <Button variant="outline" size="sm" className="mt-1" disabled={!futureUnknown.length || setDays.isPending} onClick={() => apply('AVAILABLE', futureUnknown)}>
            <CalendarCheck2 />
            Đặt {futureUnknown.length} ngày chưa cập nhật thành Còn trống
          </Button>
          <p className="text-xs text-ink-2">Khách chỉ thấy trạng thái từng ngày, không thấy tên khách hay thông tin đơn.</p>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, lastUpdated }: { children: ReactNode; lastUpdated?: string | null }) {
  return (
    <section aria-labelledby="vendor-availability" className="mt-5 rounded-md border border-line bg-surface p-5 shadow-portal">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="vendor-availability" className="text-lg">
          Lịch khả dụng
        </h2>
        {lastUpdated !== undefined && (
          <span className="text-xs text-ink-2">{lastUpdated ? `Cập nhật lần cuối ${formatRelativeTime(lastUpdated) ?? ''}` : 'Gói này chưa cập nhật lịch'}</span>
        )}
      </div>
      {children}
    </section>
  )
}

/** Sảnh / nguồn lực dùng chung: gói cùng tên sảnh không thể cùng còn trống một ngày. */
function ResourceField({ packageId, resource, sharedWith, loading }: { packageId: string; resource: string | null; sharedWith: string[]; loading: boolean }) {
  const { setResource } = useAvailabilityMutations(packageId)
  const [value, setValue] = useState<string | null>(null)
  const shown = value ?? resource ?? ''

  function submit(e: FormEvent) {
    e.preventDefault()
    setResource.mutate(shown.trim() || null, {
      onSuccess: (r) => {
        setValue(null)
        toast(r.resource ? `Đã lưu sảnh "${r.resource}"${r.sharedWith.length ? `, dùng chung với ${r.sharedWith.join(', ')}` : ''}` : 'Gói này dùng lịch riêng')
      },
      onError: (err) => toast(err.message),
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label htmlFor={`res-${packageId}`} className="text-[13px] font-medium">
        Sảnh / nguồn lực tổ chức
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`res-${packageId}`}
          maxLength={100}
          placeholder="Ví dụ: Sảnh Hoa Sen"
          value={shown}
          disabled={loading}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-[320px] flex-1 px-2.5 py-1.5 text-sm"
        />
        <Button type="submit" variant="outline" size="sm" disabled={loading || setResource.isPending || shown.trim() === (resource ?? '')}>
          Lưu sảnh
        </Button>
      </div>
      <p className="text-xs text-ink-2">
        {sharedWith.length
          ? `Dùng chung sảnh với: ${sharedWith.join(', ')}. Một gói kín hoặc giữ chỗ thì các gói này cũng không hiện còn trống ngày đó.`
          : 'Các gói cùng tên sảnh dùng chung lịch, tránh hiện nhiều gói cùng còn trống khi sảnh chỉ nhận được một tiệc.'}
      </p>
    </form>
  )
}

/** Banner nhắc cập nhật lịch (trang Quản lý dịch vụ của NCC). */
export function AvailabilityReminderBanner() {
  const { data } = useAvailabilityReminder()
  const [hidden, setHidden] = useState(false)
  if (hidden || !data?.applicable || !data.needsUpdate) return null
  const stale = data.daysSinceUpdate === null ? 'Bạn chưa cập nhật lịch khả dụng cho các gói.' : data.daysSinceUpdate >= 7 ? `Lịch khả dụng đã ${data.daysSinceUpdate} ngày chưa cập nhật.` : null
  const missing = data.missingDays ? `${data.missingDays}/${data.windowDays} ngày tới còn gói chưa có trạng thái.` : null
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-warn bg-warn-soft px-4 py-3 text-sm text-warn">
      {stale ? <BellRing className="size-[18px] shrink-0" aria-hidden /> : <AlertTriangle className="size-[18px] shrink-0" aria-hidden />}
      <span className="flex-1">
        {[stale, missing].filter(Boolean).join(' ')} Mở từng gói ở danh sách bên dưới để cập nhật, khách đang xem trạng thái theo ngày cưới của họ.
      </span>
      <button type="button" aria-label="Ẩn nhắc nhở" onClick={() => setHidden(true)} className="grid size-7 place-items-center rounded-full hover:bg-white/50">
        <X className="size-4" />
      </button>
    </div>
  )
}
