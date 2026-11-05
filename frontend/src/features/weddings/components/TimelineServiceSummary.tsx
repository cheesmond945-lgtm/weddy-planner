import { CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OrderProgress } from '../timelineGroups'

interface TimelineServiceSummaryProps {
  /** Mỗi đơn đã cọc của dịch vụ đang lọc một dòng (xem orderProgress) */
  orders: readonly OrderProgress[]
  /** "Muốn thêm hoặc bỏ bước nào? Nhắn tin": mở chat với NCC của đơn kèm câu soạn sẵn */
  onAskVendor: (serviceId: string, orderCode: string) => void
}

/**
 * Dòng tóm tắt phía trên danh sách khi đang lọc đúng một dịch vụ: "Quy trình của <NCC> · <gói> · <mã đơn> · Đã xong x/N", thanh tiến độ nhỏ
 * (xong hết thì ghi "Các công việc của <NCC> đã hoàn thành")
 * và nút "Nhắn tin" hỏi thêm hoặc bỏ bước (ẩn khi đã xong hết). Dịch vụ có nhiều đơn đã cọc thì mỗi đơn một dòng. Dịch vụ chưa có đơn thì không hiện.
 */
/** Tiêu đề dòng: đang làm thì ghi tiến độ, xong hết thì báo đã hoàn thành */
function summaryTitle(o: OrderProgress) {
  const vendor = o.vendorName ?? 'nhà cung cấp'
  const parts = o.done >= o.total ? [`Các công việc của ${vendor} đã hoàn thành`, o.packageName, o.orderCode] : [`Quy trình của ${vendor}`, o.packageName, o.orderCode, `Đã xong ${o.done}/${o.total}`]
  return parts.filter(Boolean).join(' · ')
}

export function TimelineServiceSummary({ orders, onAskVendor }: TimelineServiceSummaryProps) {
  if (orders.length === 0) return null
  return (
    <ul aria-label="Tiến độ quy trình của nhà cung cấp" className="mt-4 flex flex-col gap-2.5">
      {orders.map((o) => (
        <li key={o.orderCode} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[18px] border border-line bg-[color-mix(in_srgb,var(--sage-soft)_45%,var(--surface))] px-4 py-3">
          <div className="min-w-0 flex-1 basis-[220px]">
            <div className="flex items-start gap-1.5 text-[14px] font-semibold [overflow-wrap:anywhere]">
              {o.done >= o.total && <CircleCheck className="mt-[3px] size-4 shrink-0 text-sage" aria-hidden />}
              {summaryTitle(o)}
            </div>
            {/* Thanh tiến độ chỉ khi còn việc; xong hết thì câu tiêu đề đã nói, không cần thanh đầy */}
            {o.done < o.total && (
              <div className="mt-1.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-[9px] bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={o.total} aria-valuenow={o.done} aria-label={`Đã xong ${o.done} trên ${o.total} việc`}>
                <i className="block h-full bg-sage transition-[width] duration-300" style={{ width: `${o.total ? Math.round((o.done / o.total) * 100) : 0}%` }} />
              </div>
            )}
          </div>
          {/* Xong hết các bước thì không còn gì để thêm hay bỏ: ẩn câu hỏi và nút */}
          {o.serviceId && o.done < o.total && (
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground max-sm:w-full">
              <span>Muốn thêm hoặc bỏ bước nào?</span>
              <Button size="sm" onClick={() => onAskVendor(o.serviceId!, o.orderCode)}>
                Nhắn tin
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
