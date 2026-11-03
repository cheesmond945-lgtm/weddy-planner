import { Check, Flower2, ImageIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FitImage } from '@/components/FitImage'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ServiceDetail, ServicePackage } from '@/types/catalog'
import { DetailCard } from './DetailCard'
import { Lightbox } from './GalleryDialog'
import { PackageDrawer, PackageTiles } from './PackageTiles'
import { attrsOf, imagesOf } from './packageInfo'

interface ServiceInfoPanelProps {
  service: ServiceDetail
  /** Phần thêm trong khung chi tiết gói (lịch bận của sảnh) */
  packageExtra?: (pkg: ServicePackage) => ReactNode
}

/** Ảnh đang xem trong khung xem lớn: album nào, ảnh thứ mấy */
type Viewing = { title: string; images: string[]; index: number }

/**
 * Tab "Thông tin chung": giới thiệu, gói dịch vụ, ảnh thực tế ngoài gói (2.2).
 * Gói hiện theo service.packageLayout: "album" = card ảnh ghép (14B), "tiles" = mỗi gói một ô ảnh (14D).
 */
export function ServiceInfoPanel({ service, packageExtra }: ServiceInfoPanelProps) {
  const [viewing, setViewing] = useState<Viewing | null>(null)
  // Gói đang mở trong khung bên phải (layout album)
  const [opened, setOpened] = useState<ServicePackage | null>(null)
  const highlights = service.capacity ? [...service.highlights, `Sức chứa tối đa ${service.capacity} khách`] : service.highlights

  // Ảnh không thuộc gói nào. Chỉ tính được khi mọi album có đủ danh sách ảnh (dữ liệu giả thiếu thì ẩn khối này)
  const albumsComplete = service.albums.length > 0 && service.albums.every((a) => a.imageUrls)
  const inPackages = new Set(service.albums.flatMap((a) => a.imageUrls ?? []))
  const looseImages = albumsComplete ? service.images.filter((src) => !inPackages.has(src)) : []

  return (
    <>
      <DetailCard title="Giới thiệu dịch vụ">
        <p className="leading-[1.7]">{service.description}</p>
        <ul className="mt-4 grid list-none gap-1.5 p-0">
          {highlights.map((h) => (
            <li key={h} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-sage" strokeWidth={2.2} aria-hidden />
              {h}
            </li>
          ))}
        </ul>
      </DetailCard>

      <DetailCard
        title="Gói dịch vụ"
        subtitle="Lựa chọn gói phù hợp cho ngày trọng đại của bạn"
        icon={<Flower2 className="size-9" strokeWidth={1.25} />}
      >
        {service.packageLayout === 'tiles' ? (
          <PackageTiles service={service} />
        ) : (
          // 2 cột khi cột nội dung (tabpanel, @container/content) rộng từ 700px, hẹp hơn thì 1 cột
          <div className="grid grid-cols-1 gap-5 @min-[700px]/content:grid-cols-2">
            {service.packages.map((p) => (
              <PackageCard
                key={p.id}
                pkg={p}
                images={imagesOf(service, p)}
                onOpen={() => setOpened(p)}
              />
            ))}
          </div>
        )}
      </DetailCard>

      {looseImages.length > 0 && (
        <DetailCard title="Ảnh thực tế">
          <div className="columns-2 gap-2 sm:columns-3">
            {looseImages.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setViewing({ title: `Ảnh thực tế của ${service.name}`, images: looseImages, index: i })}
                aria-label={`Xem ảnh thực tế ${i + 1}`}
                className="mb-2 block w-full break-inside-avoid overflow-hidden rounded-lg bg-line"
              >
                <img src={src} alt={`${service.name}, ảnh thực tế ${i + 1}`} loading="lazy" className="block h-auto w-full transition-transform duration-300 hover:scale-[1.03]" />
              </button>
            ))}
          </div>
        </DetailCard>
      )}

      <PackageDrawer service={service} pkg={opened} variant="gallery" extra={opened ? packageExtra?.(opened) : null} onClose={() => setOpened(null)} />

      <Lightbox
        title={viewing?.title ?? ''}
        images={viewing?.images ?? []}
        index={viewing?.index ?? null}
        onIndex={(index) => setViewing((v) => (v ? { ...v, index } : v))}
        onClose={() => setViewing(null)}
      />
    </>
  )
}

