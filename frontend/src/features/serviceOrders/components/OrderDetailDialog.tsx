import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { formatMoney, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderAdjustment, OrderContent, ServiceOrder } from '@/types/serviceOrder'
import { currentVersion, diffContent, filledLines, formatDay, formatStamp, lineAmount, totalOf } from '../calc'
import { ADJUSTMENT_STATUS, ORDER_STATUS, PAYMENT_METHOD_LABEL, PAYMENT_STATUS } from '../constants'
import { StatusBadge } from './OrderBadges'
import { PanelDialog } from './PanelDialog'

const H = ({ children }: { children: ReactNode }) => (
  <h4 className="mt-[22px] mb-2.5 font-sans text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{children}</h4>
)
const th = 'border-y border-line bg-surface-2 px-3 py-2 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
const td = 'border-b border-line px-3 py-2.5 align-top text-[13.5px]'
const num = 'text-right tabular-nums whitespace-nowrap'

export function LinesTable({ content }: { content: OrderContent }) {
  const lines = filledLines(content.lines)
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>STT</th>
              <th className={th}>Hạng mục</th>
              <th className={th}>ĐVT</th>
              <th className={cn(th, 'text-right')}>SL</th>
              <th className={cn(th, 'text-right')}>Đơn giá</th>
              <th className={cn(th, 'text-right')}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} className={cn(l.isPolicyFee && 'bg-gold-soft')}>
                <td className={td}>{i + 1}</td>
                <td className={td}>
                  {l.name}
                  {l.isPolicyFee && <span className="ml-1.5 inline-block rounded-pill bg-gold-soft px-2 text-[11px] text-gold-ink">Phí theo chính sách</span>}
                </td>
                <td className={td}>{l.unit}</td>
                <td className={cn(td, num)}>{formatNumber(l.quantity)}</td>
                <td className={cn(td, num)}>{formatMoney(l.unitPrice)}</td>
                <td className={cn(td, num, 'font-semibold')}>{formatMoney(lineAmount(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-baseline justify-end gap-4 px-3.5 py-3">
        <span className="text-[13.5px] text-muted-foreground">Tổng giá trị đơn</span>
        <strong className="text-xl font-bold text-gold-ink tabular-nums">{formatMoney(totalOf(content.lines))}</strong>
      </div>
    </div>
  )
}

export function InstallmentsTable({ content }: { content: OrderContent }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Đợt thanh toán</th>
            <th className={cn(th, 'text-right')}>Tỷ lệ</th>
            <th className={cn(th, 'text-right')}>Số tiền</th>
            <th className={th}>Hạn</th>
            <th className={th}>Phương thức</th>
            <th className={th}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {content.installments.map((i) => (
            <tr key={i.id} className="last:[&>td]:border-b-0">
              <td className={td}>{i.name}</td>
              <td className={cn(td, num)}>{i.rate === null ? '—' : `${i.rate}%`}</td>
              <td className={cn(td, num, 'font-semibold')}>{formatMoney(i.amount)}</td>
              <td className={td}>{formatDay(i.dueDate)}</td>
              <td className={td}>{PAYMENT_METHOD_LABEL[i.method]}</td>
              <td className={cn(td, 'text-muted-foreground')}>{i.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Một phương án điều chỉnh: trạng thái, lý do, các thay đổi, tổng trước/sau (AdjustmentCompare trong prototype NCC). */
export function AdjustmentView({ adjustment: a }: { adjustment: OrderAdjustment }) {
  const changes = diffContent(a.before, a.after)
  const rest = a.afterTotal - a.paidAmount
  return (
    <div className="mb-3 grid gap-2 rounded-md border border-line p-3.5 text-[13.5px]">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <StatusBadge tone={ADJUSTMENT_STATUS[a.status].tone}>
          {a.status === 'ACCEPTED' && a.resultVersion ? `Khách đồng ý · v${a.resultVersion} có hiệu lực` : ADJUSTMENT_STATUS[a.status].label}
        </StatusBadge>
        <span className="text-[12.5px] text-muted-foreground">{formatStamp(a.proposedAt)}</span>
      </div>
      <p>
        <b>Lý do:</b> {a.reason}
      </p>
      {changes.length > 0 && (
        <ul className="grid list-disc gap-0.5 rounded-sm bg-info-soft py-2.5 pr-3 pl-7 text-[13px]">
          {changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <dl className="m-0 grid grid-cols-4 gap-2 max-sm:grid-cols-2">
        {[
          ['Tổng trước', formatMoney(a.beforeTotal)],
          ['Tổng sau', formatMoney(a.afterTotal)],
          ['Đã thu (giữ nguyên)', formatMoney(a.paidAmount)],
          [rest >= 0 ? 'Còn phải thu' : 'Thanh toán thừa', formatMoney(Math.abs(rest))],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">{k}</dt>
            <dd className="m-0 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {a.customerNote && (
        <p className="rounded-sm border-l-[3px] border-warn bg-warn-soft px-3 py-2">
          <b>Khách yêu cầu sửa phương án:</b> {a.customerNote}
        </p>
      )}
    </div>
  )
}

interface OrderDetailDialogProps {
  order: ServiceOrder
  /** Phiên bản mở sẵn; không có thì phiên bản hiện hành */
  version?: number | null
  onClose: () => void
  /** Nút thao tác thêm ở chân (trang Quản lý đơn hàng: ghi nhận thanh toán, điều chỉnh, hủy) */
  actions?: ReactNode
}

/** Xem chi tiết đơn (OrderDetail trong prototype NCC), chỉ xem. */
export function OrderDetailDialog({ order, version, onClose, actions }: OrderDetailDialogProps) {
  const current = currentVersion(order)
  const [v, setV] = useState(version ?? current?.version ?? null)
  const shown = order.versions.find((x) => x.version === v)
  const content = shown?.content ?? order.draft?.content
  if (!content) return null
  const replacedBy = shown && current && shown.version !== current.version ? order.versions.find((x) => x.version > shown.version)?.version : null
  const total = order.totalAmount
  const rest = total - order.paidAmount

  return (
    <PanelDialog
      open
      onRequestClose={onClose}
      title={`Đơn dịch vụ ${order.code}`}
      subtitle={shown ? `Phiên bản v${shown.version} · gửi lúc ${formatStamp(shown.sentAt)}` : 'Bản nháp, chưa gửi khách'}
      footer={
        <>
          {actions}
          <Button variant={actions ? 'outline' : 'default'} className={actions ? 'border-line-strong' : ''} onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      {order.cancellation && (
        <p className="mb-3 rounded-md border-l-[3px] border-warn bg-warn-soft px-3.5 py-2.5 text-[13.5px]">
          <b>Đã hủy lúc {formatStamp(order.cancellation.cancelledAt)}.</b> Lý do: {order.cancellation.reason}
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</StatusBadge>
          <StatusBadge tone={PAYMENT_STATUS[order.paymentStatus].tone}>{PAYMENT_STATUS[order.paymentStatus].label}</StatusBadge>
          {replacedBy && <StatusBadge tone="neutral">Đã thay thế bởi v{replacedBy}</StatusBadge>}
        </div>
        {order.versions.length > 1 && (
          <div role="tablist" aria-label="Phiên bản" className="inline-flex gap-1 rounded-[9px] border border-line bg-surface-2 p-[3px]">
            {order.versions.map((x) => (
              <button
                key={x.version}
                type="button"
                role="tab"
                aria-selected={x.version === v}
                onClick={() => setV(x.version)}
                className={cn('rounded-[7px] px-3 py-1.5 text-[12.5px] text-muted-foreground', x.version === v && 'bg-surface font-semibold text-ink shadow-soft')}
              >
                v{x.version}
                {x.version === current?.version ? ' · hiện hành' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {shown && shown.changes.length > 0 && (
        <div className="rounded-md bg-info-soft px-3.5 py-3 text-[13.5px]">
          <strong className="text-info">Thay đổi so với v{shown.version - 1}</strong>
          <ul className="mt-1.5 grid list-disc gap-0.5 pl-5">
            {shown.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <H>Khách hàng & sự kiện</H>
      <dl className="m-0 grid grid-cols-3 gap-x-[18px] gap-y-3 text-sm max-sm:grid-cols-1">
        <div>
          <dt className="mb-0.5 text-[11.5px] text-muted-foreground">Tên khách hàng</dt>
          <dd className="m-0">{content.customerName}</dd>
        </div>
        <div>
          <dt className="mb-0.5 text-[11.5px] text-muted-foreground">Số điện thoại</dt>
          <dd className="m-0 select-all">{content.customerPhone}</dd>
        </div>
        <div>
          <dt className="mb-0.5 text-[11.5px] text-muted-foreground">Ngày diễn ra sự kiện</dt>
          <dd className="m-0">{formatDay(content.eventDate)}</dd>
        </div>
        <div className="col-span-full">
          <dt className="mb-0.5 text-[11.5px] text-muted-foreground">Ghi chú gửi khách</dt>
          <dd className="m-0">{content.note || '—'}</dd>
        </div>
      </dl>

      <H>Báo giá chi tiết</H>
      <LinesTable content={content} />

      <H>Các đợt thanh toán</H>
      <InstallmentsTable content={content} />

      <H>Thanh toán thực tế</H>
      <div className="mb-3 grid grid-cols-3 gap-2.5 max-sm:grid-cols-1">
        {[
          ['Tổng hiện hành', formatMoney(total), ''],
          ['Đã thu (đã xác nhận)', formatMoney(order.paidAmount), 'text-sage'],
          [rest >= 0 ? 'Còn phải thu' : 'Thanh toán thừa · cần xử lý hoàn', formatMoney(Math.abs(rest)), rest < 0 ? 'text-warn' : ''],
        ].map(([k, val, tone]) => (
          <p key={k} className="grid gap-0.5 rounded-[9px] border border-line bg-surface-2 px-3 py-2.5 text-xs text-muted-foreground">
            <span>{k}</span>
            <strong className={cn('text-base text-ink tabular-nums', tone)}>{val}</strong>
          </p>
        ))}
      </div>
      {order.payments.length ? (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Đợt liên quan</th>
                <th className={cn(th, 'text-right')}>Số tiền</th>
                <th className={th}>Thời điểm</th>
                <th className={th}>Hình thức thanh toán</th>
                <th className={th}>Minh chứng</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.map((p) => (
                <tr key={p.id} className="last:[&>td]:border-b-0">
                  <td className={td}>{p.installmentName}</td>
                  <td className={cn(td, num, 'font-semibold')}>{formatMoney(p.amount)}</td>
                  <td className={td}>{formatStamp(p.paidAt)}</td>
                  <td className={td}>
                    {PAYMENT_METHOD_LABEL[p.method]}
                    <span className="block text-[12.5px] text-muted-foreground">{p.recordedBy === 'SYSTEM' ? 'Hệ thống ghi nhận' : 'NCC ghi nhận'}</span>
                    {p.plannedMethod !== p.method && <span className="block text-[12.5px] text-muted-foreground">Dự kiến: {PAYMENT_METHOD_LABEL[p.plannedMethod]}</span>}
                    {p.note && <span className="block text-[12.5px] text-muted-foreground">{p.note}</span>}
                  </td>
                  <td className={td}>
                    {p.proofFile ? (
                      p.proofFile.url ? (
                        <a href={p.proofFile.url} target="_blank" rel="noreferrer" className="text-gold-ink underline-offset-2 hover:underline">
                          {p.proofFile.fileName}
                        </a>
                      ) : (
                        p.proofFile.fileName
                      )
                    ) : (
                      <span className="text-muted-foreground">{p.recordedBy === 'SYSTEM' ? 'VNPay' : '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">Chưa ghi nhận khoản thu thực tế nào. Thiết lập lịch hay khách xác nhận đơn không tự ghi nhận đã nhận tiền.</p>
      )}

      {order.adjustments.length > 0 && (
        <>
          <H>Đề nghị điều chỉnh</H>
          {order.adjustments.map((a) => (
            <AdjustmentView key={a.id} adjustment={a} />
          ))}
        </>
      )}

      <H>Lịch sử</H>
      <ol className="m-0 grid list-none gap-3 border-l-2 border-line py-0 pl-4">
        {[...order.history].reverse().map((h, i) => (
          <li key={i} className="relative grid text-[13px] before:absolute before:top-[5px] before:-left-[22px] before:size-2.5 before:rounded-full before:bg-sage before:shadow-[0_0_0_3px_var(--surface)]">
            <strong className="font-medium">{h.text}</strong>
            <span className="text-xs text-muted-foreground">{formatStamp(h.at)}</span>
          </li>
        ))}
      </ol>
    </PanelDialog>
  )
}
