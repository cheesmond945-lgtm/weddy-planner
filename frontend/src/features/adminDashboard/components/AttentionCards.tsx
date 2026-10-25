import type { LucideIcon } from 'lucide-react'
import { ChevronRight, ClipboardCheck, MessageSquare, Package } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { AdminDashboard } from '@/types/admin'

interface Card {
  to: string
  icon: LucideIcon
  count: number
  title: string
  desc: string
  cta: string
  /** Màu viền, nền biểu tượng và chữ liên kết */
  tone: string
  iconTone: string
  linkTone: string
}

function Item({ c }: { c: Card }) {
  return (
    <Link to={c.to} className={cn('group flex flex-col rounded-[18px] border bg-surface px-6 pt-5 pb-5 shadow-portal transition-shadow hover:shadow-portal-lift', c.tone)}>
      <div className="flex items-start justify-between">
        <span className={cn('grid size-12 place-items-center rounded-[14px]', c.iconTone)}>
          <c.icon className="size-[22px]" />
        </span>
        <span className="text-[34px] leading-none font-semibold tabular-nums">{String(c.count).padStart(2, '0')}</span>
      </div>
      <h3 className="mt-4 text-[17px] font-semibold">{c.title}</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">{c.desc}</p>
      <div className="mt-4 flex items-center justify-between border-t border-dashed border-line pt-3.5">
        <span className={cn('text-[13.5px] font-semibold', c.linkTone)}>{c.cta}</span>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

/** Ba thẻ "Cần xử lý ngay": hồ sơ chờ duyệt, gói chờ duyệt, yêu cầu tư vấn chưa liên hệ. */
export function AttentionCards({ data }: { data: AdminDashboard }) {
  const cards: Card[] = [
    {
      // Đi thẳng tới đúng bộ lọc: số trên thẻ bằng số dòng hiện ra ở trang đích
      to: `${paths.admin.vendors}?tt=PENDING`,
      icon: ClipboardCheck,
      count: data.pendingVendors,
      title: 'Hồ sơ NCC chờ duyệt',
      desc: 'Xác minh ĐKKD, cơ sở vật chất & PCCC',
      cta: 'Đến Quản lý hồ sơ',
      tone: 'border-gold/40',
      iconTone: 'bg-gold-soft text-gold-ink',
      linkTone: 'text-gold-ink',
    },
    {
      to: `${paths.admin.catalog}?tt=PENDING`,
      icon: Package,
      count: data.pendingPackages,
      title: 'Gói dịch vụ chờ duyệt',
      desc: 'Thẩm định gói dịch vụ',
      cta: 'Đến Quản lý gói dịch vụ',
      tone: 'border-sage/40',
      iconTone: 'bg-sage-soft text-sage',
      linkTone: 'text-sage',
    },
    {
      to: `${paths.admin.consultationRequests}?lh=NO`,
      icon: MessageSquare,
      count: data.pendingConsultations,
      title: 'Yêu cầu tư vấn chưa liên hệ',
      desc: 'Nhà cung cấp dịch vụ cần liên hệ tư vấn',
      cta: 'Đến Yêu cầu tư vấn',
      tone: 'border-info/40',
      iconTone: 'bg-info-soft text-info',
      linkTone: 'text-info',
    },
  ]
  return (
    <section className="mb-[30px]" aria-labelledby="attention-title">
      <h2 id="attention-title" className="mb-4 flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.12em] uppercase before:h-[18px] before:w-[3px] before:rounded-full before:bg-(image:--gold-grad)">
        Cần xử lý ngay
      </h2>
      <div className="grid grid-cols-3 gap-5 max-[1000px]:grid-cols-1">
        {cards.map((c) => (
          <Item key={c.to} c={c} />
        ))}
      </div>
    </section>
  )
}
