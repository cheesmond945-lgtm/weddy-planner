import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { ordersApi } from '@/api/orders'
import { VietqrPanel } from '@/components/VietqrPanel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { useRefreshPlanning } from '@/features/weddings/hooks'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import type { Order } from '@/types/vendorOrder'

/** Đơn tiệc (tính theo bàn): có sảnh, hoặc có dòng đơn vị bàn/mâm */
export const isTableOrder = (o: Order) => !!o.package || o.items.some((i) => /bàn|mâm/i.test(i.unit ?? ''))

const openChange = (o: Order) => o.guestChanges?.find((g) => g.status === 'AwaitingVendor' || g.status === 'AwaitingDeposit') ?? null

/** Ghi lại thay đổi rồi tải lại kế hoạch và danh sách đơn */
function useOrderWrite<T>(fn: (v: T) => Promise<Order>, done: string) {
  const refresh = useRefreshPlanning()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast(done)
      void refresh()
      void qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (e: Error) => toast(e.message),
  })
}

/**
 * Yêu cầu sau cọc của khách trên thẻ đơn (docs/api/orders.md): đổi số khách (đơn tiệc, trước ngày tổ chức 7 ngày, NCC xác nhận,
 * tăng giá trị thì nộp cọc bổ sung 10% phần tăng) và yêu cầu hủy đơn (tiền cọc không hoàn, NCC xác nhận).
 */
