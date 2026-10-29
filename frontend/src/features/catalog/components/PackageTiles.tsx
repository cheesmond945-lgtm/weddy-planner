import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Check, ImageIcon, X } from 'lucide-react'
import { useState } from 'react'
import { FitImage } from '@/components/FitImage'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ServiceDetail, ServicePackage } from '@/types/catalog'
import { Lightbox } from './GalleryDialog'
import { attrsOf, imagesOf, withoutPrice } from './packageInfo'

interface PackageTilesProps {
  service: ServiceDetail
}

/** Số gói tối đa còn dùng ô lớn nổi bật; nhiều hơn thì lưới đều nhau và "Xem thêm" */
const MAX_FEATURED_LAYOUT = 6

// Lớp Tailwind viết đủ chữ (không ghép chuỗi) để Tailwind quét được.
// Ô nào cũng giữ tỉ lệ dọc 4/5: ảnh gói (trang điểm, váy, chụp ảnh) chủ yếu là ảnh dọc, ô ngang sẽ cắt ngang mặt
const SPAN = { 2: 'col-span-2', 3: 'col-span-3' } as const
const PORTRAIT = 'aspect-[4/5]'

/**
 * Chia các ô thành hàng (lưới 6 cột) sao cho hàng nào cũng kín và không có ô lẻ một mình:
 * hàng 3 ô (mỗi ô 2 cột); dư 2 ô thì hàng cuối 2 ô (mỗi ô 3 cột); dư 1 ô thì 4 ô cuối thành 2 + 2.
 * Chỉ có đúng 1 ô thì đặt giữa hàng (rộng bằng nửa hàng).
 */
const rowSpans = (count: number): (2 | 3)[] => {
  const spans: (2 | 3)[] = Array(count).fill(2)
  if (count === 1) return [3]
  const rem = count % 3
  if (rem === 2) spans.splice(count - 2, 2, 3, 3)
  if (rem === 1) spans.splice(count - 4, 4, 3, 3, 3, 3)
  return spans
}

/**
 * Lớp cho từng ô, mọi hàng đều kín và ô luôn dọc (không cắt mất mặt):
 * - Máy tính (lưới 6 cột): 4 gói = ô lớn cao bằng 3 ô nhỏ xếp dọc bên phải; 3, 5, 6 gói = ô lớn 2×2 cạnh 2 ô nhỏ,
 *   các gói còn lại xếp hàng dưới theo rowSpans. Không có ô lớn: chia hàng theo rowSpans.
 * - Điện thoại (2 cột): ô lớn trải 2 cột, tỉ lệ vuông; còn lẻ một ô cuối thì ô đó cũng trải 2 cột, vuông.
 */
function tileClasses(count: number, featured: boolean): string[] {
  const out: string[] = []
  let rest = count
  if (featured) {
    const tall = count === 4
    out.push(cn('col-span-4', tall ? 'row-span-3' : 'row-span-2'))
    const beside = tall ? 3 : 2
    for (let i = 0; i < beside; i++) out.push(cn(SPAN[2], PORTRAIT))
    rest = count - 1 - beside
  }
  const spans = rowSpans(rest)
  // Chỉ có 1 ô (gói duy nhất): đặt giữa hàng
  for (const sp of spans) out.push(cn(SPAN[sp], PORTRAIT, spans.length === 1 && !featured && 'col-start-3'))

  // Điện thoại: bỏ cách chia 6 cột, dùng 2 cột
  const smallCount = featured ? count - 1 : count
  return out.map((c, i) => {
    const isBig = featured && i === 0
    const smallIndex = featured ? i - 1 : i
    const lastOdd = !isBig && smallCount % 2 === 1 && smallIndex === smallCount - 1
    return cn(
      c,
      isBig || lastOdd
        ? '@max-[699px]/content:col-span-2 @max-[699px]/content:col-start-auto @max-[699px]/content:row-span-1 @max-[699px]/content:aspect-square'
        : '@max-[699px]/content:col-span-1 @max-[699px]/content:aspect-[4/5]',
    )
  })
}

