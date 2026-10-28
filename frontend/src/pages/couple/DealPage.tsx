import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useService } from '@/features/catalog/hooks'
import { useConfirmDeposit, useOrder } from '@/features/orders/hooks'
import { DepositView } from '@/features/payments/components/DepositView'
import { usePlan } from '@/features/weddings/hooks'
import { paths } from '@/routes/paths'

/**
 * Trang thanh toán cọc cho một đơn (7.3). URL: /plan/deal/:orderId.
 * VNPay thật quay về kèm các tham số vnp_* (có vnp_SecureHash): gửi backend xác nhận một lần rồi bỏ khỏi URL.
 * Chế độ giả lập quay về kèm ?vnp_ResponseCode=00 (đã ghi nhận sẵn).
 */
export default function DealPage() {
  const { dealId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const order = useOrder(dealId)
  const service = useService(order.data?.serviceId ?? '')
  const { data: plan } = usePlan()
  const confirm = useConfirmDeposit()
  const sent = useRef(false)
  const fromVnpay = params.has('vnp_SecureHash')

  useEffect(() => {
    if (!fromVnpay || sent.current) return
    sent.current = true
    const query = Object.fromEntries(params.entries())
    // Tải lại trang không gửi lại kết quả: giữ mã phản hồi để còn hiện thông báo thất bại
    confirm.mutate(query, { onSettled: () => setParams({ vnp_ResponseCode: query.vnp_ResponseCode ?? '' }, { replace: true }) })
  }, [fromVnpay, params, confirm, setParams])

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
  if (!order.data || !service.data || fromVnpay || confirm.isPending) {
    return <div className="h-[360px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label={fromVnpay ? 'Đang xác nhận thanh toán' : 'Đang tải'} />
  }

  const planStatus = plan?.items.find((i) => i.service.id === order.data.serviceId)?.status ?? null
  const failMessage = confirm.data?.status === 'FAILED' ? confirm.data.message : (confirm.error?.message ?? null)
  return <DepositView order={order.data} service={service.data} planStatus={planStatus} returnCode={params.get('vnp_ResponseCode')} failMessage={failMessage} />
}