export function CoupleOrderRequests({ order: o }: { order: Order }) {
  const [changing, setChanging] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [paying, setPaying] = useState(false)
  const withdraw = useOrderWrite(() => ordersApi.withdrawCancel(o.id), 'Đã rút yêu cầu hủy đơn')
  if (o.status !== 'Deposited') return null

  const change = openChange(o)
  const canChange = isTableOrder(o) && !change && !o.cancelRequest
  return (
    <>
      {change && (
        <div className="mt-2.5 rounded-sm bg-surface-2 px-2.5 py-2 text-[13px]">
          {change.status === 'AwaitingVendor' ? (
            <>
              Đang chờ nhà cung cấp xác nhận đổi {change.oldGuestCount ? `${change.oldGuestCount} → ` : ''}
              <b>{change.newGuestCount} khách</b> ({change.newTables} bàn, giá trị mới {formatMoney(change.newAmount)}).
            </>
          ) : (
            <>
              Nhà cung cấp đã đồng ý đổi thành <b>{change.newGuestCount} khách</b>. Nộp cọc bổ sung <b>{formatMoney(change.extraDeposit)}</b> để áp dụng.
              <div className="mt-2">
                <Button size="sm" variant="success" onClick={() => setPaying(true)}>
                  Nộp cọc bổ sung
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {o.cancelRequest && (
        <div className="mt-2.5 rounded-sm bg-warn-soft px-2.5 py-2 text-[13px] text-warn">
          Bạn đã yêu cầu hủy đơn ngày {formatDate(o.cancelRequest.requestedDate.slice(0, 10))}, đang chờ nhà cung cấp xác nhận. Tiền cọc không được hoàn.
          <div className="mt-2">
            <Button size="sm" variant="outline" disabled={withdraw.isPending} onClick={() => withdraw.mutate(undefined)}>
              Rút yêu cầu hủy
            </Button>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {canChange && (
          <Button size="sm" variant="outline" onClick={() => setChanging(true)}>
            Đổi số khách
          </Button>
        )}
        {!o.cancelRequest && (
          <Button size="sm" variant="outline" className="border-warn/60 text-warn hover:bg-warn-soft hover:text-warn" onClick={() => setCancelling(true)}>
            Yêu cầu hủy đơn
          </Button>
        )}
      </div>
      {changing && <GuestChangeDialog order={o} onClose={() => setChanging(false)} />}
      {cancelling && <CancelRequestDialog order={o} onClose={() => setCancelling(false)} />}
      {paying && change && <ExtraDepositDialog order={o} onClose={() => setPaying(false)} />}
    </>
  )
}

/** Nhập số khách mới, xem trước số bàn / giá trị mới / cọc bổ sung (backend tính), gửi cho NCC xác nhận */
function GuestChangeDialog({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const [text, setText] = useState(o.guestCount ? String(o.guestCount) : '')
  const [debounced, setDebounced] = useState(text)
  const [note, setNote] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 400)
    return () => clearTimeout(t)
  }, [text])
  const guests = Number(debounced)
  const quote = useQuery({
    queryKey: ['guest-change-quote', o.id, guests],
    queryFn: () => ordersApi.quoteGuestChange(o.id, guests),
    enabled: Number.isInteger(guests) && guests > 0,
    retry: false,
  })
  const send = useOrderWrite((v: { guestCount: number; note?: string }) => ordersApi.requestGuestChange(o.id, v), 'Đã gửi yêu cầu đổi số khách cho nhà cung cấp')
  const q = quote.data

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!q) return
    send.mutate({ guestCount: guests, note: note.trim() || undefined }, { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Đổi số khách · Đơn {o.orderCode}</DialogTitle>
          <DialogDescription>
            Giá trị mới = đơn giá lúc đặt × max(số bàn mới, số bàn tối thiểu của sảnh). Tăng giá trị thì nộp cọc bổ sung 10% phần tăng; giảm khách không hoàn cọc. Nhà cung cấp cần xác nhận.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-[13px] font-medium">
            Số khách mới{o.guestCount ? ` (hiện ${o.guestCount} khách)` : ''}
            <Input type="number" min={1} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} className="mt-1.5" autoFocus />
          </label>
          {quote.isError && <p className="text-[13px] text-warn">{(quote.error as Error).message}</p>}
          {q && (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md bg-surface-2 px-3 py-2.5 text-[13px]">
              <dt className="text-muted-foreground">Số bàn tính tiền</dt>
              <dd className="text-right">
                {q.oldTables} → {q.chargedTables} bàn{q.chargedTables > q.newTables ? ' (tối thiểu của sảnh)' : ''}
              </dd>
              <dt className="text-muted-foreground">Giá trị đơn</dt>
              <dd className="text-right">
                {formatMoney(q.oldAmount)} → <b>{formatMoney(q.newAmount)}</b>
              </dd>
              <dt className="text-muted-foreground">Cọc bổ sung</dt>
              <dd className="text-right">{q.extraDeposit ? formatMoney(q.extraDeposit) : '0đ (không hoàn cọc)'}</dd>
              <dt className="text-muted-foreground">Hạn gửi yêu cầu</dt>
              <dd className="text-right">{formatDate(q.deadline)}</dd>
            </dl>
          )}
          <label className="text-[13px] font-medium">
            Ghi chú cho nhà cung cấp <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
            <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={!q || send.isPending || debounced !== text}>
              {send.isPending ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Khách yêu cầu hủy đơn đã cọc: cảnh báo mất cọc, NCC xác nhận */
function CancelRequestDialog({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const [note, setNote] = useState('')
  const send = useOrderWrite((v: string) => ordersApi.requestCancel(o.id, v || undefined), 'Đã gửi yêu cầu hủy đơn cho nhà cung cấp')
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Yêu cầu hủy đơn {o.orderCode}?</DialogTitle>
          <DialogDescription>
            Tiền cọc {formatMoney(o.depositAmount)} không được hoàn và vẫn được tính vào khoản đã chi trong ngân sách. Đơn chỉ hủy khi nhà cung cấp xác nhận; hạng mục sẽ trở về "chưa chọn" trong kế hoạch.
          </DialogDescription>
        </DialogHeader>
        <label className="text-[13px] font-medium">
          Lý do <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
          <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="mt-1.5" autoFocus />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Giữ đơn
          </Button>
          <Button variant="destructive" disabled={send.isPending} onClick={() => send.mutate(note.trim(), { onSuccess: onClose })}>
            Gửi yêu cầu hủy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Nộp cọc bổ sung qua VietQR (cùng cách với đặt cọc) */
function ExtraDepositDialog({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const refresh = useRefreshPlanning()
  const qc = useQueryClient()
  const info = useQuery({ queryKey: ['guest-change-pay', o.id], queryFn: () => ordersApi.payGuestChange(o.id), retry: false, staleTime: Infinity })
  const paid = () => {
    toast('Đã nhận cọc bổ sung, đơn đã được cập nhật')
    void refresh()
    void qc.invalidateQueries({ queryKey: ['orders'] })
    onClose()
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Nộp cọc bổ sung · Đơn {o.orderCode}</DialogTitle>
          <DialogDescription>Chuyển khoản đúng số tiền và nội dung; hệ thống tự ghi nhận khi nhận được tiền.</DialogDescription>
        </DialogHeader>
        {info.isError ? (
          <p className="text-sm text-warn">{(info.error as Error).message}</p>
        ) : !info.data ? (
          <div className="h-[320px] animate-pulse rounded-md bg-muted" aria-busy="true" />
        ) : (
          <VietqrPanel
            info={info.data}
            check={() => ordersApi.checkGuestChangePay(o.id)}
            onPaid={paid}
            demoPay={info.data.demoMode ? () => ordersApi.demoGuestChangePay(o.id) : undefined}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
