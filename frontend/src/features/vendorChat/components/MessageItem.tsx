import { Check, CreditCard, MessageSquare, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { currentVersion, formatStamp } from '@/features/serviceOrders/calc'
import { AdjustmentCard, OrderCard } from '@/features/serviceOrders/components/OrderCard'
import { cn } from '@/lib/utils'
import type { ServiceOrder } from '@/types/serviceOrder'
import type { VendorMessage } from '@/types/vendorChat'

export interface MessageActions {
  onViewOrder: (order: ServiceOrder, version: number) => void
  onEditOrder: (order: ServiceOrder) => void
  onViewAdjustment: (order: ServiceOrder, adjustmentId: string) => void
}

interface MessageItemProps extends MessageActions {
  message: VendorMessage
  order: ServiceOrder | undefined
  /** Đơn vừa gửi: làm nổi thẻ phiên bản mới nhất */
  highlightOrderId: string | null
}

const Time = ({ at }: { at: string }) => <time className="mt-1 text-[11px] text-muted-foreground">{formatStamp(at)}</time>

/** Khung tin: của NCC bên phải, của khách bên trái; thẻ đơn rộng tối đa 440px. */
function Bubble({ mine, wide, at, children }: { mine: boolean; wide?: boolean; at: string; children: ReactNode }) {
  return (
    <div className={cn('grid max-w-[72%] max-sm:max-w-[88%]', mine ? 'self-end justify-items-end' : 'self-start', wide && 'w-full max-w-[min(440px,92%)] max-sm:max-w-full')}>
      {children}
      <Time at={at} />
    </div>
  )
}

/** Ô yêu cầu của khách (req-card): viền đỏ khi còn chờ NCC xử lý. */
function RequestCard({ active, title, text, note }: { active: boolean; title: ReactNode; text: string; note?: string }) {
  return (
    <div className={cn('grid gap-2 rounded-lg border border-l-[3px] border-line bg-surface px-3.5 py-3', active ? 'border-l-warn' : 'border-l-line-strong')}>
      <p className={cn('flex items-center gap-1.5 text-[12.5px]', active ? 'text-warn' : 'text-muted-foreground')}>
        <MessageSquare className="size-3.5" />
        {title}
      </p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      {note && <p className="text-[12.5px] text-muted-foreground">{note}</p>}
    </div>
  )
}

/** Sự kiện ở giữa khung chat (khách xác nhận, thanh toán…). */
function Event({ tone, icon, children, at }: { tone: 'ok' | 'pay'; icon: ReactNode; children: ReactNode; at: string }) {
  return (
    <div
      className={cn(
        'flex max-w-[94%] flex-wrap items-center justify-center gap-x-2 gap-y-0.5 self-center rounded-2xl border px-3.5 py-[7px] text-center text-[12.5px] [&>svg]:size-3.5',
        tone === 'ok' ? 'border-transparent bg-sage-soft text-sage' : 'border-line bg-surface text-sage',
      )}
    >
      {icon}
      <span>{children}</span>
      <span className="text-[11.5px] text-muted-foreground">{formatStamp(at)}</span>
    </div>
  )
}

/** Một tin trong khung chat, theo loại (MessageView trong prototype NCC). */
export function MessageItem({ message: m, order, highlightOrderId, onViewOrder, onEditOrder, onViewAdjustment }: MessageItemProps) {
  const mine = m.sender === 'VENDOR'
  const code = <b>{order?.code ?? ''}</b>

  switch (m.type) {
    case 'ORDER': {
      if (!order || m.orderVersion === null) break
      const latest = currentVersion(order)?.version === m.orderVersion
      return (
        <Bubble mine wide at={m.createdAt}>
          <OrderCard
            order={order}
            version={m.orderVersion}
            highlight={latest && highlightOrderId === order.id}
            onView={(v) => onViewOrder(order, v)}
            onEdit={() => onEditOrder(order)}
            onViewAdjustment={(id) => onViewAdjustment(order, id)}
          />
        </Bubble>
      )
    }
    case 'ADJUSTMENT_PROPOSED':
      if (!order || !m.adjustmentId) break
      return (
        <Bubble mine wide at={m.createdAt}>
          <AdjustmentCard order={order} adjustmentId={m.adjustmentId} onView={(id) => onViewAdjustment(order, id)} />
        </Bubble>
      )
    case 'ORDER_REVISION_REQUESTED': {
      const cur = order && currentVersion(order)
      const active = !!order && order.status === 'REVISION_REQUESTED' && order.revisionRequest?.version === m.orderVersion && cur?.version === m.orderVersion
      const resolvedBy = order?.versions.find((v) => v.version > (m.orderVersion ?? 0))?.version
      return (
        <Bubble mine={false} wide at={m.createdAt}>
          <RequestCard
            active={active}
            title={
              <>
                Yêu cầu chỉnh sửa đơn {code} · v{m.orderVersion}
              </>
            }
            text={m.text}
            note={active ? 'Đang chờ bạn chỉnh sửa, dùng nút “Chỉnh sửa đơn” trên thẻ đơn.' : resolvedBy ? `Đã xử lý, gửi lại v${resolvedBy}` : cur ? `Đơn hiện ở v${cur.version}` : undefined}
          />
        </Bubble>
      )
    }
    case 'ADJUSTMENT_REQUESTED':
      return (
        <Bubble mine={false} wide at={m.createdAt}>
          <RequestCard
            active={!!order?.adjustmentRequest}
            title={<>Yêu cầu điều chỉnh đơn {code}</>}
            text={m.text}
            note={order?.adjustmentRequest ? 'Đơn hiện hành chưa thay đổi, lập phương án ở Quản lý đơn hàng.' : 'Đã lập phương án điều chỉnh.'}
          />
        </Bubble>
      )
    case 'ADJUSTMENT_REVISION_REQUESTED': {
      const active = order?.adjustments.find((a) => a.id === m.adjustmentId)?.status === 'REVISION_REQUESTED'
      return (
        <Bubble mine={false} wide at={m.createdAt}>
          <RequestCard active={active} title={<>Yêu cầu sửa phương án {code}</>} text={m.text} />
        </Bubble>
      )
    }
    case 'ORDER_CONFIRMED':
      return (
        <Event tone="ok" icon={<Check />} at={m.createdAt}>
          Khách đã xác nhận đơn {code} · v{m.orderVersion}
        </Event>
      )
    case 'ADJUSTMENT_ACCEPTED':
      return (
        <Event tone="ok" icon={<Check />} at={m.createdAt}>
          Khách đồng ý điều chỉnh {code}, v{m.orderVersion} có hiệu lực
        </Event>
      )
    case 'PAYMENT_RECORDED':
      return (
        <Event tone="pay" icon={<CreditCard />} at={m.createdAt}>
          {m.text}
        </Event>
      )
    case 'ORDER_RESENT':
      return (
        <div className="self-stretch rounded-lg bg-info-soft px-3.5 py-2.5 text-left text-[12.5px] text-ink">
          <p className="flex flex-wrap items-center gap-1.5 text-info">
            <RefreshCw className="size-3.5" />
            Bạn đã cập nhật và gửi lại đơn {code} · v{m.orderVersion}
            <span className="text-[11.5px] text-muted-foreground">{formatStamp(m.createdAt)}</span>
          </p>
          {!!m.changes?.length && (
            <ul className="mt-1.5 grid list-disc gap-0.5 pl-[22px] text-[13px]">
              {m.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )
  }

  return (
    <Bubble mine={mine} at={m.createdAt}>
      <div
        className={cn(
          'rounded-[14px] border px-[15px] py-[11px] text-[13.5px] leading-relaxed whitespace-pre-wrap',
          mine ? 'rounded-br-[4px] border-side-border bg-(image:--side-grad) text-side-ink' : 'rounded-bl-[4px] border-line bg-surface',
        )}
      >
        {m.text}
      </div>
    </Bubble>
  )
}
