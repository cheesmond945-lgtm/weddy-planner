import { CalendarHeart, Info, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '@/api'
import { chatApi } from '@/api/chat'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { useRequireCouple } from '@/features/auth/useRequireCouple'
import { CHAT_MODE, chatPanel } from '@/features/chat/chatPanel'
import { useRefreshPlanning } from '@/features/weddings/hooks'
import { formatDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { DayStatus } from '@/types/availability'
import type { ServiceDetail, ServicePackage } from '@/types/catalog'
import { usePackageMonth, useWeddingDate } from '../hooks'
import { DISCLAIMER, availabilityRequestText, monthOf, shiftMonth, weekdayName } from '../status'
import { MonthCalendar, StatusBadge, StatusLegend } from './AvailabilityParts'

/**
 * "Lịch khả dụng" trong chi tiết một gói: khách nhập ngày (mặc định ngày cưới trong hồ sơ) để xem gói đã được đặt chưa,
 * lịch tháng 4 trạng thái (bấm ngày trên lịch cũng đổi ngày đang xem), đổi gói ngay tại đây thì lịch đổi theo gói,
 * nút liên hệ NCC kèm ngày và gói. Chỉ có trạng thái, không có thông tin booking.
 */
export function PackageAvailabilityPanel({ service, pkg, onSelect }: { service: ServiceDetail; pkg: ServicePackage; onSelect?: (p: ServicePackage) => void }) {
  const { date: weddingDate, guestCount } = useWeddingDate()
  const todayIso = toISODate(today())
  const thisMonth = monthOf(todayIso)
  const maxMonth = shiftMonth(thisMonth, 24)
  const [picked, setPicked] = useState<string | null>(null)
  const date = picked ?? (weddingDate && weddingDate >= todayIso ? weddingDate : null)
  const [month, setMonth] = useState(date ? monthOf(date) : thisMonth)
  const [contacting, setContacting] = useState(false)
  const cal = usePackageMonth(pkg.id, month)
  const dateMonth = usePackageMonth(pkg.id, date ? monthOf(date) : month)
  const statusByDate = new Map(cal.data?.days.map((d) => [d.date, d.status]))
  const dateStatus: DayStatus | null = date ? (dateMonth.data?.days.find((d) => d.date === date)?.status ?? null) : null
  const unavailable = cal.isError && cal.error instanceof ApiError && cal.error.status === 503

  function pick(d: string) {
    if (!d || d < todayIso || monthOf(d) > maxMonth) return
    setPicked(d)
    setMonth(monthOf(d))
  }

  return (
    <section aria-labelledby={`avail-${pkg.id}`} className="mt-5 rounded-lg border border-line bg-surface-2/50 p-4">
      <h3 id={`avail-${pkg.id}`} className="flex items-center gap-2 font-serif text-lg font-semibold">
        <CalendarHeart aria-hidden className="size-5 text-gold-700" />
        Kiểm tra lịch
      </h3>

      {service.packages.length > 1 && onSelect && (
        <div role="radiogroup" aria-label="Xem lịch của gói" className="mt-3 flex flex-wrap gap-1.5">
          {service.packages.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === pkg.id}
              onClick={() => p.id !== pkg.id && onSelect(p)}
              className={cn(
                'rounded-pill border px-3 py-1 text-[13px] font-medium transition-colors',
                p.id === pkg.id ? 'border-gold-700 bg-gold-100 text-gold-800' : 'border-line bg-surface text-ink-2 hover:border-gold-700 hover:text-ink',
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-[13px] font-medium">
          Ngày tổ chức
          <input
            type="date"
            min={todayIso}
            value={date ?? ''}
            onChange={(e) => pick(e.target.value)}
            className="mt-1 block h-10 rounded-sm border border-input bg-surface px-3 text-[15px] text-ink focus:border-ring focus:outline-2 focus:outline-ring"
          />
        </label>
        {weddingDate && date !== weddingDate && weddingDate >= todayIso && (
          <button type="button" onClick={() => pick(weddingDate)} className="mb-2.5 text-[13px] font-medium text-gold-700 underline underline-offset-[3px]">
            Dùng ngày cưới của bạn ({formatDate(weddingDate)})
          </button>
        )}
      </div>

      <div aria-live="polite" className="mt-2.5 min-h-6 text-sm">
        {date ? (
          <p className="flex flex-wrap items-center gap-2">
            {weekdayName(date)}, <b className="font-semibold">{formatDate(date)}</b>:
            {unavailable ? <span className="text-ink-2">chưa xem được lịch</span> : dateStatus ? <StatusBadge status={dateStatus} /> : <span className="text-ink-2">đang kiểm tra…</span>}
            {dateStatus && <span className="text-ink-2">{DATE_HINT[dateStatus]}</span>}
          </p>
        ) : (
          <p className="text-ink-2">Chọn ngày tổ chức để xem gói này đã được đặt chưa.</p>
        )}
      </div>

      <div className="mt-3">
        {unavailable ? (
          <p className="rounded-md bg-muted px-3 py-2.5 text-sm text-ink-2">Lịch khả dụng chưa sẵn sàng. Bạn vẫn có thể liên hệ nhà cung cấp để hỏi lịch.</p>
        ) : cal.isError ? (
          <p className="rounded-md bg-muted px-3 py-2.5 text-sm text-ink-2">Chưa tải được lịch. {cal.error.message}</p>
        ) : (
          <MonthCalendar
            month={month}
            onMonth={setMonth}
            statusOf={(d) => statusByDate.get(d)}
            markDate={weddingDate}
            minMonth={thisMonth}
            maxMonth={maxMonth}
            loading={cal.isPending}
            selected={date ? new Set([date]) : undefined}
            onToggle={pick}
          />
        )}
      </div>
      {!unavailable && <StatusLegend className="mt-3" />}

      <p className="mt-3 flex items-start gap-2 text-[13px] text-ink-2">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
        {DISCLAIMER}
      </p>
      <Button className="mt-3 w-full" onClick={() => setContacting(true)}>
        <MessageCircle />
        Liên hệ nhà cung cấp
      </Button>

      <ContactVendorDialog
        key={`${pkg.id}-${date}`}
        open={contacting}
        onOpenChange={setContacting}
        service={service}
        pkg={pkg}
        defaultText={availabilityRequestText({ vendorName: service.name, packageName: pkg.name, date, status: dateStatus, guestCount })}
      />
    </section>
  )
}

/** Giải thích ngắn cạnh trạng thái của ngày đang xem. */
const DATE_HINT: Record<DayStatus, string> = {
  AVAILABLE: 'gói này chưa có ai đặt ngày này.',
  HELD: 'đang có yêu cầu giữ chỗ, có thể sớm kín.',
  BOOKED: 'gói này đã được đặt ngày này.',
  UNKNOWN: 'nhà cung cấp chưa cập nhật lịch, hãy liên hệ để hỏi.',
}

/**
 * Gửi yêu cầu xác nhận lịch: tin soạn sẵn (sửa được) gồm ngày tổ chức và gói đang xem, gửi vào hội thoại với NCC rồi mở khung chat.
 * Mở hội thoại cũng thêm NCC vào kế hoạch như nút "Nhắn tin với NCC"; hạng mục đã có NCC khác thì hỏi trước khi thay.
 */
function ContactVendorDialog({ open, onOpenChange, service, pkg, defaultText }: { open: boolean; onOpenChange: (o: boolean) => void; service: ServiceDetail; pkg: ServicePackage; defaultText: string }) {
  const requireCouple = useRequireCouple()
  const refresh = useRefreshPlanning()
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [taken, setTaken] = useState<string | null>(null)
  const message = text ?? defaultText

  function close(o: boolean) {
    if (busy) return
    onOpenChange(o)
    if (!o) {
      setText(null)
      setTaken(null)
    }
  }

  async function send(replace: boolean) {
    if (!message.trim()) return toast('Nhập nội dung yêu cầu.')
    if (CHAT_MODE === 'zalo' && service.contactPhone) {
      void navigator.clipboard?.writeText(message).then(() => toast('Đã chép yêu cầu, dán vào Zalo để gửi'), () => undefined)
      window.open(`https://zalo.me/${encodeURIComponent(service.contactPhone.replace(/\D/g, '').replace(/^0/, '84'))}`, '_blank', 'noopener,noreferrer')
      return close(false)
    }
    setBusy(true)
    try {
      const conv = await chatApi.start(service.id, replace)
      await chatApi.send(conv.id, message.trim())
      void refresh()
      toast('Đã gửi yêu cầu xác nhận lịch cho nhà cung cấp')
      setBusy(false)
      close(false)
      chatPanel.open({ conversation: conv, draft: '', packageName: pkg.name, workingHours: service.workingHours })
    } catch (e) {
      setBusy(false)
      if (e instanceof ApiError && e.code === 'PLAN_CATEGORY_TAKEN') setTaken((e.details as { existingServiceName?: string })?.existingServiceName ?? 'một dịch vụ khác')
      else toast((e as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liên hệ nhà cung cấp</DialogTitle>
          <DialogDescription>Gửi yêu cầu để {service.name} xác nhận lịch gói {pkg.name}. Bạn có thể sửa nội dung trước khi gửi.</DialogDescription>
        </DialogHeader>
        <label className="text-[13px] font-medium">
          Nội dung yêu cầu
          <textarea
            value={message}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={1000}
            className="mt-1.5 block w-full resize-y rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-ink focus:border-ring focus:outline-2 focus:outline-ring"
          />
        </label>
        <p className="mt-2 flex items-start gap-2 text-[13px] text-ink-2">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
          {DISCLAIMER}
        </p>
        {taken && (
          <p role="alert" className="mt-3 rounded-md bg-warn-soft px-3 py-2.5 text-sm text-warn">
            Kế hoạch đang có <b>{taken}</b> cho hạng mục này. Gửi yêu cầu sẽ thay bằng <b>{service.name}</b> trong kế hoạch.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => close(false)}>
            Hủy
          </Button>
          <Button disabled={busy} onClick={() => requireCouple(() => send(!!taken))}>
            {busy ? 'Đang gửi…' : taken ? 'Thay và gửi yêu cầu' : 'Gửi yêu cầu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
