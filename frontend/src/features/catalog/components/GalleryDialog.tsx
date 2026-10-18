import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface GalleryDialogProps {
  title: string
  images: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Xem tất cả ảnh của dịch vụ (openGallery trong prototype). */
export function GalleryDialog({ title, images, open, onOpenChange }: GalleryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[780px]">
        <DialogHeader>
          <DialogTitle>Ảnh của {title}</DialogTitle>
          <DialogDescription className="sr-only">{images.length} ảnh</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
          {images.map((src, i) => (
            <div key={src} className="h-[170px] overflow-hidden rounded-lg bg-line">
              <img src={src} alt={`${title}, ảnh ${i + 1}`} loading="lazy" className="block size-full object-cover" />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
