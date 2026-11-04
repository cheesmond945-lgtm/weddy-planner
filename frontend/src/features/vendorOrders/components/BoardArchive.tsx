import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { formatDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { dayAfter } from '../dayAfter'
import { useCompleteOrder, useOrders } from '../hooks'
import { useRestAction, useRestPending } from '../taskActions'
import { REST_TONE_CLASS, restLabel } from '../restPayment'
import { RestReceivedDialog } from './RestReceivedDialog'
import type { Order } from '@/types/vendorOrder'
import type { FinishedOrder } from '../taskBoard'
import { OrderProgressPanel } from './OrderProgressPanel'

/** Số đơn mỗi trang ở Lưu trữ (Đã hoàn tất), cũng là số đơn Chờ hoàn tất hiện thêm mỗi lần. */
const COMPLETED_PAGE = 10

/** Một đơn trong Lưu trữ: dòng tóm tắt, bấm "Xem việc" mở danh sách việc của đơn. */
function ArchiveRow({ orderId, hue, head, actions, readOnly }: { orderId: string; hue: number; head: ReactNode; actions?: ReactNode; readOnly: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="overflow-hidden rounded-lg border border-line bg-surface shadow-card" style={{ boxShadow: `inset 3px 0 0 hsl(${hue} 60% 48%)` }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <div className="min-w-0 flex-1">{head}</div>
        <span className="flex flex-wrap items-center gap-2">
          {actions}
          <Button variant="outline" size="sm" className="border-line-strong" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Thu gọn' : 'Xem việc'}
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to={`${paths.vendor.orders}?order=${orderId}`}>Xem đơn</Link>
          </Button>
        </span>
      </div>
      {open && (
        <div className="border-t border-line bg-surface-2/50 px-4 py-3">
          <OrderProgressPanel orderId={orderId} readOnly={readOnly} />
        </div>
      )}
    </li>
  )
}

/** Nút Hoàn tất đơn: chỉ bấm được khi đã qua ngày thực hiện (luật backend). */
function CompleteButton({ order }: { order: FinishedOrder }) {
  const complete = useCompleteOrder()
  const [asking, setAsking] = useState(false)
  const can = toISODate(today()) > order.eventDate
  if (!can) return <span className="text-[12.5px] text-muted-foreground">Hoàn tất được từ {formatDate(dayAfter(order.eventDate))}</span>
  // Phần còn lại là tiền mặt: hỏi đã nhận đủ chưa, rồi ghi nhận và hoàn tất cùng lúc
  return (
    <>
      <Button size="sm" disabled={complete.isPending} onClick={() => setAsking(true)}>
        Hoàn tất đơn
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title="Đã nhận tiền mặt?"
        confirmLabel="Đã nhận, hoàn tất"
        cancelLabel="Chưa, để sau"
        onConfirm={() => complete.mutate({ orderId: order.orderId, restReceived: true })}
      >
        <p>
          Bạn đã nhận đủ phần tiền mặt còn lại của đơn <b>{order.orderCode}</b> chưa? Bấm "Đã nhận, hoàn tất" để ghi nhận và hoàn tất đơn.
        </p>
      </ConfirmDialog>
    </>
  )
}

/** Đơn đã hoàn tất: nhãn đợt 2 ("Đã nhận dd/mm" / cam "Chưa nhận") và nút ghi nhận tiền mặt khi chưa nhận. */
function RestCell({ order }: { order: Order }) {
  const restAction = useRestAction()
  const busy = useRestPending(order.id)
  const [asking, setAsking] = useState(false)
  const l = restLabel(order, 'VENDOR')
  if (l.tone === 'none') return null
  const pending = order.restPayment?.status === 'Pending'
  return (
    <>
      <span className={cn('text-[12.5px]', REST_TONE_CLASS[l.tone])}>Đợt 2: {l.text}</span>
      {pending && (
        <Button size="sm" variant="outline" className="border-line-strong" disabled={busy} onClick={() => setAsking(true)}>
          Ghi nhận đã nhận tiền mặt
        </Button>
      )}
      <RestReceivedDialog open={asking} amount={order.restPayment?.amount} onOpenChange={setAsking} onConfirm={() => void restAction(order.id, true, order.orderCode)} />
    </>
  )
}

interface BoardArchiveProps {
  /** Đơn đã cọc đã xong hết việc (từ bảng việc): chờ hoàn tất */
  finished: readonly FinishedOrder[]
  hueFor: (orderId: string) => number
}

/**
 * Tab "Lưu trữ" của Bảng việc (docs/TIMELINE.md mục 9.2): đơn NCC đã làm xong rời bảng tự động, không cần đổi CSDL.
 * - Chờ hoàn tất: đơn Đã cọc đã xong hết việc; bấm Hoàn tất đơn khi đã qua ngày thực hiện (hoặc tự hoàn tất khi quá ngày thực hiện hơn 7 ngày).
 *   Mở lại một việc (ở Xem việc) thì đơn quay lại tab Đang làm.
 * - Đã hoàn tất: đơn trạng thái Hoàn tất, mới nhất trước, có phân trang; việc chỉ xem.
 */
export function BoardArchive({ finished, hueFor }: BoardArchiveProps) {
  const [page, setPage] = useState(1)
  const [waitShown, setWaitShown] = useState(COMPLETED_PAGE)
  const waitRest = finished.length - waitShown
  const completed = useOrders({ status: 'Completed', page, pageSize: COMPLETED_PAGE })
  const rows = completed.data?.data ?? []
  const meta = completed.data?.meta

  return (
    <div className="grid gap-6">
      <section aria-label="Chờ hoàn tất">
        <h3 className="mb-1 flex items-baseline gap-2 font-sans text-[15px] font-semibold tracking-normal">
          Chờ hoàn tất <span className="text-[13px] font-medium text-muted-foreground">{finished.length} đơn</span>
        </h3>
        <p className="mb-2.5 text-[13px] text-muted-foreground">Đơn đã xong hết việc nên rời bảng. Bấm Hoàn tất đơn khi đã qua ngày thực hiện; hệ thống cũng tự hoàn tất khi đã quá ngày thực hiện hơn 7 ngày.</p>
        {finished.length ? (
          <ul className="grid gap-2">
            {finished.slice(0, waitShown).map((o) => (
              <ArchiveRow
                key={o.orderId}
                orderId={o.orderId}
                hue={hueFor(o.orderId)}
                readOnly={false}
                head={
                  <>
                    <p className="text-[14px] font-semibold [overflow-wrap:anywhere]">{o.customerName || 'Khách'}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {o.orderCode} · thực hiện {formatDate(o.eventDate)} · đã xong {o.total}/{o.total} việc
                    </p>
                  </>
                }
                actions={<CompleteButton order={o} />}
              />
            ))}
            {waitRest > 0 && (
              <li>
                <Button variant="outline" size="sm" className="w-full border-dashed border-line-strong" onClick={() => setWaitShown((n) => n + COMPLETED_PAGE)}>
                  Xem thêm {Math.min(COMPLETED_PAGE, waitRest)} đơn (còn {waitRest})
                </Button>
              </li>
            )}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-4 py-4 text-center text-[13px] text-muted-foreground">Chưa có đơn nào xong hết việc.</p>
        )}
      </section>

      <section aria-label="Đã hoàn tất">
        <h3 className="mb-2.5 flex flex-wrap items-baseline gap-2 font-sans text-[15px] font-semibold tracking-normal">
          Đã hoàn tất <span className="text-[13px] font-medium text-muted-foreground">{meta ? `${meta.total} đơn` : ''}</span>
        </h3>
        {completed.isError ? (
          <p className="text-[13px] text-warn">Chưa tải được đơn đã hoàn tất.</p>
        ) : rows.length ? (
          <>
            <ul className={cn('grid gap-2', completed.isPlaceholderData && 'opacity-60')}>
              {rows.map((o) => (
                <ArchiveRow
                  key={o.id}
                  orderId={o.id}
                  hue={hueFor(o.id)}
                  readOnly
                  actions={<RestCell order={o} />}
                  head={
                    <>
                      <p className="text-[14px] font-semibold [overflow-wrap:anywhere]">{o.customerName || 'Khách'}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {o.orderCode} · thực hiện {formatDate(o.eventDate)}
                        {o.completedDate && ` · hoàn tất ${formatDate(o.completedDate.slice(0, 10))}`}
                      </p>
                    </>
                  }
                />
              ))}
            </ul>
            {meta && meta.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2 text-[13px]">
                <Button variant="outline" size="icon" className="size-8" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span>
                  Trang {page}/{meta.totalPages}
                </span>
                <Button variant="outline" size="icon" className="size-8" aria-label="Trang sau" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-4 py-4 text-center text-[13px] text-muted-foreground">{completed.isPending ? 'Đang tải…' : 'Chưa có đơn nào hoàn tất.'}</p>
        )}
      </section>
    </div>
  )
}
