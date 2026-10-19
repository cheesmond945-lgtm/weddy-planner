import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { PageMeta } from '@/types/api'
import type { ServiceOrder } from '@/types/serviceOrder'
import { currentContent, currentVersion, formatDay, headlineOf } from '../calc'
import { ADJUSTMENT_STATUS, adjustmentStateOf, ORDER_STATUS, PAYMENT_STATUS } from '../constants'
import { StatusBadge } from './OrderBadges'

/** Mở hội thoại của đơn ở trang Tin nhắn. */
export const chatHref = (o: Pick<ServiceOrder, 'conversationId'>) => `${paths.vendor.chat}?c=${encodeURIComponent(o.conversationId)}`

/** Tình trạng điều chỉnh hiện dưới trạng thái đơn đã xác nhận (như prototype NCC). */
function adjustmentNote(o: ServiceOrder) {
  const st = o.status === 'CONFIRMED' ? adjustmentStateOf(o) : null
  if (!st) return null
  if (st.kind === 'REQUESTED') return 'Khách yêu cầu điều chỉnh'
  return st.kind === 'AWAITING_CONFIRMATION' ? 'Chờ khách duyệt phương án' : ADJUSTMENT_STATUS.REVISION_REQUESTED.label
}

const th = 'border-y border-line bg-surface-2 px-3 py-[11px] first:pl-5 last:pr-5 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
const td = 'border-b border-line px-3 py-[14px] align-middle text-[13.5px] first:pl-5 last:pr-5'
const sub = 'block text-[12.5px] text-muted-foreground'

interface OrderTableProps {
  orders: ServiceOrder[]
  meta: PageMeta
  onOpen: (order: ServiceOrder) => void
  onPage: (page: number) => void
}

/** Bảng đơn hàng: trạng thái đơn và thanh toán là hai cột riêng (data-table trong prototype NCC). */
export function OrderTable({ orders, meta, onOpen, onPage }: OrderTableProps) {
  return (
    <>
      {/* relative: giữ chữ sr-only (absolute) của cột thao tác trong vùng cuộn, không kéo trang rộng ra trên điện thoại */}
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Mã đơn</th>
              <th className={th}>Khách hàng</th>
              <th className={th}>Ngày sự kiện</th>
              <th className={cn(th, 'max-[1500px]:hidden')}>Hạng mục chính</th>
              <th className={cn(th, 'text-right')}>Tổng hiện hành</th>
              <th className={th}>Thanh toán</th>
              <th className={th}>Trạng thái đơn</th>
              <th className={th}>
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const c = currentContent(o)
              const v = currentVersion(o)
              const head = c ? headlineOf(c) : null
              const adj = adjustmentNote(o)
              return (
                <tr key={o.id} className="transition-colors last:[&>td]:border-b-0 hover:bg-surface-2">
                  <td className={cn(td, 'font-semibold whitespace-nowrap tabular-nums')}>
                    {o.code}
                    <span className={cn(sub, 'font-normal')}>{v ? `v${v.version}` : 'chưa gửi'}</span>
                  </td>
                  <td className={cn(td, 'min-w-[130px] font-medium')}>
                    {c?.customerName}
                    <span className={cn(sub, 'font-normal whitespace-nowrap')}>{c?.customerPhone}</span>
                  </td>
                  <td className={cn(td, 'whitespace-nowrap')}>{formatDay(c?.eventDate)}</td>
                  <td className={cn(td, 'min-w-[120px] max-[1500px]:hidden')}>
                    {head?.name}
                    {!!head?.more && <span className={sub}>+ {head.more} hạng mục</span>}
                  </td>
                  <td className={cn(td, 'text-right font-semibold whitespace-nowrap tabular-nums')}>{formatMoney(o.totalAmount)}</td>
                  <td className={td}>
                    <StatusBadge tone={PAYMENT_STATUS[o.paymentStatus].tone}>{PAYMENT_STATUS[o.paymentStatus].label}</StatusBadge>
                    {o.paidAmount > 0 && <span className={cn(sub, 'mt-1')}>Đã thu {formatMoney(o.paidAmount)}</span>}
                  </td>
                  <td className={td}>
                    <StatusBadge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</StatusBadge>
                    {adj && <span className={cn(sub, 'mt-1')}>{adj}</span>}
                  </td>
                  <td className={td}>
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex flex-col items-end gap-1">
                        <button type="button" onClick={() => onOpen(o)} className="text-[13px] font-medium whitespace-nowrap text-gold-ink hover:underline">
                          Chi tiết
                        </button>
                        {o.draft && !o.versions.length && o.status !== 'CANCELLED' && (
                          <Link to={chatHref(o)} className="text-[13px] font-medium whitespace-nowrap text-gold-ink hover:underline">
                            Mở bản nháp
                          </Link>
                        )}
                      </div>
                      <Button asChild size="icon" variant="outline" className="border-line-strong">
                        <Link to={chatHref(o)} aria-label={`Mở trò chuyện với ${c?.customerName ?? 'khách'}`} title="Mở trò chuyện">
                          <MessageSquare />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-muted-foreground">
        <span>
          Hiển thị {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.total, meta.page * meta.pageSize)} trên {meta.total} đơn
        </span>
        {meta.totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Trang trước"
              disabled={meta.page <= 1}
              onClick={() => onPage(meta.page - 1)}
              className="grid size-[30px] place-items-center rounded-[7px] hover:bg-surface-2 disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="grid size-[30px] place-items-center rounded-[7px] bg-gold-soft font-semibold text-gold-ink">{meta.page}</span>
            <span>/ {meta.totalPages}</span>
            <button
              type="button"
              aria-label="Trang sau"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPage(meta.page + 1)}
              className="grid size-[30px] place-items-center rounded-[7px] hover:bg-surface-2 disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
