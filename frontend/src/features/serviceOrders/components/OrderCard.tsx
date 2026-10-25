import { ArrowUpRight, Eye, FileText, MessageSquare, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { ServiceOrder } from '@/types/serviceOrder'
import { currentVersion, formatDay, headlineOf, totalOf } from '../calc'
import { ADJUSTMENT_STATUS, adjustmentStateOf, PAYMENT_METHOD_LABEL } from '../constants'
import { OrderStatusBadge, StatusBadge } from './OrderBadges'

/** Trang Quản lý đơn hàng, mở sẵn đơn; action mở luôn hộp ghi nhận thanh toán / lập phương án điều chỉnh. */
export const orderPageHref = (o: Pick<ServiceOrder, 'id'>, action?: 'pay' | 'adjust') =>
  `${paths.vendor.orders}?order=${encodeURIComponent(o.id)}${action ? `&do=${action}` : ''}`

const Card = ({ old, highlight, children, ...rest }: { old?: boolean; highlight?: boolean; children: ReactNode; 'data-order'?: string }) => (
  <div
    {...rest}
    className={cn(
      'w-full overflow-hidden rounded-[22px] rounded-br-[5px] border border-line bg-surface text-left shadow-bubble transition-shadow',
      old && 'bg-surface-2 opacity-75',
      highlight && 'border-gold ring-4 ring-gold/25',
    )}
  >
    {children}
  </div>
)

function Head({ icon, title, chip, adjust }: { icon: ReactNode; title: ReactNode; chip?: ReactNode; adjust?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 px-3.5 py-3', adjust ? 'bg-info-soft' : 'bg-surface')}>
      <span className={cn('grid size-[30px] flex-none place-items-center rounded-sm [&_svg]:size-4', adjust ? 'bg-surface text-info' : 'bg-(image:--gold-grad) text-gold-on')}>{icon}</span>
      <div className="min-w-0 text-sm">
        <strong className="font-semibold">{title}</strong>
        {chip}
      </div>
    </div>
  )
}

const Ver = ({ children, green }: { children: ReactNode; green?: boolean }) => (
  <span className={cn('ml-2 inline-block rounded-pill border px-[7px] text-[11px] font-semibold', green ? 'border-sage bg-sage-soft text-sage' : 'border-gold bg-gold-soft/60 text-gold-ink')}>{children}</span>
)

/** Ô yêu cầu của khách trên thẻ (oc-req). */
const Request = ({ title, text }: { title: string; text: string }) => (
  <div className="mt-1.5 mb-1 rounded-md border-l-[3px] border-warn bg-warn-soft px-3 py-2.5 text-[13.5px] leading-relaxed">
    <p className="mb-1 flex items-center gap-1.5 text-[12.5px] text-warn">
      <MessageSquare className="size-3.5" />
      {title}
    </p>
    <p>{text}</p>
  </div>
)

function Facts({ items }: { items: [ReactNode, ReactNode, string?][] }) {
  return (
    <dl className="my-2.5 grid grid-cols-2 gap-x-3.5 gap-y-2">
      {items.map(([k, v, tone], i) => (
        <div key={i}>
          <dt className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">{k}</dt>
          <dd className={cn('m-0 mt-px text-[13.5px] tabular-nums', tone)}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const actionsCls = 'mt-1.5 flex flex-wrap gap-2 border-t border-line px-3.5 pt-2.5 pb-3.5 [&>*]:flex-[1_1_auto]'

interface OrderCardProps {
  order: ServiceOrder
  /** Phiên bản của thẻ này (thẻ cũ bị thay thế thì mờ đi) */
  version: number
  highlight?: boolean
  onView: (version: number) => void
  onEdit: () => void
  onViewAdjustment: (adjustmentId: string) => void
}

/** Thẻ đơn dịch vụ trong khung chat (OrderCard trong prototype NCC). */
export function OrderCard({ order, version, highlight, onView, onEdit, onViewAdjustment }: OrderCardProps) {
  const current = currentVersion(order)
  const shown = order.versions.find((v) => v.version === version)
  if (!shown || !current) return null
  const old = current.version !== version
  const c = shown.content
  const total = totalOf(c.lines)
  const deposit = c.installments[0]
  const headline = headlineOf(c)
  const confirmed = order.status === 'CONFIRMED'
  const adj = confirmed ? adjustmentStateOf(order) : null

  const btn = (label: string, onClick: () => void, opts: { primary?: boolean; icon?: ReactNode } = {}) => (
    <Button key={label} size="sm" variant={opts.primary ? 'default' : 'outline'} className={opts.primary ? '' : 'border-line-strong'} onClick={onClick}>
      {opts.icon}
      {label}
    </Button>
  )
  const toOrders = (label: string, primary?: boolean, action?: 'pay' | 'adjust') => (
    <Button key={label} asChild size="sm" variant={primary ? 'default' : 'outline'} className={primary ? '' : 'border-line-strong'}>
      <Link to={orderPageHref(order, action)}>
        {label}
        <ArrowUpRight />
      </Link>
    </Button>
  )

  let extra: ReactNode = null
  let actions: ReactNode[]
  const view = btn('Xem chi tiết', () => onView(version))
  if (old) actions = [btn('Xem phiên bản này', () => onView(version), { icon: <Eye /> })]
  else if (order.status === 'AWAITING_CONFIRMATION') actions = [view, btn('Chỉnh sửa đơn', onEdit, { icon: <Pencil /> })]
  else if (order.status === 'REVISION_REQUESTED') {
    if (order.revisionRequest) extra = <Request title={`Khách yêu cầu chỉnh sửa · v${order.revisionRequest.version}`} text={order.revisionRequest.note} />
    actions = [view, btn('Chỉnh sửa đơn', onEdit, { primary: true, icon: <Pencil /> })]
  } else if (adj?.kind === 'REQUESTED') {
    extra = <Request title="Khách yêu cầu điều chỉnh" text={order.adjustmentRequest!.note} />
    actions = [view, toOrders('Lập phương án điều chỉnh', true, 'adjust')]
  } else if (adj?.kind === 'AWAITING_CONFIRMATION') {
    extra = <p className="mb-1.5 rounded-[7px] bg-gold-soft px-2.5 py-1.5 text-[12.5px] text-gold-ink">Phương án điều chỉnh đang chờ khách xác nhận, đơn hiện hành giữ nguyên.</p>
    actions = [view, btn('Xem đề nghị', () => onViewAdjustment(adj.adjustment.id))]
  } else if (adj?.kind === 'REVISION_REQUESTED') {
    extra = <Request title="Khách yêu cầu sửa phương án" text={adj.adjustment.customerNote ?? ''} />
    actions = [view, toOrders('Sửa phương án', true, 'adjust')]
  } else if (confirmed) actions = [view, toOrders('Thanh toán & điều chỉnh')]
  else actions = [view]

  const showPaid = !old && confirmed && order.paidAmount > 0
  const rest = total - order.paidAmount

  return (
    <Card old={old} highlight={highlight} data-order={order.id}>
      <Head
        icon={<FileText />}
        title={`Đơn dịch vụ ${order.code}`}
        chip={
          <>
            <Ver>v{version}</Ver>
            {shown.fromAdjustmentId && <Ver green>sau điều chỉnh</Ver>}
          </>
        }
      />
      <div className="px-3.5 pt-2.5">
        {old ? (
          <StatusBadge tone="neutral">Đã thay thế bởi v{order.versions.find((v) => v.version > version)?.version}</StatusBadge>
        ) : (
          <OrderStatusBadge order={order} />
        )}
      </div>
      <div className="px-3.5 pt-2 pb-1">
        <p className="text-sm font-semibold">
          {headline.name}
          {headline.more > 0 && <span className="font-normal text-muted-foreground"> + {headline.more} hạng mục</span>}
        </p>
        <Facts
          items={[
            ['Ngày sự kiện', formatDay(c.eventDate)],
            ['Tổng giá trị', <strong className="font-semibold">{formatMoney(total)}</strong>],
            ...(deposit ? [['Đặt cọc', `${formatMoney(deposit.amount)} · ${PAYMENT_METHOD_LABEL[deposit.method]}`] as [ReactNode, ReactNode]] : []),
            ...(showPaid
              ? ([
                  ['Đã thu thực tế', formatMoney(order.paidAmount), 'text-sage'],
                  [rest >= 0 ? 'Còn phải thu' : 'Thu thừa · cần xử lý hoàn', formatMoney(Math.abs(rest)), rest < 0 ? 'text-warn' : ''],
                ] as [ReactNode, ReactNode, string][])
              : ([
                  [
                    'Còn lại theo lịch',
                    <>
                      {formatMoney(total - (deposit?.amount ?? 0))}
                      <span className="block text-[12px] text-muted-foreground">dự kiến sau khi thu đủ cọc</span>
                    </>,
                  ],
                ] as [ReactNode, ReactNode][])),
          ]}
        />
        {extra}
      </div>
      <div className={actionsCls}>{actions}</div>
    </Card>
  )
}

interface AdjustmentCardProps {
  order: ServiceOrder
  adjustmentId: string
  onView: (adjustmentId: string) => void
}

/** Thẻ phương án điều chỉnh trong khung chat (AdjustmentCard trong prototype NCC). */
export function AdjustmentCard({ order, adjustmentId, onView }: AdjustmentCardProps) {
  const a = order.adjustments.find((x) => x.id === adjustmentId)
  if (!a) return null
  const open = a.status === 'AWAITING_CONFIRMATION' || a.status === 'REVISION_REQUESTED'
  const rest = a.afterTotal - a.paidAmount
  return (
    <Card old={!open}>
      <Head adjust icon={<MessageSquare />} title={`${a.revisionOf ? 'Phương án điều chỉnh (sửa lại)' : 'Phương án điều chỉnh'} ${order.code}`} />
      <div className="px-3.5 pt-2.5">
        <StatusBadge tone={ADJUSTMENT_STATUS[a.status].tone}>
          {a.status === 'ACCEPTED' && a.resultVersion ? `Khách đồng ý · v${a.resultVersion} có hiệu lực` : ADJUSTMENT_STATUS[a.status].label}
        </StatusBadge>
      </div>
      <div className="px-3.5 pt-2 pb-1">
        <p className="text-[12.5px] text-muted-foreground">Lý do: {a.reason}</p>
        <Facts
          items={[
            ['Tổng trước', formatMoney(a.beforeTotal)],
            ['Tổng sau', <strong className="font-semibold">{formatMoney(a.afterTotal)}</strong>],
            ['Đã thu (giữ nguyên)', formatMoney(a.paidAmount)],
            [rest >= 0 ? 'Còn phải thu' : 'Thanh toán thừa', formatMoney(Math.abs(rest)), rest < 0 ? 'text-warn' : ''],
          ]}
        />
      </div>
      <div className={actionsCls}>
        <Button size="sm" variant="outline" className="border-line-strong" onClick={() => onView(a.id)}>
          Xem đề nghị
        </Button>
        {a.status === 'REVISION_REQUESTED' && (
          <Button asChild size="sm">
            <Link to={orderPageHref(order, 'adjust')}>
              Sửa phương án
              <ArrowUpRight />
            </Link>
          </Button>
        )}
      </div>
    </Card>
  )
}
