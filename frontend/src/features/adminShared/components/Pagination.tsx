import { cn } from '@/lib/utils'

const btn = 'grid h-9 min-w-9 place-items-center rounded-pill border px-3 text-[13px] tabular-nums transition-colors'

/** Số trang hiển thị: 1 2 3 … cuối, gọn khi nhiều trang. */
function pagesOf(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 6) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const set = new Set([1, 2, 3, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
}

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  /** Danh từ đếm: "người dùng", "bảng kê" */
  noun: string
  onPage: (p: number) => void
}

/** "Hiển thị 1 - 10 của 1.248 người dùng" kèm các nút trang. */
export function Pagination({ page, pageSize, total, noun, onPage }: PaginationProps) {
  if (!total) return null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const plain = 'border-line text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-line'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[13px] text-muted-foreground">
      <p>
        Hiển thị {from} - {to} của {total.toLocaleString('vi-VN')} {noun}
      </p>
      <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(btn, plain)}>
          Trước
        </button>
        {pagesOf(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} aria-hidden className="px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPage(p)}
              className={cn(btn, p === page ? 'border-transparent bg-(image:--gold-grad) font-semibold text-gold-on' : plain)}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className={cn(btn, plain)}>
          Sau
        </button>
      </nav>
    </div>
  )
}
