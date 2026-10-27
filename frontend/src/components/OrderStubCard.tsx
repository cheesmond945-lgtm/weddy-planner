import { FileText } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { ORDER_STATUS } from '@/features/vendorOrders/constants'
import type { OrderStatus } from '@/types/vendorOrder'

/**
 * Ô đơn gọn trong chat: "Đơn {mã} · {trạng thái}". Dùng cho tin loại Order khi chưa đọc được đơn đầy đủ
 * (chat thật, API đơn hàng còn dùng dữ liệu giả), hai bên cùng nội dung.
 */
export function OrderStubCard({ orderCode, status }: { orderCode: string; status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return (
    <div className="flex w-full items-center gap-2.5 rounded-[18px] border border-line bg-surface px-4 py-3 text-[13.5px] shadow-bubble">
      <FileText className="size-4 flex-none text-gold-ink" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        Đơn <b>{orderCode}</b>
      </span>
      {s ? <Badge tone={s.tone}>{s.label}</Badge> : <span className="text-xs text-muted-foreground">{status}</span>}
    </div>
  )
}
