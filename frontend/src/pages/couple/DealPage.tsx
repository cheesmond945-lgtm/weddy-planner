import { Link, useParams, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useService } from '@/features/catalog/hooks'
import { useOrder } from '@/features/orders/hooks'
import { DepositView } from '@/features/payments/components/DepositView'
import { usePlan } from '@/features/weddings/hooks'
import { paths } from '@/routes/paths'

/** Trang thanh toán cọc cho một đơn (7.3). URL: /plan/deal/:orderId, cổng VNPay quay về kèm ?vnp_ResponseCode=. */
export default function DealPage() {
  const { dealId = '' } = useParams()
  const [params] = useSearchParams()
  const order = useOrder(dealId)
  const service = useService(order.data?.serviceId ?? '')
  const { data: plan } = usePlan()

  if (order.isError) {
    return (
      <EmptyState
        title="Chưa có đơn dịch vụ cần thanh toán"
        description={order.error.message}
        action={
          <Button asChild variant="outline">
            <Link to={paths.plan}>Về kế hoạch</Link>
          </Button>
        }
      />
    )
  }
  if (!order.data || !service.data) return <div className="h-[360px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải" />

  const planStatus = plan?.items.find((i) => i.id === order.data.planItemId)?.status ?? null
  return <DepositView order={order.data} service={service.data} planStatus={planStatus} returnCode={params.get('vnp_ResponseCode')} />
}
