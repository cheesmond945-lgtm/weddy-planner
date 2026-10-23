import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { VendorFile } from '@/types/vendor'

interface PhotoViewerDialogProps {
  title: string
  photos: VendorFile[]
  /** Ảnh đang mở; null là đóng */
  index: number | null
  onClose: () => void
}

/** Xem ảnh lớn, chuyển ảnh bằng nút hoặc phím mũi tên (lightbox trong prototype NCC). */
export function PhotoViewerDialog({ title, photos, index, onClose }: PhotoViewerDialogProps) {
  return (
    <Dialog open={index !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[860px]">
        {index !== null && <Viewer key={index} title={title} photos={photos} start={index} />}
      </DialogContent>
    </Dialog>
  )
}

function Viewer({ title, photos, start }: { title: string; photos: VendorFile[]; start: number }) {
  const [i, setI] = useState(start)
  const n = photos.length
  const photo = photos[Math.min(i, n - 1)]
  if (!photo) return null
  const go = (step: number) => setI((x) => (x + step + n) % n)

  return (
    <div
      onKeyDown={(e) => {
        if (n < 2) return
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {photo.fileName} · Ảnh {i + 1} / {n}
        </DialogDescription>
      </DialogHeader>
      <div className="relative grid place-items-center overflow-hidden rounded-md bg-surface-2">
        <img src={photo.url} alt={`${title}, ảnh ${i + 1}`} className="max-h-[70dvh] w-auto object-contain" />
        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="Ảnh trước"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-ink shadow-portal hover:bg-surface"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Ảnh sau"
              onClick={() => go(1)}
              className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-ink shadow-portal hover:bg-surface"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