interface PackageCardProps {
  pkg: ServicePackage
  images: string[]
  onOpen: () => void
}

/**
 * Card một gói (gọn): ảnh ghép, tên + thuộc tính, giá. Mô tả và toàn bộ ảnh nằm trong khung bên phải khi bấm card,
 * để lưới không giãn lệch khi mở rộng mô tả.
 */
function PackageCard({ pkg, images, onOpen }: PackageCardProps) {
  const attrs = attrsOf(pkg)

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Xem chi tiết và ${images.length} ảnh của gói ${pkg.name}`}
      className="group @container/card flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-left transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700"
    >
      <Mosaic name={pkg.name} images={images} promotion={pkg.promotion} />

      <div className="flex w-full flex-1 flex-col gap-3 px-5 pt-4 pb-5">
        {/* Tên trái, giá phải; card hẹp (dưới 360px: lưới 2 cột, điện thoại) thì giá xuống dưới tên thành một dòng để tên không bị cắt */}
        <div className="flex items-start justify-between gap-4 @max-[360px]/card:flex-col @max-[360px]/card:gap-1.5">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-serif text-[22px] leading-[1.25] font-semibold text-ink group-hover:text-gold-700">{pkg.name}</h3>
            {attrs && <p className="mt-1 text-sm text-ink-2">{attrs}</p>}
          </div>
          <div className="shrink-0 text-right @max-[360px]/card:flex @max-[360px]/card:items-baseline @max-[360px]/card:gap-1.5 @max-[360px]/card:text-left">
            <span className="block text-[13px] text-ink-2">Từ</span>
            <span className="block text-2xl leading-tight font-semibold whitespace-nowrap text-gold-700">{formatMoney(pkg.price)}</span>
            <span className="block text-[13px] text-ink-2">/ {pkg.unit ?? 'gói'}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

/**
 * Ảnh ghép 16/9: 1 ảnh lớn bên trái (2 hàng) + 2 ảnh nhỏ xếp dọc bên phải; ô thứ 3 phủ "+N ảnh" khi còn ảnh.
 * 1 ảnh: cả khung; 2 ảnh: chia đôi; không ảnh: nền vàng nhạt + biểu tượng. Chỉ để xem (cả card là nút mở chi tiết).
 */
function Mosaic({ name, images, promotion }: { name: string; images: string[]; promotion?: string | null }) {
  const shown = images.slice(0, 3)
  const more = images.length - 3

  return (
    <span
      className={cn(
        'relative grid aspect-video w-full gap-0.5 bg-surface',
        shown.length >= 3 ? 'grid-cols-[2fr_1fr] grid-rows-2' : shown.length === 2 ? 'grid-cols-2' : 'grid-cols-1',
      )}
    >
      {shown.length === 0 && (
        <span className="grid place-items-center bg-gold-100 text-gold-700" aria-label={`${name} chưa có ảnh`}>
          <ImageIcon className="size-10" strokeWidth={1.25} aria-hidden />
        </span>
      )}
      {shown.map((src, i) => (
        <span key={src} className={cn('relative block size-full overflow-hidden bg-line', shown.length >= 3 && i === 0 && 'row-span-2')}>
          <FitImage src={src} className="absolute inset-0" imgClassName="group-hover:scale-[1.03]" />
          {i === 2 && more > 0 && (
            <span className="absolute inset-0 grid place-items-center bg-[rgb(20_15_10/0.55)] text-base font-semibold text-white">+{more} ảnh</span>
          )}
        </span>
      ))}
      {promotion && (
        <span className="pointer-events-none absolute top-3 left-3 rounded-pill bg-moss-700 px-2.5 py-1 text-xs font-semibold text-white">{promotion}</span>
      )}
    </span>
  )
}

/** Card gói khi đang tải: cùng kích thước (ảnh xám + 2 dòng). */
export function PackageCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="aspect-video animate-pulse bg-muted" />
      <div className="space-y-2.5 px-5 pt-4 pb-5">
        <div className="h-6 w-2/3 animate-pulse rounded-sm bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded-sm bg-muted" />
        <div className="h-4 w-full animate-pulse rounded-sm bg-muted" />
      </div>
    </div>
  )
}
