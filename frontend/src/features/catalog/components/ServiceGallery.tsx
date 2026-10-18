import { LayoutGrid } from 'lucide-react'

interface ServiceGalleryProps {
  name: string
  images: string[]
  onOpenAll: () => void
}

/** Lưới 5 ảnh đầu trang chi tiết (dgal trong prototype). */
export function ServiceGallery({ name, images, onOpenAll }: ServiceGalleryProps) {
  return (
    <div className="relative mt-5 mb-7 grid h-[clamp(260px,38vw,450px)] grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-2 overflow-hidden rounded-[24px] max-[700px]:h-[420px] max-[700px]:grid-cols-2 max-[700px]:grid-rows-[1.6fr_1fr_1fr]">
      {images.slice(0, 5).map((src, i) => (
        <button
          key={src}
          type="button"
          aria-label={`Xem ảnh ${i + 1}`}
          onClick={onOpenAll}
          className="block overflow-hidden bg-line first:row-span-2 max-[700px]:first:col-span-2 max-[700px]:first:row-span-1"
        >
          <img src={src} alt={`${name}, ảnh ${i + 1}`} loading={i ? 'lazy' : undefined} className="block size-full object-cover" />
        </button>
      ))}
      <button
        type="button"
        onClick={onOpenAll}
        className="absolute right-3.5 bottom-3.5 inline-flex items-center gap-2 rounded-pill bg-surface px-4 py-[9px] text-[13px] font-semibold text-ink shadow-fab"
      >
        <LayoutGrid className="size-4" aria-hidden />
        Xem tất cả {images.length} ảnh
      </button>
    </div>
  )
}
