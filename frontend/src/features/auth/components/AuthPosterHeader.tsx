import { Link } from 'react-router'
import coupleImg from '@/assets/auth-bg.jpg'
import { paths } from '@/routes/paths'

/**
 * Phần đầu thẻ đăng nhập / đăng ký kiểu poster: ảnh cô dâu chú rể trong khung, tên WebPlan nhỏ ở góc trên ảnh,
 * dòng "Lập kế hoạch" và chữ viết tay đè lên mép ảnh, ngày/tháng hôm nay bằng chữ serif trên ảnh.
 * compact: trang đăng ký nhiều ô hơn nên ảnh thấp lại để cả form vừa một màn hình.
 */
export function AuthPosterHeader({ compact = false }: { compact?: boolean }) {
  const now = new Date()

  return (
    <div className={`relative ${compact ? 'mb-4' : 'mb-6'}`}>
      <p className="relative z-10 font-serif text-[13px] tracking-[0.32em] text-ink/80 uppercase">Lập kế hoạch</p>
      <p className="relative z-10 mt-2 -mb-5 pl-1 font-script text-[50px] leading-[1.15] text-[#e0a62e] [text-shadow:1px_1px_0_var(--color-surface),-1px_-1px_0_var(--color-surface),1px_-1px_0_var(--color-surface),-1px_1px_0_var(--color-surface),0_0_10px_var(--color-surface)]">
        Ngày chung đôi
      </p>
      <div className="relative overflow-hidden">
        <img src={coupleImg} alt="Cô dâu chú rể bên hồ lúc hoàng hôn" className={`${compact ? 'h-28 [@media(max-height:820px)]:h-20' : 'h-44'} w-full object-cover object-[50%_32%] saturate-[0.85] sepia-[0.1]`} />
        <Link
          to={paths.services}
          className="absolute top-3 right-4 font-serif text-[13px] tracking-[0.4em] text-white/90 uppercase [text-shadow:0_1px_8px_rgb(0_0_0/0.6)] hover:text-white"
        >
          WebPlan
        </Link>
        <p className="absolute right-4 bottom-3 font-serif text-[22px] leading-tight text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
          {now.getDate()} · {now.getMonth() + 1}
        </p>
      </div>
    </div>
  )
}
