import { LayoutGrid } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FitImage } from '@/components/FitImage'
import { cn } from '@/lib/utils'

interface ServiceGalleryProps {
  name: string
  images: string[]
  onOpenAll: () => void
}

/** Số ảnh xét hướng: đủ để biết NCC chủ yếu chụp dọc hay ngang */
const SAMPLE = 9

/**
 * Hướng chủ đạo của ảnh (đọc kích thước thật của vài ảnh đầu). Từ 2/3 số ảnh là dọc thì coi là "portrait".
 * Chưa đọc xong trả null (dùng bố cục ngang mặc định, chiều cao khung không đổi nên không nhảy trang).
 */
function useMostlyPortrait(images: string[]) {
  const [portrait, setPortrait] = useState<boolean | null>(null)
  const key = images.slice(0, SAMPLE).join('|')

  useEffect(() => {
    let cancelled = false
    const sample = key ? key.split('|') : []
    Promise.all(
      sample.map(
        (src) =>
          new Promise<number | null>((resolve) => {
            const img = new Image()
            img.onload = () => resolve(img.naturalWidth / img.naturalHeight)
            img.onerror = () => resolve(null)
            img.src = src
          }),
      ),
    ).then((ratios) => {
      if (cancelled) return
      const known = ratios.filter((r): r is number => r !== null)
      setPortrait(known.length > 0 && known.filter((r) => r < 0.9).length / known.length >= 2 / 3)
    })
    return () => {
      cancelled = true
    }
  }, [key])

  return portrait
}

/**
 * Lưới ảnh đầu trang chi tiết (dgal trong prototype), chọn bố cục theo hướng ảnh để ảnh không bị cắt mất mặt:
 * - Ảnh ngang (sảnh, trang trí): 1 ảnh lớn + 4 ảnh nhỏ.
 * - Ảnh dọc (trang điểm, váy cưới): 1 ảnh dọc lớn + 8 ảnh dọc nhỏ (2 hàng × 4); điện thoại: 1 lớn + 2 nhỏ.
 */
export function ServiceGallery({ name, images, onOpenAll }: ServiceGalleryProps) {
  const portrait = useMostlyPortrait(images)
  const shown = images.slice(0, portrait ? 9 : 5)

  return (
    <div
      className={cn(
        'relative mt-5 mb-7 grid h-[clamp(260px,38vw,450px)] grid-rows-2 gap-2 overflow-hidden rounded-[24px]',
        portrait
          ? 'grid-cols-[1.75fr_repeat(4,1fr)] max-[700px]:h-[360px] max-[700px]:grid-cols-[2fr_1fr]'
          : 'grid-cols-[2fr_1fr_1fr] max-[700px]:h-[420px] max-[700px]:grid-cols-2 max-[700px]:grid-rows-[1.6fr_1fr_1fr]',
      )}
    >
      {shown.map((src, i) => (
        <button
          key={src}
          type="button"
          aria-label={`Xem ảnh ${i + 1}`}
          onClick={onOpenAll}
          className={cn(
            'block overflow-hidden bg-line first:row-span-2',
            portrait
              ? // Điện thoại: chỉ 1 ảnh lớn + 2 ảnh nhỏ xếp dọc bên phải
                'max-[700px]:nth-[n+4]:hidden'
              : 'max-[700px]:first:col-span-2 max-[700px]:first:row-span-1',
          )}
        >
          <FitImage src={src} alt={`${name}, ảnh ${i + 1}`} loading={i ? 'lazy' : 'eager'} className="size-full" />
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
