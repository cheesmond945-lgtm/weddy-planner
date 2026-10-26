import { useSearchParams } from 'react-router'
import { ORDER_STATUSES, type OrderListQuery, type OrderStatus } from '@/types/vendorOrder'

export const ORDER_PAGE_SIZE = 10

/**
 * Bộ lọc, trang và đơn đang mở nằm trên URL: tải lại trang vẫn giữ, và "Xem đơn ›" trong chat dẫn thẳng tới đơn
 * (/vendor/orders?order=…).
 */
export function useOrderPageState() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') as OrderStatus | null

  const query: OrderListQuery = {
    q: params.get('q') ?? '',
    status: status && ORDER_STATUSES.includes(status) ? status : undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: ORDER_PAGE_SIZE,
  }
  const openOrderId = params.get('order')

  function write(q: OrderListQuery, order: string | null) {
    const p = new URLSearchParams()
    if (q.q) p.set('q', q.q)
    if (q.status) p.set('status', q.status)
    if (q.from) p.set('from', q.from)
    if (q.to) p.set('to', q.to)
    if (q.page && q.page > 1) p.set('page', String(q.page))
    if (order) p.set('order', order)
    setParams(p, { replace: true })
  }

  return {
    query,
    openOrderId,
    /** Đổi bộ lọc thì về trang 1 */
    setFilter: (patch: Partial<OrderListQuery>) => write({ ...query, ...patch, page: patch.page ?? 1 }, openOrderId),
    resetFilters: () => write({ page: 1 }, openOrderId),
    openOrder: (id: string | null) => write(query, id),
    hasFilter: !!(query.q || query.status || query.from || query.to),
  }
}
