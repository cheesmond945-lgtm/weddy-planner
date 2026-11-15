import { useQueries, useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Minus, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { hallsApi } from '@/api/halls'
import { ordersApi } from '@/api/orders'
import { DateField } from '@/components/DateField'
import { FormError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatUnitPrice } from '@/features/catalog/price'
import { useService } from '@/features/catalog/hooks'
import { CHANGE_LABEL } from '@/features/vendorOrders/constants'
import { RESTAURANT_SLUG } from '@/features/vendors/constants'
import { addDaysYmd, todayVN } from '@/lib/clock'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { REVISION_CHANGE_TYPES, type RevisionChangeType } from '@/types/vendorOrder'
import type { ServicePackage } from '@/types/catalog'
import type { Order } from '@/types/order'
import { useRequestRevision } from '../hooks'
import { useWedding } from '@/features/weddings/hooks'
import { GUESTS_PER_TABLE, estimateTotal, hallOption, sortHalls, tableRange, venueChanges, venueNote, venueNotices, type HallLike, type VenueCurrent, type VenueWanted } from '../venueChange'

/**
 * Yêu cầu chỉnh sửa đơn: 4 ô chọn tùy chọn, nội dung chi tiết bắt buộc (docs/THE_DON_PHIA_KHACH.md mục 3.2).
 * Chờ thanh toán cọc: đơn chuyển Chờ chỉnh sửa. Đã đặt cọc (trước ngày thực hiện): đơn vẫn Đã đặt cọc, tiền cọc giữ nguyên.
 */
export function ReviseOrderDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{order ? `Yêu cầu chỉnh sửa đơn ${order.orderCode}` : 'Yêu cầu chỉnh sửa đơn'}</DialogTitle>
          <DialogDescription className="sr-only">Gửi yêu cầu chỉnh sửa đơn cho nhà cung cấp qua chat.</DialogDescription>
        </DialogHeader>
        {order && <ReviseForm order={order} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ReviseForm({ order, onClose }: { order: Order; onClose: () => void }) {
  const [changes, setChanges] = useState<RevisionChangeType[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  // Đổi hạng mục: gói khách muốn đổi sang (chọn từ danh sách gói của NCC)
  const [packageId, setPackageId] = useState<string | null>(null)
  const revise = useRequestRevision()
  const service = useService(order.serviceId ?? '')
  // Đơn đã cọc: hỏi backend còn cho đổi gói không (NCC đã xong từ 50% việc của gói, hoặc còn dưới 7 ngày tới ngày thực hiện thì khóa)
  const lockQuery = useQuery({ queryKey: ['orders', order.id, 'package-change-lock'], queryFn: () => ordersApi.packageChangeLock(order.id), enabled: order.status === 'Deposited', staleTime: 30_000 })
  const itemLock = lockQuery.data?.lock ?? null
  const changingItem = changes.includes('Item') && !itemLock
  const target = changingItem ? service.data?.packages.find((p) => p.id === packageId) : undefined

  // Đổi số bàn chỉ với trung tâm tiệc cưới (đặt theo bàn); dịch vụ trọn gói không có lựa chọn này
  const byTable = order.category?.slug === RESTAURANT_SLUG || !!order.package || order.items.some((i) => i.unit === 'Bàn')
  const options = REVISION_CHANGE_TYPES.filter((c) => c !== 'Quantity' || byTable)

  const toggle = (c: RevisionChangeType) => setChanges((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  // Đơn tiệc cưới (có sảnh): sảnh, ngày và số bàn ràng buộc nhau nên sửa chung một khối thay cho 3 ô tick (venueChange.ts)
  const isVenue = !!order.package && order.items.some((i) => i.packageId === order.package!.id || i.unit === 'Bàn')
  if (isVenue) return <VenueReviseForm order={order} itemLock={itemLock} onClose={onClose} />

  function submit(e: FormEvent) {
    e.preventDefault()
    // Chọn gói rồi thì lời nhắn không bắt buộc: yêu cầu tự ghi gói muốn đổi sang (NCC thấy trong chat và khi chỉnh sửa đơn)
    if (!note.trim() && !target) return setError('Vui lòng ghi rõ nội dung chi tiết cần chỉnh sửa để nhà cung cấp biết.')
    const wanted = target && service.data ? `Đổi sang gói "${target.name}" (${formatUnitPrice(target.price, { priceUnit: target.pricingUnit ?? service.data.priceUnit })})` : ''
    const text = [wanted, note.trim()].filter(Boolean).join('. ')
    revise.mutate({ orderId: order.id, changes: REVISION_CHANGE_TYPES.filter((c) => changes.includes(c) && !(c === 'Item' && itemLock)), note: text }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-medium">Bạn muốn thay đổi gì?</legend>
        <div className="grid grid-cols-2 gap-2.5 max-[420px]:grid-cols-1">
          {options.map((c) => {
            const locked = c === 'Item' && !!itemLock
            return (
              <label key={c} className={cn('inline-flex items-center gap-[7px] text-sm', locked ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer')}>
                <input type="checkbox" disabled={locked} checked={!locked && changes.includes(c)} onChange={() => toggle(c)} className="accent-primary" />
                {CHANGE_LABEL[c]}
              </label>
            )
          })}
        </div>
        {/* Đơn đã cọc mà NCC đã chuẩn bị nhiều / sắp tới ngày thực hiện: không cho yêu cầu đổi gói nữa */}
        {itemLock && <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-[12.5px] text-muted-foreground">Không đổi hạng mục được: {itemLock} Nếu thật sự cần, bạn nhắn nhà cung cấp trong chat.</p>}
      </fieldset>
      {changingItem && (
        <PackagePicker
          order={order}
          loading={!!order.serviceId && service.isPending}
          packages={service.data?.packages ?? []}
          priceUnit={service.data?.priceUnit}
          value={packageId}
          onChange={(id) => {
            setPackageId(id)
            setError(undefined)
          }}
        />
      )}
      <div>
        <label htmlFor="revise-note" className="mb-1.5 block text-[13px] font-medium">
          Nội dung chi tiết {target ? <span className="font-normal text-muted-foreground">(không bắt buộc)</span> : '*'}
        </label>
        <textarea
          id="revise-note"
          rows={changingItem ? 2 : 4}
          autoFocus
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setError(undefined)
          }}
          placeholder={byTable ? 'Ví dụ: Giảm còn 15 bàn, dời sang ngày 20/12...' : 'Ví dụ: Dời sang ngày 20/12, thêm cổng hoa...'}
          className="w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
        />
      </div>
      <FormError message={error ?? revise.error?.message} />
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy bỏ
        </Button>
        <Button type="submit" disabled={revise.isPending}>
          Gửi yêu cầu
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Đổi hạng mục: danh sách gói đang đăng của NCC để khách chọn gói muốn đổi sang (ảnh, tên, giá, sức chứa). Gói đang có trong đơn ghi
 * "Đang dùng" và không chọn được; bấm lại gói đang chọn để bỏ chọn.
 */
function PackagePicker({
  order,
  loading,
  packages,
  priceUnit,
  value,
  onChange,
}: {
  order: Order
  loading: boolean
  packages: ServicePackage[]
  priceUnit?: 'TABLE' | 'PACKAGE'
  value: string | null
  onChange: (id: string | null) => void
}) {
  const inOrder = new Set([...order.items.flatMap((i) => (i.packageId ? [i.packageId] : [])), ...(order.package ? [order.package.id] : [])])
  return (
    <fieldset>
      <legend className="mb-1.5 block text-[13px] font-medium">Chọn gói muốn đổi sang</legend>
      {loading ? (
        <div className="h-[132px] animate-pulse rounded-md bg-muted" aria-busy="true" aria-label="Đang tải các gói" />
      ) : packages.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nhà cung cấp chưa có gói nào khác. Hãy ghi rõ mong muốn ở ô bên dưới.</p>
      ) : (
        <div role="radiogroup" className="grid max-h-[272px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 max-[480px]:grid-cols-1">
          {packages.map((p) => {
            const current = inOrder.has(p.id)
            const on = value === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={current}
                onClick={() => onChange(on ? null : p.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  on ? 'border-primary bg-gold-100 ring-1 ring-primary' : 'border-line bg-surface hover:border-gold-500',
                )}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" loading="lazy" className="size-14 flex-none rounded-sm object-cover" />
                ) : (
                  <span aria-hidden className="size-14 flex-none rounded-sm bg-gold-100" />
                )}
                <span className="min-w-0 flex-1">
                  <b className="line-clamp-2 text-[13px] leading-snug font-semibold">{p.name}</b>
                  <span className="mt-0.5 block text-[12.5px] font-semibold text-gold-700 tabular-nums">{formatUnitPrice(p.price, { priceUnit: p.pricingUnit ?? priceUnit })}</span>
                  {current ? (
                    <span className="text-[11.5px] text-muted-foreground">Đang dùng</span>
                  ) : p.capacity ? (
                    <span className="text-[11.5px] text-muted-foreground">Tối đa {p.capacity} khách</span>
                  ) : null}
                </span>
                {on && <Check aria-hidden className="size-4 flex-none text-primary" strokeWidth={2.6} />}
              </button>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

/**
 * Yêu cầu chỉnh sửa đơn tiệc cưới: một khối "Ngày · Số bàn · Sảnh" hiện sẵn giá trị đang có (venueChange.ts, docs: các trường hợp ngoại lệ).
 * - Đổi ngày hoặc số bàn thì danh sách sảnh tự cập nhật và sắp lại: đang dùng, chọn được, không chọn được (mờ, kèm lý do).
 * - Sức chứa ghi theo bàn ("20 – 40 bàn"). Sảnh đang dùng với đúng số bàn cũ luôn hợp lệ (đã chốt trước khi NCC sửa giới hạn).
 * - Tạm tính theo giá niêm yết (dòng khác tính theo bàn nhân theo số bàn mới); thấp hơn tiền cọc thì chặn.
 * - Nhắc: ngày khác ngày cưới, số bàn ít hơn số khách dự kiến, mọi sảnh đều kín ngày đó; lỗi tải lịch thì vẫn gửi được kèm ghi chú.
 * - Nút Gửi chỉ bật khi có thay đổi (hoặc ghi chú) và lựa chọn hợp lệ. Loại thay đổi và lời nhắn tự sinh, khách không phải tick.
 */
function VenueReviseForm({ order, itemLock, onClose }: { order: Order; itemLock: string | null; onClose: () => void }) {
  const wedding = useWedding()
  const service = useService(order.serviceId ?? '')
  const revise = useRequestRevision()
  const pkg = order.package!
  const hallLine = order.items.find((i) => i.packageId === pkg.id) ?? order.items.find((i) => i.unit === 'Bàn')!
  const others = order.items.filter((i) => i !== hallLine)
  const cur: VenueCurrent = {
    hallId: pkg.id,
    date: order.eventDate,
    tables: hallLine.quantity,
    otherPerTable: others.filter((i) => i.unit === 'Bàn').reduce((t, i) => t + i.unitPrice, 0),
    otherFixed: others.filter((i) => i.unit !== 'Bàn').reduce((t, i) => t + i.amount, 0),
    total: order.totalAmount,
    deposit: order.status === 'Deposited' ? order.depositAmount : 0,
    weddingDate: wedding.data?.date ?? null,
    guestCount: wedding.data?.guestCount ?? null,
  }
  const [want, setWant] = useState<VenueWanted>({ hallId: cur.hallId, date: cur.date, tables: cur.tables })
  const [note, setNote] = useState('')

  // Sảnh của NCC; sảnh đang dùng đã ngừng bán (không còn trong danh sách) vẫn hiện để giữ nguyên được
  const listed = (service.data?.packages ?? []).filter((p) => p.id === cur.hallId || p.pricingUnit !== 'PACKAGE')
  const stopped = !service.isPending && !listed.some((p) => p.id === cur.hallId)
  const halls: (ServicePackage & { stopped?: boolean })[] = stopped
    ? [{ id: pkg.id, name: pkg.name, description: '', price: hallLine.unitPrice, stopped: true }, ...listed]
    : listed
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(want.date)
  const minDate = addDaysYmd(todayVN(), 1)
  // Ngày bận của từng sảnh vào ngày đang chọn (công khai, chỉ ngày). Sảnh đang dùng vào đúng ngày cũ là của chính đơn này: không tính
  const busyQ = useQueries({
    queries: halls.map((h) => ({
      queryKey: ['halls', h.id, 'busy', want.date],
      queryFn: () => hallsApi.hallDates(h.id, want.date, want.date),
      enabled: validDate && !h.stopped && !(h.id === cur.hallId && want.date === cur.date),
      staleTime: 60_000,
      retry: 1,
    })),
  })
  const busyOf = new Map(halls.map((h, i) => [h.id, busyQ[i]]))
  const isBusy = (id: string) => !!busyOf.get(id)?.data?.dates.includes(want.date)
  const checking = halls.some((h) => busyOf.get(h.id)?.isFetching)
  const unchecked = halls.some((h) => busyOf.get(h.id)?.isError)
  const keep = { currentHallId: cur.hallId, currentTables: cur.tables }
  const tablesOk = Number.isInteger(want.tables) && want.tables >= 1
  const optOf = (h: HallLike) => hallOption(h, want.tables, isBusy(h.id), keep)
  // Chọn được: sảnh đang dùng (luôn hiện) và sảnh hợp lệ; còn lại gom vào một dòng mở được kèm lý do
  // Sảnh đang chọn luôn ở danh sách chính (không hợp lệ thì hàng ghi lý do đỏ) để khách thấy vì sao chưa gửi được
  const pickable = (h: (typeof halls)[number]) => h.id === cur.hallId || h.id === want.hallId || (!itemLock && !h.stopped && (!tablesOk || optOf(h).ok))
  const sorted = sortHalls(halls, cur.hallId, pickable)
  const usable = sorted.filter(pickable)
  const unusable = sorted.filter((h) => !pickable(h))
  const [showUnusable, setShowUnusable] = useState(false)
  const allBusy = validDate && !checking && halls.length > 0 && halls.every((h) => isBusy(h.id))

  const hall = halls.find((h) => h.id === want.hallId)
  const chosen = hall && tablesOk ? optOf(hall) : null
  const changes = venueChanges(cur, want)
  const estimate = hall && tablesOk ? estimateTotal(hall, want.tables, cur) : null
  const notices = tablesOk ? venueNotices(cur, want, changes.includes('Item') || changes.includes('Quantity') ? estimate : null, formatMoney) : []
  // Lý do nút Gửi bị khóa (hiện ngay dưới nút thay vì chờ bấm mới báo)
  const blocked = !validDate || want.date < minDate
    ? 'Chọn ngày tổ chức từ ngày mai trở đi.'
    : !tablesOk
      ? 'Nhập số bàn từ 1 trở lên.'
      : hall && chosen && !chosen.ok
        ? `${hall.name} ${chosen.reason}. Chọn sảnh khác hoặc đổi số bàn, ngày.`
        : notices.find((n) => n.level === 'error')?.text ?? (!changes.length && !note.trim() ? 'Bạn chưa thay đổi gì.' : null)

  const [noteOpen, setNoteOpen] = useState(false)
  const shortDmy = (d: string) => formatDate(d).slice(0, 5)
  // Nhắc (xám, nhỏ, dưới ô) và lỗi chặn (đỏ): lỗi do chọn sảnh đã hiện đỏ ngay ở hàng sảnh nên không lặp lại
  // Tiệc đang đúng ngày cưới: nhà hàng xác nhận đổi ngày thì ngày cưới tự đổi theo (backend syncWeddingDateWithVenue)
  const dateHint =
    want.date !== cur.date && validDate && cur.weddingDate
      ? cur.date === cur.weddingDate
        ? 'Ngày cưới sẽ tự cập nhật khi nhà hàng xác nhận.'
        : want.date !== cur.weddingDate
          ? `Ngày cưới của bạn đang là ${formatDate(cur.weddingDate)}.`
          : null
      : null
  const guestHint = notices.find((n) => n.level === 'warn' && !n.text.startsWith('Ngày cưới')) ? `≈ ${want.tables * GUESTS_PER_TABLE} chỗ, ít hơn ${cur.guestCount} khách dự kiến` : null
  const errorText = blocked && changes.length && !(hall && chosen && !chosen.ok) && blocked !== 'Bạn chưa thay đổi gì.' ? blocked : null
  // Tóm tắt chỉ những gì đã đổi; tạm tính khi đổi sảnh / số bàn (giá niêm yết, NCC chốt khi sửa đơn)
  const summary: { label: string; text: string }[] = [
    ...(want.date !== cur.date && validDate ? [{ label: 'Ngày', text: `${shortDmy(cur.date)} → ${shortDmy(want.date)}` }] : []),
    ...(want.tables !== cur.tables && tablesOk ? [{ label: 'Bàn', text: `${cur.tables} → ${want.tables}` }] : []),
    ...(want.hallId !== cur.hallId && hall ? [{ label: 'Sảnh', text: `${halls.find((h) => h.id === cur.hallId)?.name ?? 'Sảnh cũ'} → ${hall.name}` }] : []),
    ...(estimate !== null && (changes.includes('Item') || changes.includes('Quantity')) ? [{ label: 'Tạm tính', text: `${formatMoney(estimate)} (đang ${formatMoney(cur.total)})` }] : []),
  ]

  function submit(e: FormEvent) {
    e.preventDefault()
    if (blocked) return
    const text = [venueNote(cur, want, hall, formatMoney, unchecked), note.trim()].filter(Boolean).join('. ')
    revise.mutate({ orderId: order.id, changes: changes.length ? changes : ['Other'], note: text }, { onSuccess: onClose })
  }

  const field = 'h-10 w-full rounded-sm border border-input bg-surface px-3 text-[15px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring'
  const step = (d: number) => setWant({ ...want, tables: Math.max(1, (tablesOk ? want.tables : cur.tables) + d) })
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset className="grid gap-3">
        <legend className="sr-only">Ngày, số bàn và sảnh</legend>
        {/* items-start + content-start: dòng nhắc dưới ô ngày không kéo giãn cột số bàn (hai ô luôn thẳng hàng) */}
        <div className="grid grid-cols-2 items-start gap-3 max-[420px]:grid-cols-1">
          <div className="grid content-start gap-1 text-[13px]">
            <span className="text-muted-foreground">Ngày</span>
            <DateField className={field} min={minDate} value={want.date} onValueChange={(v) => setWant({ ...want, date: v })} aria-label="Ngày tổ chức" />
            {dateHint && <span className="text-[12px] text-muted-foreground">{dateHint}</span>}
          </div>
          <div className="grid content-start gap-1 text-[13px]">
            <label htmlFor="venue-tables" className="text-muted-foreground">
              Số bàn
            </label>
            <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="icon" className="size-10 flex-none border-line-strong" aria-label="Bớt 1 bàn" onClick={() => step(-1)}>
                <Minus />
              </Button>
              <input
                id="venue-tables"
                type="number"
                min={1}
                inputMode="numeric"
                value={Number.isFinite(want.tables) && want.tables > 0 ? want.tables : ''}
                onChange={(e) => setWant({ ...want, tables: e.target.value === '' ? NaN : Number(e.target.value) })}
                className={cn(field, 'text-center tabular-nums')}
              />
              <Button type="button" variant="outline" size="icon" className="size-10 flex-none border-line-strong" aria-label="Thêm 1 bàn" onClick={() => step(1)}>
                <Plus />
              </Button>
            </div>
            {guestHint && <span className="text-[12px] text-muted-foreground">{guestHint}</span>}
          </div>
        </div>
        {itemLock && <p className="rounded-md bg-surface-2 px-3 py-2 text-[12.5px] text-muted-foreground">Không đổi sảnh được: {itemLock}</p>}
        {checking && <p className="text-[12.5px] text-muted-foreground">Đang kiểm tra lịch sảnh ngày {formatDate(want.date)}…</p>}
        {unchecked && !checking && <p className="text-[12.5px] text-warn">Chưa kiểm tra được lịch sảnh. Bạn vẫn gửi được, nhà hàng sẽ xác nhận.</p>}
        {allBusy && <p className="rounded-md bg-warn-soft px-3 py-2 text-[12.5px] text-warn">Ngày {formatDate(want.date)} nhà hàng đã kín hết sảnh. Chọn ngày khác.</p>}
        {service.isPending ? (
          <div className="h-[120px] animate-pulse rounded-md bg-muted" aria-busy="true" aria-label="Đang tải các sảnh" />
        ) : (
          <>
            <div role="radiogroup" aria-label="Sảnh" className="overflow-hidden rounded-md border border-line">
              {usable.map((h) => (
                <HallRow
                  key={h.id}
                  hall={h}
                  current={h.id === cur.hallId}
                  on={want.hallId === h.id}
                  reason={tablesOk ? optOf(h).reason : null}
                  priceUnit={service.data?.priceUnit}
                  onPick={() => setWant({ ...want, hallId: h.id })}
                />
              ))}
            </div>
            {unusable.length > 0 && (
              <div>
                <button type="button" aria-expanded={showUnusable} onClick={() => setShowUnusable((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-ink">
                  <ChevronDown className={cn('size-3.5 transition-transform', showUnusable && 'rotate-180')} />
                  {showUnusable ? 'Ẩn' : '+'}
                  {` ${unusable.length} sảnh không phù hợp`}
                </button>
                {showUnusable && (
                  <ul className="mt-1.5 grid gap-1 rounded-md bg-surface-2 px-3 py-2 text-[12.5px]">
                    {unusable.map((h) => (
                      <li key={h.id} className="flex flex-wrap justify-between gap-x-3">
                        <span className="text-muted-foreground">{h.name}</span>
                        <span className="font-medium text-destructive">{itemLock && h.id !== cur.hallId ? 'đang khóa đổi sảnh' : h.stopped ? 'ngừng bán' : optOf(h).reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
        {errorText && <p className="rounded-md bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">{errorText}</p>}
      </fieldset>
      {!noteOpen ? (
        <button type="button" onClick={() => setNoteOpen(true)} className="self-start text-[13px] font-medium text-gold-ink hover:underline">
          + Thêm ghi chú
        </button>
      ) : (
        <textarea
          id="revise-note"
          aria-label="Ghi chú thêm"
          autoFocus
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Muốn thêm cổng hoa, đổi thực đơn..."
          className="w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
        />
      )}
      <FormError message={revise.error?.message} />
      {/* Tóm tắt: mỗi thay đổi một dòng, nằm riêng phía trên các nút */}
      <div className="rounded-md bg-surface-2 px-3 py-2.5 text-[13.5px]">
        {summary.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {summary.map((x) => (
              <div key={x.label} className="contents">
                <dt className="font-semibold">{x.label}</dt>
                <dd className="m-0 tabular-nums">{x.text}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <span className="text-muted-foreground">Chưa có thay đổi</span>
        )}
      </div>
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy bỏ
        </Button>
        <Button type="submit" disabled={!!blocked || revise.isPending} className="disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none">
          Gửi yêu cầu
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Một hàng sảnh trong danh sách chọn: ảnh nhỏ, tên một dòng, giá bên phải, dòng phụ "Đang dùng · 20 – 40 bàn". */
function HallRow({
  hall: h,
  current,
  on,
  reason,
  priceUnit,
  onPick,
}: {
  hall: ServicePackage & { stopped?: boolean }
  current: boolean
  on: boolean
  reason: string | null
  priceUnit?: 'TABLE' | 'PACKAGE'
  onPick: () => void
}) {
  const sub = reason ?? (current ? (h.stopped ? 'Ngừng bán, giữ nguyên được' : null) : tableRange(h))
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={cn('flex w-full items-center gap-3 px-3 py-2 text-left transition-colors [&+&]:border-t [&+&]:border-line', on ? 'bg-gold-100' : 'hover:bg-surface-2')}
    >
      <span aria-hidden className={cn('grid size-4 flex-none place-items-center rounded-full border', on ? 'border-primary' : 'border-line-strong')}>
        {on && <span className="size-2 rounded-full bg-primary" />}
      </span>
      {h.imageUrl ? <img src={h.imageUrl} alt="" loading="lazy" className="size-10 flex-none rounded-sm object-cover" /> : <span aria-hidden className="size-10 flex-none rounded-sm bg-gold-100" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <b className="truncate text-[13.5px] font-semibold" title={h.name}>
              {h.name}
            </b>
            {current && <span className="flex-none rounded-full bg-surface-2 px-1.5 py-px text-[11px] text-muted-foreground">Đang dùng</span>}
          </span>
          <span className="flex-none text-[12.5px] font-semibold text-gold-700 tabular-nums">{formatUnitPrice(h.price, { priceUnit: h.pricingUnit ?? priceUnit ?? 'TABLE' })}</span>
        </span>
        {sub && <span className={cn('block truncate text-[12px]', reason ? 'font-medium text-destructive' : 'text-muted-foreground')}>{sub}</span>}
      </span>
    </button>
  )
}
