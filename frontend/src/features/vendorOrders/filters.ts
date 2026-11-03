import { useSearchParams } from 'react-router'
import { ORDER_STATUSES, type OrderListQuery, type OrderStatus } from '@/types/vendorOrder'

export const ORDER_PAGE_SIZE = 10

/** Tab "Hết hạn / Hủy": hai trạng thái cuối chưa thành đơn (một ?status= nhiều giá trị). */
export const CLOSED_STATUS = 'Expired,Cancelled'

/** Trạng thái hiện ở trang Quản lý đơn hàng: bản nháp chỉ xem và gửi trong Tin nhắn nên không có ở đây. */
export const LISTED_STATUSES: OrderStatus[] = ORDER_STATUSES.filter((s) => s !== 'Draft')

/** Mục "Tất cả" = mọi trạng thái trừ bản nháp. */
export const ALL_LISTED = LISTED_STATUSES.join(',')

const VALID_STATUS: readonly string[] = [...LISTED_STATUSES, CLOSED_STATUS]

/** Bộ lọc gửi cho API: chưa chọn tab thì lấy mọi trạng thái trừ bản nháp. */
export const toApiQuery = (q: OrderListQuery): OrderListQuery => ({ ...q, status: q.status ?? ALL_LISTED })

/**
 * Bộ lọc, trang và đơn đang mở nằm trên URL: tải lại trang vẫn giữ, và "Xem đơn ›" trong chat dẫn thẳng tới đơn
 * (/vendor/orders?order=…).
 */
export function useOrderPageState() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status')

  const query: OrderListQuery = {
    q: params.get('q') ?? '',
    status: status && VALID_STATUS.includes(status) ? status : undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    needsAction: params.get('needs') === '1' ? true : undefined,
    restPending: params.get('rest') === '1' ? true : undefined,
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
    if (q.needsAction) p.set('needs', '1')
    if (q.restPending) p.set('rest', '1')
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
    hasFilter: !!(query.q || query.status || query.from || query.to || query.needsAction || query.restPending),
  }
}
