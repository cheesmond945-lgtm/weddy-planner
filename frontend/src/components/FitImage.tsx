import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Ảnh cao hơn khung quá mức này (40%) thì canh gần mép trên để giữ khuôn mặt */
const TALLER = 0.4

interface FitImageProps {
  src: string
  alt?: string
  loading?: 'lazy' | 'eager'
  /** Lớp của khung (kích thước, bo góc...) */
  className?: string
  /** Lớp thêm cho ảnh (ví dụ phóng nhẹ khi rê chuột: group-hover:scale-[1.03]) */
  imgClassName?: string
}

/**
 * Ảnh lấp đầy khung (object-fit cover), chọn điểm canh để không cắt mất mặt người:
 * - Thường: "50% 35%" (thân trên người thường ở nửa trên ảnh cưới).
 * - Ảnh cao hơn khung nhiều (ảnh dọc trong ô ngang): "50% 18%", giữ phần đầu, cắt bớt phần chân.
 * Đo lại khi khung đổi kích thước (đổi bố cục theo màn hình).
 */
export function FitImage({ src, alt = '', loading = 'lazy', className, imgClassName }: FitImageProps) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [tall, setTall] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    const img = imgRef.current
    if (!box || !img) return
    const measure = () => {
      if (!img.naturalWidth || !box.clientWidth || !box.clientHeight) return
      const imgRatio = img.naturalWidth / img.naturalHeight
      const boxRatio = box.clientWidth / box.clientHeight
      setTall(boxRatio / imgRatio - 1 > TALLER)
    }
    measure()
    img.addEventListener('load', measure)
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => {
      img.removeEventListener('load', measure)
      ro.disconnect()
    }
  }, [src])

  return (
    <span ref={boxRef} className={cn('relative block overflow-hidden bg-line', className)}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className={cn('absolute inset-0 size-full object-cover transition-transform duration-300', tall ? 'object-[50%_18%]' : 'object-[50%_35%]', imgClassName)}
      />
    </span>
  )
}
