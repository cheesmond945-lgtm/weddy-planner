import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

export interface Crumb {
  label: string
  /** Có thì bấm được; không có là trang hiện tại */
  to?: string
}

/** Đường dẫn "Trang chủ > Danh sách > Chi tiết" phía trên tiêu đề trang (cùng kiểu thanh đường dẫn của Admin). Mục cuối là trang hiện tại. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Đường dẫn" className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
      {items.map((c, i) => (
        <span key={c.label} className="inline-flex items-center gap-1.5">
          {i > 0 && <ChevronRight aria-hidden className="size-3.5" />}
          {c.to ? (
            <Link to={c.to} className="transition-colors hover:text-ink">
              {c.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-medium text-gold-ink">
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
