import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { FormError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { useCreateDeposit } from '@/features/orders/hooks'
import { depositDeadline } from '@/features/vendorOrders/calc'
import { useRefreshPlanning, useTimeline, useWedding } from '@/features/weddings/hooks'
import { PLAN_STATUS } from '@/features/weddings/status'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import type { ServiceDetail } from '@/types/catalog'
import type { Order, PaymentMethod } from '@/types/order'
import type { PlanItemStatus } from '@/types/wedding'

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'VNPAY_QR', label: 'VNPay QR' },
  { value: 'VNPAY_ATM', label: 'Thẻ ATM nội địa qua VNPay' },
  { value: 'INTERNATIONAL_CARD', label: 'Thẻ quốc tế' },
]

interface DepositViewProps {
  order: Order
  service: ServiceDetail
  planStatus: PlanItemStatus | null
  /** Mã kết quả VNPay trên URL quay về (00 = thành công) */
  returnCode: string | null
  /** Lý do không thành công backend trả về khi xác nhận kết quả VNPay (hủy, hết thời gian, sai chữ ký…) */
  failMessage?: string | null
}

/** Thanh toán cọc / Đặt cọc thành công (renderDeal trong prototype). */
export function DepositView({ order, service, planStatus, returnCode, failMessage }: DepositViewProps) {
  const navigate = useNavigate()
  const backToChat = () => navigate(`${paths.chat}?c=${order.conversationId}`)
  const paid = order.status === 'Deposited' || order.status === 'Completed'
  const overdue = order.status === 'Pending' && !!order.depositDueDate && new Date(order.depositDueDate).getTime() <= Date.now()
  const failed = !paid && ((returnCode !== null && returnCode !== '00') || !!failMessage) ? (failMessage ?? 'Thanh toán chưa thành công.') : null

  const summary = (
    <aside className="rounded-lg border border-line bg-surface p-[22px]">
      <span className="text-xs font-medium text-gold">{service.category.name}</span>
      <h3 className="mt-1 mb-3 text-xl">{service.name}</h3>
      {(
        [
          ['Đơn dịch vụ', order.orderCode],
          ['Nhà cung cấp', order.vendorName ?? service.name],
          ['Hạng mục', order.items.length > 1 ? `${order.items[0]?.itemName} và ${order.items.length - 1} hạng mục khác` : (order.items[0]?.itemName ?? '—')],
          ['Ngày thực hiện', formatDate(order.eventDate)],
          ['Tổng giá trị', formatMoney(order.totalAmount)],
          [`Cần cọc trước (${Math.round(order.depositPercent * 100) / 100}%)`, formatMoney(order.depositAmount)],
          ...(order.status === 'Pending' && order.depositDueDate ? ([['Hạn đặt cọc', depositDeadline(order.depositDueDate).replace('Hạn cọc: ', '')]] as const) : []),
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 border-b border-line py-[9px]">
          <span className="text-muted-foreground">{label}</span>
          <b className="text-right font-semibold">{value}</b>
        </div>
      ))}
      {planStatus && (
        <div className="mt-3">
          <Badge tone={PLAN_STATUS[planStatus].tone}>{PLAN_STATUS[planStatus].label}</Badge>
        </div>
      )}
    </aside>
  )

  return (
    <>
      <Button variant="outline" className="mb-[18px]" onClick={backToChat}>
        Quay lại tin nhắn
      </Button>
      <h1 className="mb-[22px] text-[clamp(24px,3.6vw,34px)] leading-[1.15]">{paid ? 'Đặt cọc thành công' : 'Thanh toán cọc'}</h1>
      <div className="grid grid-cols-[1.5fr_1fr] items-start gap-[22px] max-[860px]:grid-cols-1">
        <div className="rounded-lg border border-line bg-surface p-[22px]">
          {paid ? (
            <PaidBody order={order} service={service} onBackToChat={backToChat} />
          ) : order.status === 'Pending' ? (
            <PayForm order={order} service={service} failed={failed} overdue={overdue} onBackToChat={backToChat} />
          ) : (
            <p>
              {order.status === 'NeedRevision'
                ? 'Đơn đang chờ nhà cung cấp chỉnh sửa, chưa thanh toán được. Quay lại tin nhắn để xem đơn mới nhất.'
                : order.status === 'Expired'
                  ? 'Đơn đã hết hạn đặt cọc. Nhắn nhà cung cấp nếu bạn vẫn muốn đặt.'
                  : 'Đơn này không còn thanh toán cọc được. Quay lại tin nhắn để xem đơn mới nhất.'}
            </p>
          )}
        </div>
        {summary}
      </div>
    </>
  )
}

