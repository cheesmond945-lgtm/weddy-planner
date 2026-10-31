import { Check, ExternalLink, Info, Lock, MapPin, Star } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import type { ServiceDetail, ServicePackage } from '@/types/catalog'
import { GalleryDialog } from './GalleryDialog'
import { ServiceGallery } from './ServiceGallery'
import { ServiceInfoPanel } from './ServiceInfoPanel'
import { useGoogleRating } from '../useGoogleRating'
import { GoogleAttribution } from './GoogleAttribution'
import { mapsHref } from './GoogleMapsLink'
import { GoogleReviewsPanel } from './GoogleReviewsPanel'
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
  /** Dòng đầu dưới các nút trong khung giá (lịch bận theo sảnh vào ngày cưới, module halls) */
  sidebarLead?: ReactNode
  /** Phần thêm trong khung chi tiết gói (lịch bận của sảnh, module halls) */
  packageExtra?: (pkg: ServicePackage) => ReactNode
}

/** Nội dung trang chi tiết dịch vụ (2.2), như renderDetail trong prototype. */
export function ServiceDetailView({ service, headActions, sidebarActions, sidebarTip, sidebarLead, packageExtra }: ServiceDetailViewProps) {
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
            WebPlan đảm bảo
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[clamp(30px,4.6vw,50px)] leading-[1.08] tracking-[-0.02em]">{service.name}</h1>
        {headActions && <div className="flex shrink-0 gap-2.5">{headActions}</div>}
      </div>

      <div className="mt-3 mb-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-2.5 text-sm text-muted-foreground">
        <HeaderRating vendorId={service.id} onShowReviews={showReviews} />
        <a
          href={mapsHref(service)}
          target="_blank"
          rel="noopener noreferrer"
          title="Xem trên Google Maps"
          className="inline-flex items-center gap-1.5 font-medium text-gold-700 underline underline-offset-[3px] hover:text-gold"
        >
          <MapPin className="size-4" aria-hidden />
          {service.address}
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(mở Google Maps trong tab mới)</span>
        </a>
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
          {/* @container/content: lưới gói đo theo bề rộng cột nội dung này (2 cột khi từ 700px) */}
          <div id="service-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="@container/content">
            {tab === 'info' ? (
              <ServiceInfoPanel service={service} packageExtra={packageExtra} />
            ) : (
              <GoogleReviewsPanel vendorId={service.id} mapsUrl={service.googleMapsUrl} />
            )}
          </div>
        </div>
        <ServiceSidebar service={service} actions={sidebarActions} tip={sidebarTip} lead={sidebarLead} />
      </div>

      <GalleryDialog
        title={service.name}
        images={service.images}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />
    </>
  )
}

/** Điểm Google cạnh tên dịch vụ; dùng chung lần gọi (mode reviews) với tab Đánh giá. */
function HeaderRating({ vendorId, onShowReviews }: { vendorId: string; onShowReviews: () => void }) {
  const { data, isPending, isError } = useGoogleRating(vendorId, 'reviews')
  if (isPending) return <span aria-label="Đang tải điểm Google" className="inline-block h-4 w-40 animate-pulse rounded-sm bg-muted" />
  // Chưa có điểm thì không hiện gì: địa chỉ bên cạnh đã là link mở Google Maps
  if (isError || !data || data.rating === null) return null
  return (
    <span className="inline-flex items-center gap-1.5">
      <Star className="size-[17px] fill-gold text-gold" aria-hidden />
      <b className="text-base font-semibold text-ink">{data.rating.toFixed(1)}</b>
      <button type="button" onClick={onShowReviews} className="text-sm font-medium text-gold-700 underline underline-offset-[3px]">
        ({formatNumber(data.userRatingCount)} đánh giá)
      </button>
      <GoogleAttribution compact className="rounded-sm border border-line px-1 leading-4" />
    </span>
  )
}
