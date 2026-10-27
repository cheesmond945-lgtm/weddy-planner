import { Ban, CheckCheck, ChevronLeft, ChevronRight, Copy, Eye, FilePen, FileText, Pencil, type LucideIcon } from 'lucide-react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { PersonAvatar } from '@/features/vendorChat/preview'
import { RowMenu, type RowMenuItem } from '@/features/vendorPackages/components/RowMenu'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PageMeta } from '@/types/api'
import type { Order } from '@/types/vendorOrder'
import { actionsOf, mainActionKey, type ActionKey } from '../actions'
import { formatDM } from '../calc'
import { attentionOf, countdownText, msToDeadline, URGENT_HOURS } from '../summary'
import { OrderStatusBadge } from './OrderBadges'

const ICON: Record<ActionKey, LucideIcon> = {
  view: Eye,
  continue: FilePen,
  resend: Pencil,
  edit: Pencil,
  again: Copy,
  complete: CheckCheck,
  invoice: FileText,
  viewInvoice: FileText,
  cancel: Ban,
}

/*
 * Bảng đơn: từ 1280px đủ 7 cột; 1100 đến 1279px ẩn cột Ngày (ngày xuống dòng phụ dưới tên khách); dưới 1100px là danh sách thẻ.
 * Bảng không cuộn ngang: cột chia theo %, nội dung không xuống dòng.
 */
const th = 'border-y border-line bg-surface-2 px-2.5 py-3 text-left align-bottom text-[11px] leading-tight font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase first:pl-4 last:pr-4'
const td = 'border-b border-line px-2.5 py-3.5 align-middle text-[13px] leading-snug first:pl-4 last:pr-4'
const dateCol = 'max-[1279px]:hidden'

/** Vạch màu bên trái dòng: cần xử lý (vàng), sắp hết hạn cọc (đỏ). */
const ACCENT = {
  warn: 'shadow-[inset_3px_0_var(--gold)]',
  danger: 'shadow-[inset_3px_0_var(--warn)]',
}

/** Chặn bấm nút (hoặc phím) lan lên dòng/thẻ: bấm dòng mở chi tiết, nhưng nút bên trong có việc riêng. */
const stop = {
  onClick: (e: MouseEvent) => e.stopPropagation(),
  onKeyDown: (e: KeyboardEvent) => e.stopPropagation(),
}

/** Pill đếm ngược hạn cọc của đơn Pending (đỏ khi còn dưới 6 giờ). */
function Countdown({ order: o }: { order: Order }) {
  const ms = msToDeadline(o)
  if (ms === null) return null
  const urgent = ms < URGENT_HOURS * 3_600_000
  return <Badge tone={urgent ? 'warn' : 'wait'}>{countdownText(ms)}</Badge>
}

/** Dòng 2 của cột Đặt cọc: thanh tiến độ mảnh + "Đã cọc 26/10" hoặc "Chưa cọc"; bản nháp chỉ ghi "Chưa gửi". */
function DepositProgress({ order: o }: { order: Order }) {
  if (o.status === 'Draft') return <span className="text-[12px] text-muted-foreground">Chưa gửi</span>
  const paidDate = o.payment?.status === 'Paid' ? o.payment.paidDate : null
  const dead = o.status === 'Expired'
  return (
    <span className="flex items-center gap-1.5 text-[12px] whitespace-nowrap">
      <span aria-hidden className="h-1 w-8 flex-none overflow-hidden rounded-pill bg-line">
        <span className={cn('block h-full rounded-pill', paidDate ? 'w-full bg-sage' : dead ? 'w-0' : 'w-full bg-gold/40')} />
      </span>
      {paidDate ? <span className="font-medium text-sage">Đã cọc {formatDM(paidDate)}</span> : <span className={dead ? 'text-muted-foreground' : 'font-medium text-gold-ink'}>Chưa cọc</span>}
    </span>
  )
}

