import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface GalleryDialogProps {
  title: string
  images: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const roundBtn = 'grid size-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white'

/** Khung xem một ảnh lớn, nền tối toàn màn hình, nguyên khung gốc; chuyển ảnh bằng nút hoặc phím mũi tên. */
function Lightbox({ title, images, index, onIndex, onClose }: { title: string; images: string[]; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const count = images.length
  const open = index !== null

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count)
      else if (e.key === 'ArrowRight') onIndex((index + 1) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, count, onIndex])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-[#070a14]/95 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[70] outline-none"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {index !== null && (
            <>
              <div className="grid h-full place-items-center px-20 py-6 max-sm:px-3" onClick={(e) => e.target === e.currentTarget && onClose()}>
                <img src={images[index]} alt={`${title}, ảnh ${index + 1}`} className="block max-h-[84vh] max-w-full rounded-xl object-contain shadow-2xl" />
              </div>
              <DialogPrimitive.Close aria-label="Đóng" className={`${roundBtn} absolute top-4 right-4 size-11`}>
                <XIcon className="size-5" />
              </DialogPrimitive.Close>
              {count > 1 && (
                <>
                  <button type="button" aria-label="Ảnh trước" onClick={() => onIndex((index - 1 + count) % count)} className={`${roundBtn} absolute top-1/2 left-4 -translate-y-1/2 max-sm:left-2 max-sm:size-10`}>
                    <ChevronLeft className="size-6" />
                  </button>
                  <button type="button" aria-label="Ảnh sau" onClick={() => onIndex((index + 1) % count)} className={`${roundBtn} absolute top-1/2 right-4 -translate-y-1/2 max-sm:right-2 max-sm:size-10`}>
                    <ChevronRight className="size-6" />
                  </button>
                </>
              )}
              <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[15px] font-medium text-white/70 tabular-nums">
                {index + 1} / {count}
              </p>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Xem tất cả ảnh của dịch vụ hoặc của một gói: lưới giữ đúng tỷ lệ từng ảnh.
 * Bấm một ảnh để xem nguyên khung gốc trong khung xem lớn.
 */
export function GalleryDialog({ title, images, open, onOpenChange }: GalleryDialogProps) {
  const [view, setView] = useState<number | null>(null)

  // Đóng bộ sưu tập thì đóng luôn khung xem lớn
  useEffect(() => {
    if (!open) setView(null)
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-[900px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ảnh của {title}</DialogTitle>
            <DialogDescription className="sr-only">{images.length} ảnh</DialogDescription>
          </DialogHeader>
          <div className="columns-2 gap-2 sm:columns-3">
            {images.map((src, i) => (
              <button key={src} type="button" onClick={() => setView(i)} aria-label={`Xem ảnh ${i + 1}`} className="mb-2 block w-full break-inside-avoid overflow-hidden rounded-lg bg-line">
                <img src={src} alt={`${title}, ảnh ${i + 1}`} loading="lazy" className="block h-auto w-full transition-transform duration-300 hover:scale-[1.03]" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Lightbox title={title} images={images} index={view} onIndex={setView} onClose={() => setView(null)} />
    </>
  )
}
