import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { FormError } from '@/components/FormField'
import { VietqrPanel } from '@/components/VietqrPanel'
import { Button } from '@/components/ui/button'
import { paymentsApi } from '@/api/orders'
import { DepositTermsDialog } from '@/features/orders/components/DepositTermsDialog'
import { useCreateDeposit } from '@/features/orders/hooks'
import { useRefreshPlanning, useTimeline, useWedding } from '@/features/weddings/hooks'
import { PLAN_STATUS } from '@/features/weddings/status'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import type { ServiceDetail } from '@/types/catalog'
import type { Order } from '@/types/order'
import type { PlanItemStatus } from '@/types/wedding'

interface DepositViewProps {
  order: Order
  service: ServiceDetail
  planStatus: PlanItemStatus | null
}

/** Thanh toán cọc / Đặt cọc thành công (renderDeal trong prototype). */
export function DepositView({ order, service, planStatus }: DepositViewProps) {
  const navigate = useNavigate()
  const backToChat = () => navigate(`${paths.chat}?c=${order.conversationId}`)
  const paid = order.status === 'PAID'

  const summary = (
    <aside className="rounded-lg border border-line bg-surface p-[22px]">
      <span className="text-xs font-medium text-gold">{service.category.name}</span>
      <h3 className="mt-1 mb-3 text-xl">{service.name}</h3>
      {(
        [
          ['Đơn dịch vụ', order.code],
          ['Gói', order.packageName],
          ['Ngày thực hiện', formatDate(order.serviceDate)],
          ['Tổng giá trị', formatMoney(order.totalAmount)],
          ['Cần cọc trước', formatMoney(order.depositAmount)],
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
          ) : service.paused ? (
            <p>Nhà cung cấp tạm ngừng nhận đơn mới nên chưa đặt cọc được đơn này. Bạn có thể nhắn tin cho Everly để được hỗ trợ.</p>
          ) : order.status !== 'SENT' ? (
            <p>Đơn đang chờ nhà cung cấp chỉnh sửa, chưa thanh toán được. Quay lại tin nhắn để xem đơn mới nhất.</p>
          ) : (
            <PayForm order={order} service={service} onBackToChat={backToChat} />
          )}
        </div>
        {summary}
      </div>
    </>
  )
}

function PayForm({ order, service, onBackToChat }: { order: Order; service: ServiceDetail; onBackToChat: () => void }) {
  const create = useCreateDeposit()
  const refresh = useRefreshPlanning()
  const [agreed, setAgreed] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md bg-sage-soft px-3.5 py-3 text-sm text-sage">
        Đơn dịch vụ do {service.name} gửi trong khung chat. Bạn kiểm tra lại thông tin bên phải trước khi thanh toán.
      </div>
      {create.isPending || create.data ? (
        <>
          <h2 className="text-base font-semibold">Chuyển khoản {formatMoney(order.depositAmount)} qua VietQR</h2>
          {create.data ? (
            <VietqrPanel info={create.data} check={() => paymentsApi.checkDeposit(order.id)} onPaid={() => void refresh()} />
          ) : (
            <div className="h-[220px] animate-pulse rounded-md bg-muted" aria-busy="true" aria-label="Đang tạo mã QR" />
          )}
        </>
      ) : (
        <>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-[3px] accent-primary" />
            <span>
              Tôi đã đọc và đồng ý{' '}
              <button type="button" className="font-medium text-gold underline underline-offset-2" onClick={() => setTermsOpen(true)}>
                Điều khoản đặt dịch vụ
              </button>
            </span>
          </label>
          {create.isError && <FormError message={create.error.message} />}
          <Button className="w-full sm:w-fit" disabled={!agreed} onClick={() => create.mutate(order.id)}>
            Thanh toán cọc {formatMoney(order.depositAmount)}
          </Button>
        </>
      )}
      <p className="text-[13px] text-muted-foreground">
        Sau khi nhận được tiền, WebPlan ghi nhận cọc, đổi trạng thái dịch vụ thành đã chốt và tạo timeline chi tiết.
      </p>
      <DepositTermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
      <div className="mt-1 flex flex-wrap justify-end gap-2.5">
        <Button variant="outline" onClick={onBackToChat}>
          Quay lại tin nhắn
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
  const [termsOpen, setTermsOpen] = useState(false)

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
      <div className="mt-4 border-t border-line pt-3 text-[13px]">
        <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-ink" onClick={() => setTermsOpen(true)}>
          Điều khoản đặt dịch vụ
        </button>
      </div>
      <DepositTermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
    </>
  )
}