/** Nút chính (chỉ đơn cần NCC xử lý, cùng cỡ, nền vàng) và menu "…" ở mọi dòng (Xem chi tiết + thao tác còn lại). */
function RowActions({ order: o, busy, onRun, chevron }: { order: Order; busy: boolean; onRun: (key: ActionKey, order: Order) => void; chevron?: boolean }) {
  const actions = actionsOf(o, { withView: true })
  const mainKey = mainActionKey(o)
  const main = actions.find((a) => a.key === mainKey)
  const menu: RowMenuItem[] = actions
    .filter((a) => a.key !== mainKey)
    .map((a) => ({
      label: a.label,
      icon: ICON[a.key],
      danger: a.danger,
      onClick: () => onRun(a.key, o),
    }))
  return (
    <div className="flex items-center justify-end gap-1" {...stop}>
      <span className="flex h-8 w-[92px] flex-none justify-end">
        {main && (
          <Button size="sm" className="h-8 w-full px-1 text-[12px]" disabled={busy && main.key === 'complete'} onClick={() => onRun(main.key, o)}>
            {main.label}
          </Button>
        )}
      </span>
      <RowMenu label={o.orderCode} items={menu} />
      {chevron && <ChevronRight aria-hidden className="size-4 flex-none text-muted-foreground/50 max-[1279px]:hidden" />}
    </div>
  )
}

interface OrdersTableProps {
  orders: Order[]
  meta: PageMeta
  busy: boolean
  onOpen: (orderId: string) => void
  onRun: (key: ActionKey, order: Order) => void
  onPage: (page: number) => void
}

/** Bảng đơn (màn rộng) và danh sách thẻ rút gọn (màn nhỏ), cùng nguồn dữ liệu và thao tác với thẻ đơn trong chat. */
export function OrdersTable({ orders, meta, busy, onOpen, onRun, onPage }: OrdersTableProps) {
  return (
    <>
      <div className="max-[1099px]:hidden">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[11%] max-[1279px]:w-[13.5%]" />
            <col className="w-[21%] max-[1279px]:w-[21.5%]" />
            <col className={cn('w-[9.5%]', dateCol)} />
            <col className="w-[11.5%] max-[1279px]:w-[13%]" />
            <col className="w-[17%] max-[1279px]:w-[19%]" />
            <col className="w-[14%] max-[1279px]:w-[16%]" />
            <col className="w-[16%] max-[1279px]:w-[17%]" />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>Mã đơn</th>
              <th className={th}>Khách</th>
              <th className={cn(th, dateCol)}>Ngày thực hiện</th>
              <th className={cn(th, 'text-right')}>Tổng giá trị</th>
              <th className={th}>Đặt cọc</th>
              <th className={th}>Trạng thái đơn</th>
              <th className={th} />
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
                  <td className={cn(td, 'whitespace-nowrap', dateCol)}>{formatDate(o.eventDate)}</td>
                  <td className={cn(td, 'text-right font-semibold whitespace-nowrap tabular-nums')}>{formatMoney(o.totalAmount)}</td>
                  <td className={td}>
                    <span className="block whitespace-nowrap tabular-nums">
                      <b className="font-semibold">{o.depositPercent}%</b> <span className="text-muted-foreground">·</span> {formatMoney(o.depositAmount)}
                    </span>
                    <span className="mt-1.5 block">
                      <DepositProgress order={o} />
                    </span>
                  </td>
                  <td className={td}>
                    <span className="flex flex-col items-start gap-1.5">
                      <OrderStatusBadge status={o.status} compact />
                      {o.status === 'Pending' && o.depositDueDate && <Countdown order={o} />}
                    </span>
                  </td>
                  <td className={td}>
                    <RowActions order={o} busy={busy} onRun={onRun} chevron />
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
                    <span className="block whitespace-nowrap text-muted-foreground tabular-nums">
                      Cọc {o.depositPercent}% · {formatMoney(o.depositAmount)}
                    </span>
                    <span className="mt-1.5 block">
                      <DepositProgress order={o} />
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-2">
                    {o.status === 'Pending' && <Countdown order={o} />}
                    <RowActions order={o} busy={busy} onRun={onRun} />
                  </span>
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