/**
 * Layout "tiles" (14D): mỗi gói một ô ảnh, hợp với các gói là biến thể của cùng dịch vụ (chụp ảnh, váy cưới, trang điểm).
 * 3–6 gói: gói nổi bật (featured, mặc định gói đầu) là ô lớn, các gói khác ô nhỏ xếp quanh (xem tileClasses).
 * Khác số đó: lưới đều 3 ô một hàng, quá 6 gói thì hiện 6 và nút "Xem thêm".
 * Bấm ô mở drawer chi tiết gói. Từng gói chỉ để xem: kế hoạch lưu theo NCC nên nút thêm vào kế hoạch chỉ ở khung giá bên phải.
 */
export function PackageTiles({ service }: PackageTilesProps) {
  const [opened, setOpened] = useState<ServicePackage | null>(null)
  const [showAll, setShowAll] = useState(false)

  const pkgs = service.packages
  const featuredAt = Math.max(0, pkgs.findIndex((p) => p.featured))
  const ordered = pkgs.length ? [pkgs[featuredAt], ...pkgs.filter((_, i) => i !== featuredAt)] : []
  const featuredLayout = pkgs.length >= 3 && pkgs.length <= MAX_FEATURED_LAYOUT
  const visible = !featuredLayout && !showAll ? ordered.slice(0, MAX_FEATURED_LAYOUT) : ordered
  const classes = tileClasses(visible.length, featuredLayout)

  return (
    <>
      <div className="grid grid-cols-6 gap-3 @max-[699px]/content:grid-cols-2">
        {visible.map((p, i) => (
          <Tile
            key={p.id}
            pkg={p}
            image={imagesOf(service, p)[0]}
            big={featuredLayout && i === 0}
            onOpen={() => setOpened(p)}
            className={classes[i]}
          />
        ))}
      </div>
      {!featuredLayout && ordered.length > MAX_FEATURED_LAYOUT && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            aria-expanded={showAll}
            className="h-10 rounded-md border-[1.5px] border-gold-700 px-5 text-sm font-semibold text-gold-700 transition-colors hover:bg-gold-100"
          >
            {showAll ? 'Thu gọn' : `Xem thêm ${ordered.length - MAX_FEATURED_LAYOUT} gói`}
          </button>
        </div>
      )}

      <PackageDrawer service={service} pkg={opened} onClose={() => setOpened(null)} />
    </>
  )
}

interface TileProps {
  pkg: ServicePackage
  image?: string
  big: boolean
  onOpen: () => void
  className?: string
}

/** Một ô gói: ảnh sạch + dải nhãn kem mờ (tên, giá) ở đáy; chữ là HTML, không in vào ảnh. */
function Tile({ pkg, image, big, onOpen, className }: TileProps) {
  return (
    <div className={cn('group relative overflow-hidden rounded-md bg-gold-100', className)}>
      {image ? (
        <FitImage src={image} className="absolute inset-0" imgClassName="group-hover:scale-[1.03]" />
      ) : (
        <ImageIcon aria-hidden className="absolute top-1/2 left-1/2 size-10 -translate-1/2 text-gold-700" strokeWidth={1.25} />
      )}
      {/* Lớp bấm phủ cả ô (mở chi tiết); nhãn nằm trên lớp này */}
      <button type="button" onClick={onOpen} aria-label={`Xem chi tiết gói ${pkg.name}`} className="absolute inset-0 z-[1] rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-700" />
      {pkg.promotion && (
        <span className="pointer-events-none absolute top-2.5 left-2.5 z-[2] rounded-pill bg-moss-700 px-2.5 py-1 text-xs font-semibold text-white">{pkg.promotion}</span>
      )}
      {/* Dải nhãn sát đáy ô (dùng luôn góc bo của ô), nền kem trong hơn + làm mờ ảnh phía sau để chữ vẫn rõ trên ảnh sáng / tối */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] border-t border-white/40 bg-[rgb(251_247_238/0.72)] px-4 pt-2.5 pb-3 backdrop-blur-[10px] backdrop-saturate-150 @max-[699px]/content:px-3 @max-[699px]/content:pt-2 @max-[699px]/content:pb-2.5">
        <p className={cn('line-clamp-1 font-serif font-semibold text-ink', big ? 'text-[19px] @max-[699px]/content:text-base' : 'text-base @max-[699px]/content:text-[14px]')}>
          {pkg.name}
        </p>
        <p className="mt-0.5 flex items-baseline gap-x-1 whitespace-nowrap">
          <span className={cn('font-semibold whitespace-nowrap text-gold-700', big ? 'text-[22px] @max-[699px]/content:text-xl' : 'text-lg @max-[699px]/content:text-[15px]')}>
            {formatMoney(pkg.price)}
          </span>
          <span className="text-xs whitespace-nowrap text-ink-2">/ {pkg.unit ?? 'gói'}</span>
        </p>
      </div>
    </div>
  )
}

