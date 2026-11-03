import { useMutation } from '@tanstack/react-query'
import { vendorOrdersApi } from '@/api/vendorOrders'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import type { Order } from '@/types/vendorOrder'
import { useCancelOrder, useSyncOrder } from '../hooks'

/**
 * Yêu cầu sau cọc của khách trên thẻ / màn chi tiết đơn phía NCC (docs/api/orders.md):
 * - đổi số khách: Đồng ý (tăng giá trị thì chờ khách nộp cọc bổ sung) / Từ chối;
 * - yêu cầu hủy: Đồng ý hủy (hủy đơn với lý do "Khách yêu cầu hủy", khách mất cọc) / Từ chối.
 */
export function OrderRequestsPanel({ order: o }: { order: Order }) {
  const sync = useSyncOrder()
  const cancel = useCancelOrder()
  const act = useMutation({
    mutationFn: ({ fn }: { fn: () => Promise<Order>; done: string }) => fn(),
    onSuccess: (order, v) => {
      sync(order)
      toast(v.done)
    },
    onError: (e: Error) => toast(e.message),
  })
  if (o.status !== 'Deposited') return null
  const change = o.guestChanges?.find((g) => g.status === 'AwaitingVendor' || g.status === 'AwaitingDeposit')
  if (!change && !o.cancelRequest) return null
  const busy = act.isPending || cancel.isPending

  return (
    <div className="mt-3 flex flex-col gap-2">
      {change && (
        <div className="rounded-sm bg-surface-2 px-3 py-2.5 text-[13px]">
          <b>Khách yêu cầu đổi số khách</b>: {change.oldGuestCount ? `${change.oldGuestCount} → ` : ''}
          {change.newGuestCount} khách ({change.oldTables} → {change.newTables} bàn), giá trị {formatMoney(change.oldAmount)} → {formatMoney(change.newAmount)}
          {change.extraDeposit ? `, cọc bổ sung ${formatMoney(change.extraDeposit)}` : ', không hoàn cọc'}.{change.note && ` "${change.note}"`}
          {change.status === 'AwaitingVendor' ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => act.mutate({ fn: () => vendorOrdersApi.approveGuestChange(o.id), done: change.extraDeposit ? 'Đã đồng ý, chờ khách nộp cọc bổ sung' : 'Đã đồng ý và cập nhật đơn' })}>
                Đồng ý
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act.mutate({ fn: () => vendorOrdersApi.rejectGuestChange(o.id), done: 'Đã từ chối yêu cầu đổi số khách' })}>
                Từ chối
              </Button>
            </div>
          ) : (
            <div className="mt-1 text-muted-foreground">Đã đồng ý, đang chờ khách nộp cọc bổ sung.</div>
          )}
        </div>
      )}
      {o.cancelRequest && (
        <div className="rounded-sm bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
          <b>Khách yêu cầu hủy đơn</b> ngày {formatDate(o.cancelRequest.requestedDate.slice(0, 10))} (tiền cọc {formatMoney(o.depositAmount)} không hoàn)
          {o.cancelRequest.note && `: "${o.cancelRequest.note}"`}.
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => cancel.mutate({ orderId: o.id, reason: 'CUSTOMER_REQUEST', note: '' })}>
              Đồng ý hủy
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act.mutate({ fn: () => vendorOrdersApi.rejectCancelRequest(o.id), done: 'Đã từ chối yêu cầu hủy, đơn giữ nguyên' })}>
              Từ chối
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
