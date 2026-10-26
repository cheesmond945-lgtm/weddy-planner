import { Link } from 'react-router'
import { paths } from '@/routes/paths'

/** Phần đầu thẻ đăng nhập / đăng ký: tên WebPlan, đường trang trí, mô tả. */
export function AuthBrandHeader() {
  return (
    <div className="mb-6 text-center">
      <Link to={paths.services} className="inline-block font-serif text-[30px] leading-tight font-semibold tracking-[0.04em] text-gold uppercase">
        WebPlan
      </Link>
      <div aria-hidden className="mx-auto mt-2 flex w-40 items-center gap-2 text-gold">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-current opacity-60" />
        <span className="text-[10px]">✦</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-current opacity-60" />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Lập kế hoạch đám cưới trọn vẹn</p>
    </div>
  )
}
