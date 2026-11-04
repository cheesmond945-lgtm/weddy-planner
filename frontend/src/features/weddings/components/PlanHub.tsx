import { LayoutDashboard, LayoutGrid, ListChecks, Pencil, Share2, Wallet, type LucideIcon } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import couplePhoto from '@/assets/plan-hero.jpg'
import { NavLink, useOutletContext } from 'react-router'
import filmPhoto from '@/assets/plan-hero-film.jpg'
import { Button } from '@/components/ui/button'
import { daysBetween, formatDate, parseDate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { PlanTab, Wedding } from '@/types/wedding'
import { usePlan } from '../hooks'
import { ShareDialog } from './ShareDialog'

/** Dữ liệu trang Kế hoạch truyền xuống các subtab qua <Outlet context>. */
export interface PlanOutletContext {
  wedding: Wedding
  openEdit: () => void
}

/** Đám cưới đang dùng trong các subtab (trang khung đã chặn trường hợp chưa có đám cưới). */
export const usePlanContext = () => useOutletContext<PlanOutletContext>()

/**
 * Đường xé giấy cho clip-path, giống mép giấy xé thật: gồ ghề ở mọi tỉ lệ như đường bờ biển (chồng 10 lớp nhiễu, mỗi lớp gấp đôi
 * tần số, biên độ nhân `rough` mỗi lớp), kéo giãn cho đủ độ sâu `depth` (px); ~2px một điểm trên màn rộng nên mép sắc, không lộ
 * đoạn thẳng. Hai cạnh bên thẳng. `rough` càng lớn mép càng xơ (0.8: mép giấy, 0.62: mép ảnh). Cố định theo seed.
 */
function tornPolygon(seed: number, depth: number, rough: number, steps = 700) {
  let n = seed
  const rand = () => (n = (n * 9301 + 49297) % 233280) / 233280
  const edge = (bottom: boolean) => {
    const layers = Array.from({ length: 10 }, (_, k) => {
      const knots = 2 * 2 ** k + 2
      return { knots, amp: rough ** k, v: Array.from({ length: knots }, rand) }
    })
    const raw = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      return layers.reduce((sum, l) => {
        const x = t * (l.knots - 1)
        const j = Math.min(Math.floor(x), l.knots - 2)
        return sum + l.amp * (l.v[j] + (l.v[j + 1] - l.v[j]) * (x - j))
      }, 0)
    })
    const lo = Math.min(...raw)
    const span = Math.max(...raw) - lo || 1
    return raw.map((v, i) => {
      const y = (((v - lo) / span) * depth).toFixed(1)
      const x = ((bottom ? steps - i : i) * (100 / steps)).toFixed(3)
      return bottom ? `${x}% calc(100% - ${y}px)` : `${x}% ${y}px`
    })
  }
  return `polygon(${[...edge(false), ...edge(true)].join(',')})`
}
/** Dải giấy trắng phía sau (xé nông, mép xơ hơn) và ảnh (xé sâu hơn, mép mịn hơn, lệch nhịp) để lộ viền giấy dày mỏng không đều */
const TORN_STYLE = { '--torn-paper': tornPolygon(11, 12, 0.8), '--torn-photo': tornPolygon(29, 16, 0.62) } as CSSProperties

