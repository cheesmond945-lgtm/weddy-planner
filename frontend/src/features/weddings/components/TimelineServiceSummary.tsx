import { Button } from '@/components/ui/button'
import type { OrderProgress } from '../timelineGroups'

interface TimelineServiceSummaryProps {
  /** Mỗi đơn đã cọc của dịch vụ đang lọc một dòng (xem orderProgress) */
  orders: readonly OrderProgress[]
  /** "Muốn thêm hoặc bỏ bước nào? Nhắn NCC": mở chat với NCC của đơn kèm câu soạn sẵn */
  onAskVendor: (serviceId: string, orderCode: string) => void
}

/**
 * Dòng tóm tắt phía trên danh sách khi đang lọc đúng một dịch vụ: "Quy trình của <NCC> · <gói> · <mã đơn> · Đã xong x/N", thanh tiến độ nhỏ
 * và nút "Nhắn NCC" hỏi thêm hoặc bỏ bước. Dịch vụ có nhiều đơn đã cọc thì mỗi đơn một dòng. Dịch vụ chưa có đơn thì không hiện.
 */
export function TimelineServiceSummary({ orders, onAskVendor }: TimelineServiceSummaryProps) {
  if (orders.length === 0) return null
  return (
    <ul aria-label="Tiến độ quy trình của nhà cung cấp" className="mt-4 flex flex-col gap-2.5">
      {orders.map((o) => (
        <li key={o.orderCode} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[18px] border border-line bg-[color-mix(in_srgb,var(--sage-soft)_45%,var(--surface))] px-4 py-3">
          <div className="min-w-0 flex-1 basis-[220px]">
            <div className="text-[14px] font-semibold [overflow-wrap:anywhere]">{[o.vendorName ? `Quy trình của ${o.vendorName}` : 'Quy trình của nhà cung cấp', o.packageName, o.orderCode, `Đã xong ${o.done}/${o.total}`].filter(Boolean).join(' · ')}</div>
            <div className="mt-1.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-[9px] bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={o.total} aria-valuenow={o.done} aria-label={`Đã xong ${o.done} trên ${o.total} việc`}>
              <i className="block h-full bg-sage transition-[width] duration-300" style={{ width: `${o.total ? Math.round((o.done / o.total) * 100) : 0}%` }} />
            </div>
          </div>
          {o.serviceId && (
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground max-sm:w-full">
              <span>Muốn thêm hoặc bỏ bước nào?</span>
              <Button variant="outline" size="sm" onClick={() => onAskVendor(o.serviceId!, o.orderCode)}>
                Nhắn NCC
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
