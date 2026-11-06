import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
 * Yêu cầu sau cọc của khách trên thẻ đơn (docs/api/orders.md): yêu cầu hủy đơn (tiền cọc không hoàn, NCC xác nhận). Đổi số khách đi qua
 * "Yêu cầu chỉnh sửa" (ô Đổi số khách); yêu cầu đổi số khách cũ còn mở vẫn hiện trạng thái và nút nộp cọc bổ sung.
 */
export function CoupleOrderRequests({ order: o }: { order: Order }) {
  const [cancelling, setCancelling] = useState(false)
  const [paying, setPaying] = useState(false)
  const withdraw = useOrderWrite(() => ordersApi.withdrawCancel(o.id), 'Đã rút yêu cầu hủy đơn')
  if (o.status !== 'Deposited') return null

  const change = openChange(o)
  return (
    <>
      {change && (
        <div className="mt-3 rounded-sm bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed">
          {change.status === 'AwaitingVendor' ? (
            <>
              Đang chờ nhà cung cấp xác nhận đổi {change.oldGuestCount ? `${change.oldGuestCount} → ` : ''}
              <b>{change.newGuestCount} khách</b> ({change.newTables} bàn, giá trị mới {formatMoney(change.newAmount)}).
            </>
          ) : (
            <>
              Nhà cung cấp đã đồng ý đổi thành <b>{change.newGuestCount} khách</b>. Nộp cọc bổ sung <b>{formatMoney(change.extraDeposit)}</b> để áp dụng.
              <div className="mt-2.5">
                <Button size="sm" variant="success" onClick={() => setPaying(true)}>
                  Nộp cọc bổ sung
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {o.cancelRequest && (
        <div className="mt-3 rounded-sm bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed text-warn">
          Bạn đã yêu cầu hủy đơn ngày {formatDate(o.cancelRequest.requestedDate.slice(0, 10))}, đang chờ nhà cung cấp xác nhận. Tiền cọc không được hoàn.
          <div className="mt-2.5">
            <Button size="sm" variant="outline" disabled={withdraw.isPending} onClick={() => withdraw.mutate(undefined)}>
              Rút yêu cầu hủy
            </Button>
          </div>
        </div>
      )}
      <div className="mt-3 mb-4 flex flex-wrap gap-2">
        {!o.cancelRequest && (
          <Button size="sm" variant="outline" className="border-warn/60 text-warn hover:bg-warn-soft hover:text-warn" onClick={() => setCancelling(true)}>
            Yêu cầu hủy đơn
          </Button>
        )}
      </div>
      {cancelling && <CancelRequestDialog order={o} onClose={() => setCancelling(false)} />}
      {paying && change && <ExtraDepositDialog order={o} onClose={() => setPaying(false)} />}
    </>
  )
}

/** Đơn chưa thanh toán cọc (chờ cọc / chờ NCC chỉnh sửa): khách tự hủy ngay, không mất phí, không cần NCC xác nhận. */
export function CoupleCancelUnpaid({ order: o, size = 'sm' }: { order: Order; size?: 'sm' | 'default' }) {
  const [open, setOpen] = useState(false)
  if (o.status !== 'Pending' && o.status !== 'NeedRevision') return null
  return (
    <>
      <Button size={size} variant="outline" className="border-warn/60 text-warn hover:bg-warn-soft hover:text-warn" onClick={() => setOpen(true)}>
        Hủy đơn
      </Button>
      {open && <CancelUnpaidDialog order={o} onClose={() => setOpen(false)} />}
    </>
  )
}

function CancelUnpaidDialog({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const [note, setNote] = useState('')
  const send = useOrderWrite((v: string) => ordersApi.cancelUnpaid(o.id, v || undefined), 'Đã hủy đơn')
  return (
    <Dialog open onOpenChange={(open) => !open && !send.isPending && onClose()}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Hủy đơn {o.orderCode}?</DialogTitle>
          <DialogDescription>
            Bạn chưa thanh toán cọc nên đơn được hủy ngay, không mất phí và không cần nhà cung cấp xác nhận. Nhà cung cấp sẽ nhận được thông báo; hạng mục sẽ trở về "chưa chọn" trong kế hoạch.
          </DialogDescription>
        </DialogHeader>
        <label className="text-[13px] font-medium">
          Lý do <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
          <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="mt-1.5" autoFocus />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>
            Giữ đơn
          </Button>
          <Button variant="destructive" disabled={send.isPending} onClick={() => send.mutate(note.trim(), { onSuccess: onClose })}>
            {send.isPending ? 'Đang hủy…' : 'Hủy đơn'}
          </Button>
        </DialogFooter>
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
