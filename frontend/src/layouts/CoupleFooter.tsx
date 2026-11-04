import { Heart, Mail, Phone } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { PLATFORM } from '@/config/platform'
import { DepositTermsDialog } from '@/features/orders/components/DepositTermsDialog'
import { PartnerTermsDialog } from '@/features/vendors/components/PartnerTermsDialog'
import { paths } from '@/routes/paths'

const EXPLORE = [
  { to: paths.services, label: 'Dịch vụ cưới' },
  { to: paths.timeline, label: 'Timeline' },
  { to: paths.favorites, label: 'Dịch vụ yêu thích' },
  { to: paths.plan, label: 'Kế hoạch của tôi' },
]

/** Vàng nhấn trên nền đen (cùng tông vàng thương hiệu) */
const ACCENT = 'text-[#d4a94f]'
const link = 'text-[13.5px] text-white/75 transition-colors hover:text-white hover:underline hover:underline-offset-4'

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-[140px]">
      <h2 className={`font-serif text-[12px] font-semibold tracking-[0.2em] uppercase ${ACCENT}`}>{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">{children}</ul>
    </div>
  )
}

/** Footer phía cặp đôi (gọn): nền đen, thương hiệu + câu chủ đề + mô tả ngắn, cột Khám phá / Hỗ trợ / Liên hệ, dòng bản quyền. */
export function CoupleFooter() {
  const [open, setOpen] = useState<'deposit' | 'partner' | null>(null)
  const close = (o: boolean) => !o && setOpen(null)

  return (
    <footer className="bg-[#111111] text-white">
      <div className="mx-auto max-w-content px-[clamp(16px,4vw,32px)] pt-8 pb-5">
        <div className="grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-x-8 gap-y-6 max-[1000px]:grid-cols-3 max-sm:grid-cols-1">
          <div className="max-[1000px]:col-span-3 max-sm:col-span-1">
            <p className="flex items-baseline gap-3">
              <span className="font-serif text-[30px] leading-none font-bold tracking-tight">{PLATFORM.name}</span>
              <span className={`font-serif text-[15px] italic ${ACCENT}`}>{PLATFORM.tagline}</span>
            </p>
            <p className="mt-2.5 max-w-[440px] text-[13.5px] leading-relaxed text-white/65">{PLATFORM.description}</p>
          </div>

          <Column title="Khám phá">
            {EXPLORE.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className={link}>
                  {l.label}
                </Link>
              </li>
            ))}
          </Column>

          <Column title="Hỗ trợ">
            <li>
              <button type="button" className={link} onClick={() => setOpen('deposit')}>
                Điều khoản đặt dịch vụ
              </button>
            </li>
            <li>
              <button type="button" className={link} onClick={() => setOpen('partner')}>
                Điều khoản hợp tác
              </button>
            </li>
          </Column>

          <Column title="Liên hệ">
            <li>
              <a href={`mailto:${PLATFORM.email}`} className={`${link} inline-flex items-center gap-2`}>
                <Mail className="size-3.5 shrink-0" aria-hidden />
                {PLATFORM.email}
              </a>
            </li>
            <li>
              <a href={`tel:${PLATFORM.phoneHref}`} className={`${link} inline-flex items-center gap-2`}>
                <Phone className="size-3.5 shrink-0" aria-hidden />
                {PLATFORM.phone}
              </a>
            </li>
          </Column>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[11.5px] tracking-[0.12em] text-white/50 uppercase">
          <span className="inline-flex items-center gap-1.5">
            © {new Date().getFullYear()} {PLATFORM.name} · Made with <Heart className="size-3 fill-[#d4a94f] text-[#d4a94f]" aria-label="tình yêu" /> in Vietnam
          </span>
        </div>
      </div>

      <DepositTermsDialog open={open === 'deposit'} onOpenChange={close} />
      <PartnerTermsDialog open={open === 'partner'} onOpenChange={close} vars={{ businessName: null, categoryName: null, commissionRate: null }} />
    </footer>
  )
}
