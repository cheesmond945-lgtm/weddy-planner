import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/** Logo chữ WebPlan như header prototype: chữ vàng đậm, dấu ® vàng nhạt trang trí. */
export function Brand({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      aria-label="WebPlan, về trang chủ"
      className={cn('whitespace-nowrap py-2 font-serif text-xl font-semibold leading-none tracking-tight text-gold-700', className)}
    >
      WebPlan
      <span className="ml-0.5 align-top font-sans text-[10px] font-medium text-gold-500">®</span>
    </Link>
  )
}
