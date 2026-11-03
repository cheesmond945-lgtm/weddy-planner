import { Check, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TimelineItem } from '@/types/wedding'

interface ConfirmProps {
  item: TimelineItem | null
  onClose: () => void
  onConfirm: (item: TimelineItem) => void
}

/** Hộp "Xác nhận hoàn thành" khi bấm thẻ hoặc ô tick của việc chưa xong. */
export function CompleteTaskDialog({ item, onClose, onConfirm }: ConfirmProps) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[420px] text-center">
        <DialogHeader className="items-center">
          <span className="mx-auto mb-1 grid size-14 place-items-center rounded-full bg-sage text-white" aria-hidden>
            <Check className="size-7" strokeWidth={3} />
          </span>
          <DialogTitle className="text-center text-2xl">Chúc mừng bạn!</DialogTitle>
          <DialogDescription className="text-center text-base">Bạn đã hoàn thành công việc “{item?.title}”?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 sm:justify-center">
          <Button type="button" variant="outline" className="min-w-28 uppercase tracking-[0.08em]" onClick={onClose}>
            Đóng
          </Button>
          <Button type="button" className="min-w-28 uppercase tracking-[0.08em]" autoFocus onClick={() => item && onConfirm(item)}>
            Hoàn thành
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Hỏi ngắn trước khi đưa việc đã xong về "Chưa xong". */
export function ReopenTaskDialog({ item, onClose, onConfirm }: ConfirmProps) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[420px] text-center">
        <DialogHeader className="items-center">
          <span className="mx-auto mb-1 grid size-12 place-items-center rounded-full bg-muted text-ink" aria-hidden>
            <RotateCcw className="size-6" />
          </span>
          <DialogTitle className="text-center text-xl">Đưa về “Chưa xong”?</DialogTitle>
          <DialogDescription className="text-center text-base">Công việc “{item?.title}” sẽ quay lại danh sách cần làm.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 sm:justify-center">
          <Button type="button" variant="outline" className="min-w-28" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" className="min-w-28" autoFocus onClick={() => item && onConfirm(item)}>
            Đưa về
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