function PayForm({ order, service, failed, overdue, onBackToChat }: { order: Order; service: ServiceDetail; failed: string | null; overdue: boolean; onBackToChat: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('VNPAY_QR')
  const create = useCreateDeposit()
  const navigate = useNavigate()
  const refresh = useRefreshPlanning()

  function pay() {
    create.mutate(
      { orderId: order.id, method },
      {
        onSuccess: async ({ paymentUrl }) => {
          // Thật: chuyển sang cổng VNPay, VNPay đưa người dùng quay về trang này kèm mã kết quả
          if (/^https?:\/\//.test(paymentUrl)) {
            window.location.assign(paymentUrl)
            return
          }
          await refresh()
          navigate(paymentUrl, { replace: true })
          window.scrollTo(0, 0)
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md bg-sage-soft px-3.5 py-3 text-sm text-sage">
        Đơn dịch vụ do {service.name} gửi trong khung chat. Bạn kiểm tra lại thông tin bên phải trước khi thanh toán.
      </div>
      {overdue && <div className="rounded-md bg-warn-soft px-4 py-3 font-medium text-warn">Đơn đã hết hạn đặt cọc.</div>}
      {failed && <div className="rounded-md bg-warn-soft px-4 py-3 font-medium text-warn">{failed} Bạn có thể thử lại.</div>}
      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-medium">Phương thức thanh toán</legend>
        <div className="flex flex-col gap-2.5">
          {METHODS.map((m) => (
            <label key={m.value} className="inline-flex cursor-pointer items-center gap-[7px] text-sm">
              <input type="radio" name="deposit-method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} className="accent-primary" />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-[13px] text-muted-foreground">
        Sau khi thanh toán thành công, WebPlan ghi nhận cọc, đổi trạng thái dịch vụ thành đã chốt và tạo timeline chi tiết.
      </p>
      <FormError message={create.error?.message} />
      <div className="mt-1 flex flex-wrap justify-end gap-2.5">
        <Button variant="outline" onClick={onBackToChat}>
          Quay lại tin nhắn
        </Button>
        <Button onClick={pay} disabled={create.isPending || overdue}>
          {create.isPending ? 'Đang xử lý thanh toán' : overdue ? 'Đã quá hạn đặt cọc' : `Thanh toán ${formatMoney(order.depositAmount)}`}
        </Button>
      </div>
    </div>
  )
}

function PaidBody({ order, service, onBackToChat }: { order: Order; service: ServiceDetail; onBackToChat: () => void }) {
  const navigate = useNavigate()
  const { data: wedding } = useWedding()
  const { data: timeline } = useTimeline(!!wedding)
  const taskCount = timeline?.items.filter((i) => i.kind === 'SERVICE_TASK' && i.category?.slug === service.category.slug).length
  const cat = service.category.name.toLowerCase()

  return (
    <>
      <p>
        Đã ghi nhận cọc <b className="font-semibold">{formatMoney(order.depositAmount)}</b> cho <b className="font-semibold">{service.name}</b>.
      </p>
      <p className="mt-2 text-muted-foreground">
        {taskCount ? `Timeline chi tiết của hạng mục ${cat} đã được tạo với ${taskCount} việc cần làm.` : `Việc chi tiết của hạng mục ${cat} đã mở trong timeline.`}
      </p>
      <p className="mt-2 text-muted-foreground">
        Phần còn lại <b className="font-semibold text-ink">{formatMoney(order.totalAmount - order.depositAmount)}</b> thanh toán trực tiếp cho nhà cung cấp theo thỏa thuận.
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <Button variant="outline" onClick={onBackToChat}>
          Về tin nhắn
        </Button>
        <Button onClick={() => navigate(`${paths.timeline}?category=${service.category.slug}`)}>Xem timeline chi tiết</Button>
      </div>
    </>
  )
}
