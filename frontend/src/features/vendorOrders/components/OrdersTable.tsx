import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/Badge'
import { PersonAvatar } from '@/features/vendorChat/preview'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PageMeta } from '@/types/api'
import type { Order } from '@/types/vendorOrder'
import { attentionOf, countdownText, msToDeadline, URGENT_HOURS } from '../summary'
import { LateProgressBadge, OrderStatusBadge, PaidInFullBadge } from './OrderBadges'
import { PaymentLines } from './PaymentLines'

/*
 * Bảng đơn: từ 1280px đủ 7 cột; 1100 đến 1279px ẩn cột Ngày (ngày xuống dòng phụ dưới tên khách); dưới 1100px là danh sách thẻ.
 * Bảng không cuộn ngang: cột chia theo %. Mỗi cột một ý:
 * Đơn hàng (mã), Khách hàng (tên · SĐT), Ngày thực hiện, Tổng giá trị, Thanh toán (2 đợt, chỉ số tiền và đã thu hay chưa), Trạng thái.
 */
const th = 'border-y border-line bg-surface-2 px-4 py-3 text-left align-bottom text-[11.5px] leading-tight font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase first:pl-5 last:pr-5'
const td = 'border-b border-line px-4 py-4 align-middle text-[13.5px] leading-snug first:pl-5 last:pr-5'
const dateCol = 'max-[1279px]:hidden'

/** Vạch màu bên trái dòng: cần xử lý (vàng), sắp hết hạn cọc (đỏ). */
const ACCENT = {
  warn: 'shadow-[inset_3px_0_var(--gold)]',
  danger: 'shadow-[inset_3px_0_var(--warn)]',
}

/** Pill đếm ngược hạn cọc của đơn Pending (đỏ khi còn dưới 6 giờ). */
function Countdown({ order: o }: { order: Order }) {
  const ms = msToDeadline(o)
  if (ms === null) return null
  const urgent = ms < URGENT_HOURS * 3_600_000
  return <Badge tone={urgent ? 'warn' : 'wait'}>{countdownText(ms)}</Badge>
}

interface OrdersTableProps {
  orders: Order[]
  meta: PageMeta
  onOpen: (orderId: string) => void
  onPage: (page: number) => void
}

/** Bảng đơn (màn rộng) và danh sách thẻ rút gọn (màn nhỏ), cùng nguồn dữ liệu và thao tác với thẻ đơn trong chat. */
export function OrdersTable({ orders, meta, onOpen, onPage }: OrdersTableProps) {
  return (
    <>
      <div className="max-[1099px]:hidden">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[14%] max-[1279px]:w-[16%]" />
            <col className="w-[22%] max-[1279px]:w-[25%]" />
            <col className={cn('w-[15%]', dateCol)} />
            <col className="w-[15%] max-[1279px]:w-[18%]" />
            <col className="w-[18%] max-[1279px]:w-[20%]" />
            <col className="w-[16%] max-[1279px]:w-[21%]" />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>Đơn hàng</th>
              <th className={th}>Khách hàng</th>
              <th className={cn(th, dateCol)}>Ngày thực hiện</th>
              <th className={th}>Tổng giá trị</th>
              <th className={th}>Thanh toán</th>
              <th className={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const accent = attentionOf(o)
              return (
                <tr
                  key={o.id}
                  tabIndex={0}
                  onClick={() => onOpen(o.id)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(o.id)}
                  className="cursor-pointer transition-colors outline-none last:[&>td]:border-b-0 hover:bg-bg focus-visible:bg-bg"
                >
                  <td className={cn(td, 'font-semibold whitespace-nowrap tabular-nums', accent && ACCENT[accent])}>{o.orderCode}</td>
                  <td className={td}>
                    <span className="flex items-center gap-2.5">
                      <PersonAvatar name={o.customerName} className="size-9 text-[11.5px] max-[1279px]:hidden" />
                      <span className="min-w-0">
                        <b className="block truncate font-semibold">{o.customerName}</b>
                        <span className="block truncate text-[12px] text-muted-foreground">{o.customerPhone || 'Chưa có SĐT'}</span>
                        <span className="hidden truncate text-[12px] text-muted-foreground max-[1279px]:block">Thực hiện {formatDate(o.eventDate)}</span>
                      </span>
                    </span>
                  </td>
                  <td className={cn(td, 'font-semibold whitespace-nowrap tabular-nums', dateCol)}>{formatDate(o.eventDate)}</td>
                  <td className={cn(td, 'font-semibold whitespace-nowrap tabular-nums')}>{formatMoney(o.totalAmount)}</td>
                  <td className={td}>
                    <span className="block">
                      <PaymentLines order={o} />
                    </span>
                  </td>
                  <td className={td}>
                    <span className="flex flex-col items-start gap-1.5">
                      <OrderStatusBadge status={o.status} compact />
                      <PaidInFullBadge order={o} />
                      <LateProgressBadge orderId={o.id} status={o.status} />
                      {o.status === 'Pending' && o.depositDueDate && <Countdown order={o} />}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Dưới 1100px: thẻ đơn rút gọn */}
      <ul className="grid gap-3 p-3.5 min-[1100px]:hidden">
        {orders.map((o) => {
          const accent = attentionOf(o)
          return (
            <li key={o.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(o.id)}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(o.id)}
                className={cn('cursor-pointer rounded-[18px] border border-line bg-surface p-4 shadow-bubble', accent && ACCENT[accent])}
              >
                <div className="flex items-start justify-between gap-2">
                  <b className="font-semibold tabular-nums">{o.orderCode}</b>
                  <span className="flex flex-wrap items-center justify-end gap-1.5">
                    <OrderStatusBadge status={o.status} compact />
                    <PaidInFullBadge order={o} />
                    <LateProgressBadge orderId={o.id} status={o.status} />
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <PersonAvatar name={o.customerName} className="size-9 text-[11.5px]" />
                  <span className="min-w-0">
                    <b className="block truncate text-[13.5px] font-semibold">{o.customerName}</b>
                    <span className="text-[12px] text-muted-foreground">Thực hiện {formatDate(o.eventDate)}</span>
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <span className="min-w-0 text-[13px]">
                    <b className="text-[15px] font-semibold tabular-nums">{formatMoney(o.totalAmount)}</b>
                    <span className="mt-1.5 block">
                      <PaymentLines order={o} />
                    </span>
                  </span>
                  {o.status === 'Pending' && <Countdown order={o} />}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {meta.totalPages > 1 && (
        <Pagination meta={meta} onPage={onPage}>
          Hiển thị {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} trên {meta.total} đơn
        </Pagination>
      )}
    </>
  )
}

function Pagination({ meta, onPage, children }: { meta: PageMeta; onPage: (p: number) => void; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted-foreground">
      <span>{children}</span>
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label="Trang trước"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          className="grid size-9 place-items-center rounded-full border border-line hover:bg-bg disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 tabular-nums">
          {meta.page} / {meta.totalPages}
        </span>
        <button
          type="button"
          aria-label="Trang sau"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          className="grid size-9 place-items-center rounded-full border border-line hover:bg-bg disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </span>
    </div>
  )
}