interface PackageDrawerProps {
  service: ServiceDetail
  pkg: ServicePackage | null
  /**
   * photos: ảnh lớn + dải ảnh nhỏ, xem kỹ từng ảnh (trang điểm, váy, chụp ảnh: layout tiles).
   * gallery: thông tin ở đầu, bên dưới là lưới toàn bộ ảnh của gói để lướt nhanh (sảnh, trang trí: layout album).
   */
  variant?: 'photos' | 'gallery'
  onClose: () => void
}

/** Khung chi tiết gói trượt từ phải: tên, thuộc tính, giá, mô tả đầy đủ, "Bao gồm" và ảnh của gói. */
export function PackageDrawer({ service, pkg, variant = 'photos', onClose }: PackageDrawerProps) {
  return (
    <DialogPrimitive.Root open={!!pkg} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(43_38_32/0.35)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Mở khung thì đặt focus ở nút đóng (Radix mặc định focus nút đầu tiên là ảnh, hiện viền focus quanh ảnh)
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-label="Đóng chi tiết gói"]')?.focus({ preventScroll: true })
          }}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-dvh flex-col border-l border-line bg-surface text-ink shadow-[-12px_0_40px_rgb(60_45_20/0.12)] outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right max-[700px]:w-full max-[700px]:border-l-0',
            variant === 'gallery' ? 'w-[min(760px,92vw)]' : 'w-[min(560px,92vw)]',
          )}
        >
          {pkg &&
            (variant === 'gallery' ? (
              <GalleryBody key={pkg.id} images={imagesOf(service, pkg)} pkg={pkg} />
            ) : (
              <DrawerBody key={pkg.id} images={imagesOf(service, pkg)} pkg={pkg} />
            ))}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Tên, thuộc tính, giá, mô tả, "Bao gồm" của gói (dùng chung cho hai kiểu khung). */
