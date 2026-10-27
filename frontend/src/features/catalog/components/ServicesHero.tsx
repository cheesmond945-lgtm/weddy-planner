import type { ReactNode } from 'react'
import hero04 from '@/assets/services-hero-04.jpg'
import hero10 from '@/assets/services-hero-10.jpg'
import hero11 from '@/assets/services-hero-11.jpg'
import hero13 from '@/assets/services-hero-13.jpg'
import hero14 from '@/assets/services-hero-14.jpg'
import hero15 from '@/assets/services-hero-15.jpg'
import hero16 from '@/assets/services-hero-16.jpg'
import hero17 from '@/assets/services-hero-17.jpg'
import hero18 from '@/assets/services-hero-18.jpg'
import { cn } from '@/lib/utils'

/**
 * Ảnh trong dải ảnh nền (đã cắt bỏ chữ, logo, watermark khỏi file), xếp theo tone màu để ảnh cạnh nhau hài hòa:
 * mở đầu bằng nhóm rừng / nắng chiều, rồi xanh trầm → xanh lá (rồi vòng lại).
 * pos: điểm canh (object-position) để mặt người nằm trong ô dọc.
 */
const PHOTOS = [
  // Mở đầu: xanh rừng → vàng nắng chiều
  { src: hero13, pos: 'object-[61%_50%]' },
  { src: hero14, pos: 'object-[45%_50%]' },
  { src: hero15, pos: 'object-[50%_40%]' },
  { src: hero16, pos: 'object-[50%_50%]' },
  { src: hero17, pos: 'object-[50%_50%]' },
  { src: hero18, pos: 'object-[50%_50%]' },
  // Xanh nhạt, trầm
  { src: hero04, pos: 'object-[50%_55%]' },
  // Xanh lá tươi (nối vòng về ảnh rừng mở đầu)
  { src: hero10, pos: 'object-[50%_50%]' },
  { src: hero11, pos: 'object-[55%_50%]' },
]
/** Số lần lặp bộ ảnh trong dải: một bộ đã dài hơn màn hình rộng, lặp 2 lần để trôi vòng không đứt */
const REPEAT = 2

/**
 * Dải ảnh dọc tự trôi chậm sang trái (hero-marquee chạy 50% chiều dài dải rồi lặp lại, nửa sau giống hệt nửa đầu nên không thấy nhảy).
 * Ảnh hiện gần đúng cỡ gốc nên nét. Người dùng bật "giảm chuyển động" thì dải đứng yên.
 */
function HeroStrip() {
  const tiles = Array.from({ length: REPEAT }, () => PHOTOS).flat()
  return (
    <div aria-hidden className="film-base absolute inset-0 -z-10 overflow-hidden">
      <div className="film-strip flex h-full w-max gap-2.5 animate-[hero-marquee_70s_linear_infinite] motion-reduce:animate-none">
        {tiles.map((p, i) => (
          <div key={i} className="relative h-full w-[clamp(240px,19vw,360px)] shrink-0">
            <img
              src={p.src}
              alt=""
              loading={i < PHOTOS.length * 2 ? 'eager' : 'lazy'}
              decoding="async"
              className={cn('size-full rounded-[2px] object-cover', p.pos)}
            />
            {/* Bóng tối viền trong khung, như mép ảnh trên phim */}
            <span className="pointer-events-none absolute inset-0 rounded-[2px] shadow-[inset_0_0_24px_rgb(0_0_0/0.35)]" />
            {/* Chữ in dọc mép phim (kiểu số khung trên cuộn phim), nằm trong dải đáy */}
            <span className="film-label absolute top-full left-2 mt-[7px]">
              WEBPLAN 400 <span className="mx-1.5">▸</span> {String((i % PHOTOS.length) + 1).padStart(2, '0')}A
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Phần đầu trang Dịch vụ cưới (13): nhãn, tiêu đề có chữ script, phụ đề, thanh tìm kiếm trên dải ảnh nền tràn hết chiều ngang.
 * Chữ trắng trên ảnh nên phủ lớp tối (đậm ở giữa nơi có chữ, nhạt dần ra mép) để đọc rõ trên cả trời sáng lẫn cỏ xanh.
 * Không còn băng chuyền danh mục để danh sách dịch vụ lộ ra ngay trong màn hình đầu.
 */
export function ServicesHero({ search }: { search: ReactNode }) {
  return (
    // Tràn ra hết bề ngang trang (thoát khỏi khung nội dung) và kéo lên nằm dưới header (header trong suốt trên ảnh, cao ~56px).
    // z-10 để popover "Mức giá" nổi trên hàng chip bên dưới
    <section className="relative isolate z-10 left-1/2 -mt-[calc(2rem+56px)] mb-6 w-screen -translate-x-1/2 px-[clamp(16px,4vw,32px)] pt-[calc(56px+6.5rem)] pb-[5.5rem] text-center max-[700px]:pt-[calc(56px+3.5rem)] max-[700px]:pb-14">
      <HeroStrip />
      {/* Dải tối trên cùng sau header để chữ menu trắng luôn rõ */}
      <span aria-hidden className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-[rgb(20_15_10/0.55)] to-transparent" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_55%_75%_at_50%_45%,rgb(20_15_10/0.55),rgb(20_15_10/0.12))]" />

      <span className="mb-4 inline-flex rounded-pill border border-white/35 bg-white/15 px-3.5 py-1.5 text-xs leading-snug font-semibold tracking-[0.16em] text-white backdrop-blur-[6px]">
        WEBPLAN · NỀN TẢNG DỊCH VỤ CƯỚI
      </span>
      {/* Ngắt dòng cố định sau "Hiện thực hóa", cụm chữ script không bị tách đôi */}
      <h1 className="mx-auto mb-7 text-[clamp(34px,4.6vw,56px)] leading-[1.12] tracking-[-0.02em] text-balance text-white [text-shadow:0_2px_16px_rgb(0_0_0/0.35)]">
        Hiện thực hóa <br />
        <span className="font-script text-[1.25em] leading-none font-normal tracking-normal whitespace-nowrap text-[#f3d9a0]">giấc mơ cưới</span> của bạn
      </h1>
      {search}
    </section>
  )
}
