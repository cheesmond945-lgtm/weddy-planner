import type { ComponentProps, ReactNode } from 'react'
import backgroundPhoto from '@/assets/wedding-setup-bg.jpg'
import stampPhoto from '@/assets/wedding-setup-frame.jpg'
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const photoUrl = `url(${backgroundPhoto})`

/** Vân giấy (nhiễu rất nhẹ) */
const PAPER_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")"

type Props = { title: string; description: string; children: ReactNode } & Omit<ComponentProps<typeof DialogContent>, 'title'>

/**
 * Khung "lá thư giấy xé tay" dùng chung cho hộp thiết lập và hộp chỉnh sửa thông tin đám cưới (hai hộp chỉ khác tiêu đề và nút):
 * tờ giấy kem mép gồ ghề (lọc SVG làm lệch mép), bên trong là ảnh nền cô dâu chú rể, form bên trái, tem thư ảnh nhỏ kèm dấu bưu điện WebPlan ở góc phải.
 * Khung ngoài trong suốt, không cuộn để mép giấy và bóng đổ không bị cắt; phần trong tờ giấy mới cuộn.
 */
export function WeddingDialogContent({ title, description, children, className, ...props }: Props) {
  return (
    <DialogContent showCloseButton={false} className={cn('max-w-[800px] overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none', className)} {...props}>
      <svg aria-hidden className="absolute size-0">
        <filter id="wedding-deckle-edge">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div aria-hidden className="absolute inset-0 bg-[#fbf6ea] [filter:url(#wedding-deckle-edge)_drop-shadow(0_22px_34px_rgb(60_40_10/0.35))]" />
      <div className="relative isolate m-[10px] max-h-[calc(100dvh-52px)] overflow-auto">
        <PhotoBackground />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] mix-blend-multiply" style={{ backgroundImage: PAPER_GRAIN }} />
        <div aria-hidden className="absolute top-5 right-5 hidden items-start md:flex">
          <Postmark className="mt-8 -mr-5" />
          <Stamp />
        </div>
        <div className="px-[clamp(22px,4vw,42px)] py-[clamp(22px,3vw,34px)]">
          {/* Form chiếm phần bên trái, chừa bên phải cho ảnh cô dâu chú rể */}
          <div className="md:max-w-[min(470px,60%)]">
            {/* Tiêu đề và nét hoa văn căn giữa cột form (giữa hai ô tên cô dâu, chú rể) như đầu thư */}
            <DialogHeader className="mb-4 pr-0 text-center">
              {/* Chữ viết tay uốn lượn, nét thanh đậm tương phản (Ballet, có dấu tiếng Việt); chỉ có nét 400 nên bỏ đậm, cỡ lớn để nét thanh đọc rõ */}
              {/* Đặt font bằng style: class font-[...] tự viết bị tailwind-merge coi là độ đậm và gạt mất khi gộp với font-serif mặc định của DialogTitle.
                  Ballet chỉ có nét 400, nên làm đậm bằng viền chữ cùng màu (text-stroke) */}
              <DialogTitle
                className="text-[clamp(34px,4vw,44px)] leading-[1.15] font-normal tracking-normal text-gold-800"
                style={{ fontFamily: "'Ballet', var(--font-script), cursive", WebkitTextStroke: '0.8px currentColor' }}
              >
                {title}
              </DialogTitle>
              {/* Nét hoa văn dưới tiêu đề như đầu thư */}
              <div aria-hidden className="mt-2.5 flex items-center justify-center gap-2 text-gold-500">
                <span className="h-px w-12 bg-gradient-to-r from-transparent to-current" />
                <span className="size-1.5 rotate-45 bg-current" />
                <span className="h-px w-12 bg-gradient-to-l from-transparent to-current" />
              </div>
              <DialogDescription className="sr-only">{description}</DialogDescription>
            </DialogHeader>
            {children}
          </div>
        </div>
      </div>
    </DialogContent>
  )
}

/**
 * Ảnh nền cô dâu chú rể: lớp ảnh nhòe phủ cả lá thư dưới lớp màu nền (đậm bên trái chỗ form, nhạt dần sang phải),
 * trên đó là ảnh rõ nét ở bên phải, mép trái mờ dần tan vào lớp nhòe. Phóng to theo chiều cao để cắt dòng chữ ký ở mép dưới.
 * Màn hẹp (form chiếm hết bề ngang) chỉ giữ lớp nhòe.
 */
function PhotoBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 scale-110 bg-cover bg-[center_25%] blur-[14px]" style={{ backgroundImage: photoUrl }} />
      <div className="absolute inset-0 bg-[linear-gradient(color-mix(in_srgb,var(--bg)_86%,transparent),color-mix(in_srgb,var(--bg)_78%,transparent))] md:bg-[linear-gradient(to_right,color-mix(in_srgb,var(--bg)_90%,transparent)_0%,color-mix(in_srgb,var(--bg)_84%,transparent)_40%,color-mix(in_srgb,var(--bg)_40%,transparent)_65%,color-mix(in_srgb,var(--bg)_10%,transparent)_100%)]" />
      <div
        className="absolute inset-y-0 right-0 hidden w-[58%] [mask-image:linear-gradient(to_right,transparent_0%,rgb(0_0_0/0.4)_25%,#000_58%)] md:block"
      >
        <div className="size-full bg-[length:auto_118%] bg-[center_top] bg-no-repeat" style={{ backgroundImage: photoUrl }} />
      </div>
    </div>
  )
}

/** Tem thư: mép răng cưa (mask đục lỗ tròn quanh viền), trong là ảnh cô dâu chú rể bên hồ lúc hoàng hôn */
function Stamp() {
  return (
    <div className="relative h-[110px] w-[90px] rotate-[4deg] bg-white p-[5px] drop-shadow-[0_3px_5px_rgb(60_40_10/0.25)] [mask:linear-gradient(#000_0_0)_content-box,radial-gradient(circle_3px,#0000_95%,#000)_-4px_-4px/8px_8px]">
      <div className="relative size-full border border-gold-500/40 bg-cover bg-[center_40%]" style={{ backgroundImage: `url(${stampPhoto})` }}>
        <span className="absolute right-1 bottom-0.5 font-serif text-[10px] font-semibold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">♥</span>
      </div>
    </div>
  )
}

/** Dấu bưu điện WebPlan: vòng tròn kép kèm các đường lượn sóng, màu mực nâu; viền sáng mờ để đọc được trên ảnh */
function Postmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 64" fill="none" stroke="currentColor" className={cn('relative z-[1] h-16 w-[120px] rotate-[-10deg] text-gold-800/80 drop-shadow-[0_0_2px_rgb(255_250_235/0.9)]', className)}>
      <circle cx="32" cy="32" r="26" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="20" strokeWidth="0.8" />
      <text x="32" y="30" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontWeight="600" letterSpacing="1">
        WEBPLAN
      </text>
      <text x="32" y="41" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">
        ♥ {new Date().getFullYear()} ♥
      </text>
      {[18, 28, 38, 48].map((y) => (
        <path key={y} d={`M62 ${y} q7 -5 14 0 t14 0 t14 0 t14 0`} strokeWidth="1.3" />
      ))}
    </svg>
  )
}
