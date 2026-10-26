import { Link } from 'react-router'
import { paths } from '@/routes/paths'

/** Phần đầu thẻ đăng nhập / đăng ký: dòng nhỏ, tên WebPlan, mô tả. */
export function AuthBrandHeader() {
  return (
    <div className="mb-6 text-center">
      <p className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">Weddy Planner</p>
      <Link to={paths.services} className="mt-2 inline-block font-serif text-[30px] leading-tight font-semibold tracking-[0.04em] text-gold uppercase">
        WebPlan
      </Link>
      <p className="mt-1 text-sm text-muted-foreground">Lập kế hoạch đám cưới trọn vẹn</p>
    </div>
  )
}
