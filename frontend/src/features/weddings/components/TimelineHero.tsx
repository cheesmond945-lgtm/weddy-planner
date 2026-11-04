import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { daysBetween, formatDate, parseDate, today } from '@/lib/date'
import type { TimelineItem, Wedding } from '@/types/wedding'

interface TimelineHeroProps {
  wedding: Wedding
  items: TimelineItem[]
  onEdit: () => void
  onAddTask: () => void
}

/**
 * Khối đầu trang Timeline: số ngày còn lại, tiến độ, nút Chỉnh sửa thông tin / Thêm việc.
 * Địa điểm, sức chứa, ngân sách, phong cách chỉ hiện ở khối Thông tin đám cưới (trang Kế hoạch), không lặp ở đây.
 */
export function TimelineHero({ wedding, items, onEdit, onAddTask }: TimelineHeroProps) {
  const days = Math.max(0, daysBetween(today(), parseDate(wedding.date)))
  // Không tính chỗ giữ (LOCKED) và ngày thực hiện (SERVICE_DATE) vào tiến độ
  const real = items.filter((i) => i.kind !== 'LOCKED' && i.kind !== 'SERVICE_DATE')
  const done = real.filter((i) => i.isDone).length
  const percent = real.length ? Math.round((done / real.length) * 100) : 0

  return (
    <section className="mb-[22px] grid grid-cols-[auto_1fr_auto] items-center gap-7 rounded-lg border border-line bg-surface px-7 py-6 max-[860px]:grid-cols-1">
      <div className="font-serif text-[clamp(48px,7vw,72px)] leading-none font-semibold tracking-[-0.03em]">
        {days}
        <small className="mt-1.5 block font-sans text-sm font-medium tracking-normal text-muted-foreground">ngày nữa đến đám cưới ({formatDate(wedding.date)})</small>
      </div>
      <div className="grid gap-1">
        <div className="h-1.5 overflow-hidden rounded-[9px] bg-line" aria-hidden>
          <i className="block h-full bg-sage" style={{ width: `${percent}%` }} />
        </div>
        <div className="text-[13px] text-muted-foreground">
          Đã xong {done}/{real.length} việc
        </div>
      </div>
      <div className="flex flex-col gap-2 max-[860px]:flex-row max-[860px]:flex-wrap">
        <Button variant="outline" onClick={onEdit}>
          Chỉnh sửa thông tin
        </Button>
        <Button variant="outline" onClick={onAddTask}>
          <Plus />
          Thêm việc
        </Button>
      </div>
    </section>
  )
}
