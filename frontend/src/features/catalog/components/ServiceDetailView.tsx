import { Check, Info, Lock, MapPin, Star } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import type { ServiceDetail } from '@/types/catalog'
import { GalleryDialog } from './GalleryDialog'
import { ServiceGallery } from './ServiceGallery'
import { ServiceInfoPanel } from './ServiceInfoPanel'
import { ServiceReviewsPanel } from './ServiceReviewsPanel'
import { ServiceSidebar } from './ServiceSidebar'

type Tab = 'info' | 'reviews'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'info', label: 'Thông tin chung', icon: <Info className="size-4" aria-hidden /> },
  { id: 'reviews', label: 'Đánh giá và phản hồi', icon: <Star className="size-4" aria-hidden /> },
]

interface ServiceDetailViewProps {
  service: ServiceDetail
  /** Nút cạnh tên dịch vụ (yêu thích, module favorites) */
  headActions?: ReactNode
  /** Nút trong khung giá (nhắn tin, thêm vào kế hoạch) */
  sidebarActions?: ReactNode
  sidebarTip?: ReactNode
}

/** Nội dung trang chi tiết dịch vụ (2.2), như renderDetail trong prototype. */
export function ServiceDetailView({ service, headActions, sidebarActions, sidebarTip }: ServiceDetailViewProps) {
  const [tab, setTab] = useState<Tab>('info')
  const [galleryOpen, setGalleryOpen] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  function showReviews() {
    setTab('reviews')
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const next = tab === 'info' ? 'reviews' : 'info'
    setTab(next)
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus()
  }

  return (
    <>
      <div className="mt-1 mb-2.5 flex flex-wrap gap-2">
        {service.isVerified && (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-info-soft px-3 py-[5px] text-xs font-semibold text-info">
            <Check className="size-3.5" strokeWidth={2.2} aria-hidden />
            Đã xác minh
          </span>
        )}
        {service.isGuaranteed && (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-sage-soft px-3 py-[5px] text-xs font-semibold text-sage">
            <Lock className="size-3.5" strokeWidth={2} aria-hidden />
            Weddy đảm bảo
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[clamp(30px,4.6vw,50px)] leading-[1.08] tracking-[-0.02em]">{service.name}</h1>
        {headActions && <div className="flex shrink-0 gap-2.5">{headActions}</div>}
      </div>

      <div className="mt-3 mb-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-2.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Star className="size-[17px] fill-gold text-gold" aria-hidden />
          <b className="text-base font-semibold text-ink">{service.rating.toFixed(1)}</b>
          <button type="button" onClick={showReviews} className="text-sm font-medium text-primary underline underline-offset-[3px]">
            ({formatNumber(service.reviewCount)} đánh giá)
          </button>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden />
          {service.address}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {[service.category.name, ...service.styles].map((t) => (
          <span key={t} className="rounded-pill border border-line bg-surface px-[15px] py-1.5 text-[13px]">
            {t}
          </span>
        ))}
      </div>

      <ServiceGallery name={service.name} images={service.images} onOpenAll={() => setGalleryOpen(true)} />

      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-7 max-[900px]:grid-cols-1">
        <div className="min-w-0">
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Nội dung dịch vụ"
            onKeyDown={onTabKey}
            className="mb-[18px] flex scroll-mt-28 gap-1.5 rounded-pill border border-line bg-surface p-1.5"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                data-tab={t.id}
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="service-tabpanel"
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-2 rounded-pill px-2.5 py-3 text-sm font-semibold transition-colors',
                  tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-ink',
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <div id="service-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === 'info' ? (
              <ServiceInfoPanel service={service} onOpenGallery={() => setGalleryOpen(true)} />
            ) : (
              <ServiceReviewsPanel service={service} />
            )}
          </div>
        </div>
        <ServiceSidebar service={service} actions={sidebarActions} tip={sidebarTip} />
      </div>

      <GalleryDialog title={service.name} images={service.images} open={galleryOpen} onOpenChange={setGalleryOpen} />
    </>
  )
}
