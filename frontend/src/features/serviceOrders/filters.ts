import { useSearchParams } from 'react-router'
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderListQuery, type OrderPaymentStatus, type ServiceOrderStatus } from '@/types/serviceOrder'

export const ORDER_PAGE_SIZE = 20

export interface OrderPageState {
  query: OrderListQuery
  /** Đơn đang mở chi tiết (?order=) */
  openOrderId: string | null
  /** Mở luôn hộp thao tác (?do=pay | adjust), từ thẻ đơn trong chat */
  action: 'pay' | 'adjust' | null
}

/**
 * Bộ lọc, trang và đơn đang mở nằm trên URL: tải lại trang vẫn giữ, thẻ đơn trong chat dẫn thẳng tới đơn
 * (/vendor/orders?order=…&do=adjust).
 */
export function useOrderPageState() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') as ServiceOrderStatus | null
  const payment = params.get('payment') as OrderPaymentStatus | null
  const act = params.get('do')

  const state: OrderPageState = {
    query: {
      q: params.get('q') ?? '',
      status: status && ORDER_STATUSES.includes(status) ? status : undefined,
      paymentStatus: payment && PAYMENT_STATUSES.includes(payment) ? payment : undefined,
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      page: Math.max(1, Number(params.get('page')) || 1),
      pageSize: ORDER_PAGE_SIZE,
    },
    openOrderId: params.get('order'),
    action: act === 'pay' || act === 'adjust' ? act : null,
  }

  function write(next: { query: OrderListQuery; openOrderId: string | null; action: OrderPageState['action'] }) {
    const p = new URLSearchParams()
    const q = next.query
    if (q.q) p.set('q', q.q)
    if (q.status) p.set('status', q.status)
    if (q.paymentStatus) p.set('payment', q.paymentStatus)
    if (q.from) p.set('from', q.from)
    if (q.to) p.set('to', q.to)
    if (q.page && q.page > 1) p.set('page', String(q.page))
    if (next.openOrderId) p.set('order', next.openOrderId)
    if (next.openOrderId && next.action) p.set('do', next.action)
    setParams(p, { replace: true })
  }

  return {
    ...state,
    /** Đổi bộ lọc thì về trang 1 */
    setFilter: (patch: Partial<OrderListQuery>) => write({ ...state, query: { ...state.query, ...patch, page: patch.page ?? 1 } }),
    resetFilters: () => write({ ...state, query: { page: 1 } }),
    openOrder: (id: string | null, action: OrderPageState['action'] = null) => write({ ...state, openOrderId: id, action }),
    hasFilter: !!(state.query.q || state.query.status || state.query.paymentStatus || state.query.from || state.query.to),
  }
}