function PackageInfo({ pkg }: { pkg: ServicePackage }) {
  const attrs = attrsOf(pkg)
  const description = withoutPrice(pkg.description)
  return (
    <>
      <DialogPrimitive.Title className="font-serif text-[26px] leading-tight font-semibold">{pkg.name}</DialogPrimitive.Title>
      {attrs && <p className="mt-1 text-sm text-ink-2">{attrs}</p>}
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[13px] text-ink-2">Từ</span>
        <span className="text-2xl font-semibold text-gold-700">{formatMoney(pkg.price)}</span>
        <span className="text-[13px] text-ink-2">/ {pkg.unit ?? 'gói'}</span>
      </p>
      {!!pkg.minTables && (
        <p className="mt-1.5 text-sm text-ink-2">
          Đặt tối thiểu <b className="font-semibold text-ink">{pkg.minTables} bàn</b>
        </p>
      )}
      {description && <p className="mt-4 text-[15px] leading-[1.7] text-ink-2">{description}</p>}
      {!!pkg.includes?.length && (
        <>
          <h3 className="mt-5 mb-2 font-serif text-lg font-semibold">Bao gồm</h3>
          <ul className="grid gap-1.5">
            {pkg.includes.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[15px]">
                <Check className="mt-1 size-4 shrink-0 text-moss-700" strokeWidth={2.2} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

/** Kiểu "gallery": thông tin gói ở đầu, bên dưới lưới giữ tỉ lệ toàn bộ ảnh; bấm ảnh mới phóng to. */
function GalleryBody({ pkg, images }: { pkg: ServicePackage; images: string[] }) {
  const [viewing, setViewing] = useState<number | null>(null)
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative border-b border-line px-6 pt-6 pb-5 pr-16 max-[700px]:px-4">
          <PackageInfo pkg={pkg} />
          <DialogPrimitive.Close
            aria-label="Đóng chi tiết gói"
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-gold-100 hover:text-ink"
          >
            <X className="size-5" strokeWidth={1.75} />
          </DialogPrimitive.Close>
        </div>
        <div className="px-6 pt-4 pb-6 max-[700px]:px-4">
          <p className="mb-3 text-sm text-ink-2">{images.length} ảnh của gói · bấm ảnh để phóng to</p>
          <div className="columns-2 gap-2.5 max-[480px]:columns-1">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setViewing(i)}
                aria-label={`Phóng to ảnh ${i + 1} của gói ${pkg.name}`}
                className="mb-2.5 block w-full break-inside-avoid overflow-hidden rounded-md bg-line"
              >
                <img src={src} alt={`${pkg.name}, ảnh ${i + 1}`} loading="lazy" className="block h-auto w-full transition-transform duration-300 hover:scale-[1.03]" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <Lightbox title={pkg.name} images={images} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
    </>
  )
}

/**
 * Kiểu "photos": một cột, ảnh trên chữ dưới. Ảnh hiện nguyên khung (không cắt) trên nền kem, cao tối đa 58% màn hình
 * để tên và giá lộ ngay bên dưới; dải ảnh nhỏ để chuyển ảnh, bấm ảnh lớn để phóng to.
 */
function DrawerBody({ pkg, images }: { pkg: ServicePackage; images: string[] }) {
  const [index, setIndex] = useState(0)
  const [viewing, setViewing] = useState<number | null>(null)

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative bg-[#f3eee3]">
          {images.length ? (
            <button
              type="button"
              onClick={() => setViewing(index)}
              aria-label={`Phóng to ảnh ${index + 1} của gói ${pkg.name}`}
              className="flex h-[58vh] w-full items-center justify-center px-4 pt-4 max-[700px]:h-[55vh] max-[700px]:px-0 max-[700px]:pt-0"
            >
              <img src={images[index]} alt={`${pkg.name}, ảnh ${index + 1}`} className="max-h-full max-w-full rounded-sm object-contain max-[700px]:rounded-none" />
            </button>
          ) : (
            <div className="grid aspect-[4/3] place-items-center bg-gold-100 text-gold-700">
              <ImageIcon className="size-10" strokeWidth={1.25} aria-hidden />
            </div>
          )}
          {pkg.promotion && <span className="absolute top-4 left-4 rounded-pill bg-moss-700 px-2.5 py-1 text-xs font-semibold text-white">{pkg.promotion}</span>}

          {/* Các ảnh khác của gói */}
          {images.length > 1 && (
            <div className="flex justify-center-safe gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:thin]">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Xem ảnh ${i + 1}`}
                  aria-current={i === index || undefined}
                  className={cn('size-14 shrink-0 overflow-hidden rounded-sm border-2', i === index ? 'border-gold-700' : 'border-transparent opacity-75 hover:opacity-100')}
                >
                  <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pt-5 pb-6 max-[700px]:px-5">
          <PackageInfo pkg={pkg} />
        </div>
      </div>

      <DialogPrimitive.Close
        aria-label="Đóng chi tiết gói"
        className="absolute top-3 right-3 z-[1] grid size-10 place-items-center rounded-full bg-[rgb(251_247_238/0.92)] text-ink shadow-sm backdrop-blur-[6px] hover:bg-surface"
      >
        <X className="size-5" strokeWidth={1.75} />
      </DialogPrimitive.Close>

      <Lightbox title={pkg.name} images={images} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
    </>
  )
}
