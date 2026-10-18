import { X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { paths } from '@/routes/paths'
import { compareStore, MAX_COMPARE, useCompare } from '@/store/compare'

/** Đường dẫn trang kết quả so sánh cho danh sách id. */
export const compareUrl = (ids: string[]) => `${paths.compare}?ids=${ids.join(',')}`

/**
 * Thanh so sánh cố định cuối màn hình (.cmp-tray / trayHtml trong prototype).
 * Chừa chỗ bên phải cho hai nút nổi yêu thích và tin nhắn.
 */
export function CompareTray() {
  const items = useCompare()
  const navigate = useNavigate()
  if (!items.length) return null

  const n = items.length
  return (
    <div
      role="region"
      aria-label="So sánh dịch vụ"
      className="fixed bottom-4 left-1/2 z-[35] flex w-[min(880px,calc(100%-180px))] -translate-x-1/2 flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-primary bg-surface px-4 py-3 shadow-tray animate-in fade-in-0 slide-in-from-bottom-3 duration-200 motion-reduce:animate-none max-sm:right-[66px] max-sm:bottom-3.5 max-sm:left-3 max-sm:w-auto max-sm:translate-x-0 max-sm:px-3"
    >
      <ul className="flex min-w-0 flex-wrap gap-2 max-sm:w-full max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none]">
        {items.map((i) => (
          <li
            key={i.id}
            className="inline-flex min-h-10 max-w-[210px] shrink-0 items-center gap-2 rounded-pill bg-accent-soft py-1 pr-1.5 pl-1 text-[13px] font-medium max-sm:max-w-[130px]"
          >
            <img src={i.imageUrl} alt="" className="size-8 shrink-0 rounded-full bg-line object-cover" />
            <span className="truncate">{i.name}</span>
            <button
              type="button"
              aria-label={`Bỏ ${i.name} khỏi so sánh`}
              onClick={() => compareStore.remove(i.id)}
              className="grid size-[26px] shrink-0 place-items-center rounded-full bg-surface text-ink hover:text-warn"
            >
              <X className="size-[13px]" strokeWidth={2.2} />
            </button>
          </li>
        ))}
        {n < MAX_COMPARE && (
          <li className="inline-flex min-h-10 shrink-0 items-center rounded-pill border border-dashed whitespace-nowrap border-line px-4 text-[13px] text-muted-foreground">
            {n < 2 ? 'Chọn thêm' : 'Thêm 1 nữa'}
          </li>
        )}
      </ul>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {n < 2 && <span className="text-[13px] text-muted-foreground">Cần ít nhất 2 dịch vụ {items[0].categoryName.toLowerCase()}</span>}
        <button type="button" onClick={() => compareStore.clear()} className="text-sm font-medium text-primary underline underline-offset-[3px]">
          Bỏ chọn
        </button>
        <Button disabled={n < 2} onClick={() => navigate(compareUrl(items.map((i) => i.id)))}>
          So sánh {n} dịch vụ
        </Button>
      </div>
    </div>
  )
}