/** Đầu trang Kế hoạch: "Chú rể & Cô dâu", ngày cưới, số ngày còn lại, các nút (hubHead trong prototype). */
export function PlanHubHeader({ wedding, onEdit }: { wedding: Wedding; onEdit: () => void }) {
  const left = Math.max(0, daysBetween(today(), parseDate(wedding.date)))
  const [sharing, setSharing] = useState(false)
  // Đám cưới tạo từ bản cũ có thể chưa có tên: hiện vai trò mờ thay cho tên
  const name = (value: string, fallback: string) => value || <span className="opacity-70">{fallback}</span>

  return (
    // Ảnh xé mép (plan-theme.css .couple-paper / .couple-*): mép trên và dưới của ảnh bị xé, lộ dải giấy trắng lởm chởm phía sau;
    // khối chữ bên phải ("Lễ thành hôn", tên viết tay Ballet, ngày cưới, các nút)
    <div className="couple-paper mb-6" style={TORN_STYLE}>
      {/* Ảnh phim lấy liền (khung trắng, cạnh dưới dày ghi ngày cưới viết tay) dán đè, hơi nghiêng, trên phần váy kem bên trái; ẩn trên màn hẹp */}
      <div className="couple-pin" aria-hidden>
        <span className="couple-pin-photo" style={{ backgroundImage: `url("${filmPhoto}")` }} />
        <span className="couple-pin-caption">{formatDate(wedding.date)}</span>
      </div>
      {/* Bọc ảnh để mép xé của ảnh đổ bóng mảnh lên dải giấy (bóng phải nằm ngoài phần tử bị clip-path) */}
      <div className="couple-photo-shadow">
        {/* Đếm ngược kiểu thiệp: "CÒN" / số trắng nét dày / "NGÀY NỮA", đường chỉ vàng dọc ngăn với khối tên; ẩn trên màn hẹp */}
        <div className="couple-calendar" role="img" aria-label={left ? `Còn ${left} ngày đến ngày cưới` : 'Hôm nay là ngày cưới'}>
          <span className="couple-calendar-head">{left ? 'Còn' : 'Hôm nay'}</span>
          <span className="couple-calendar-num">{left || '♥'}</span>
          <span className="couple-calendar-foot">{left ? 'ngày nữa' : 'ngày cưới'}</span>
        </div>
        <div className="couple-card" style={{ '--couple-photo': `url("${couplePhoto}")` } as CSSProperties}>
          <div className="couple-text">
            <p className="couple-eyebrow" aria-hidden>
              Lễ thành hôn
            </p>
            <h1 className="couple-names">
              <span>{name(wedding.groomName, 'Chú rể')}</span>
              <span className="couple-amp" aria-label="và">
                &amp;
              </span>
              <span>{name(wedding.brideName, 'Cô dâu')}</span>
            </h1>
            <div className="couple-foot">
              <p className="couple-meta">
                {formatDate(wedding.date)}
                {/* Màn hẹp không hiện số đếm ngược bên trái: ghi ngay dòng ngày cưới */}
                <span className="couple-meta-left">
                  {' '}
                  <span aria-hidden>·</span> {left ? `còn ${left} ngày` : 'hôm nay'}
                </span>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" className="rounded-pill" onClick={() => setSharing(true)}>
                  <Share2 />
                  Chia sẻ kế hoạch
                </Button>
                <Button variant="outline" size="sm" className="couple-ghost rounded-pill" onClick={onEdit}>
                  <Pencil />
                  Chỉnh sửa thông tin
                </Button>
              </div>
            </div>
          </div>
          <ShareDialog open={sharing} onOpenChange={setSharing} />
        </div>
      </div>
    </div>
  )
}

export const PLAN_TAB_LINKS: { tab: PlanTab; to: string; label: string; icon: LucideIcon }[] = [
  { tab: 'overview', to: paths.planTab.overview, label: 'Tổng quan', icon: LayoutDashboard },
  { tab: 'timeline', to: paths.planTab.timeline, label: 'Timeline', icon: ListChecks },
  { tab: 'services', to: paths.planTab.services, label: 'Dịch vụ', icon: LayoutGrid },
  { tab: 'budget', to: paths.planTab.budget, label: 'Ngân sách', icon: Wallet },
]

/** Thanh subtab của Kế hoạch (ptabs trong prototype). Đổi tab không cuộn lại đầu trang. */
export function PlanTabs() {
  const { data: plan } = usePlan()
  const counts: Partial<Record<PlanTab, number>> = { services: plan?.items.length ?? 0 }

  return (
    <nav
      aria-label="Các phần của kế hoạch"
      className="mb-6 flex gap-1 overflow-x-auto rounded-[22px] border border-line bg-accent-soft/60 p-[5px] [scrollbar-width:none]"
    >
      {PLAN_TAB_LINKS.map(({ tab, to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          preventScrollReset
          className={({ isActive }) =>
            cn(
              'group inline-flex min-w-max flex-[1_1_0] items-center justify-center gap-2.5 rounded-[17px] py-[9px] pr-5 pl-2.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] max-sm:py-2 max-sm:pr-3.5 max-sm:pl-2 max-sm:text-[13px]',
              isActive ? 'bg-surface text-ink shadow-[0_5px_14px_rgb(var(--shadow-rgb)/0.12)]' : 'text-muted-foreground hover:text-ink',
            )
          }
        >
          <span className="grid size-[30px] place-items-center rounded-full bg-surface text-gold transition-colors group-aria-[current=page]:bg-gold group-aria-[current=page]:text-white max-sm:size-[26px]">
            <Icon aria-hidden className="size-4" />
          </span>
          {label}
          {!!counts[tab] && <span className="rounded-pill bg-accent-soft px-1.5 py-[3px] text-[10px] leading-none font-semibold text-gold">{counts[tab]}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
