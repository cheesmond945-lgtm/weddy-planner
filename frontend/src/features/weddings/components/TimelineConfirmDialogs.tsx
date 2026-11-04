import { CircleCheck, Trash2, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TimelineItem } from '@/types/wedding'

interface ConfirmProps {
  item: TimelineItem | null
  onClose: () => void
  onConfirm: (item: TimelineItem) => void
}

interface ConfirmLayoutProps extends ConfirmProps {
  title: string
  icon: LucideIcon
  /** Câu hỏi đứng trước tên việc ("Bạn đã hoàn thành công việc") */
  question: string
  /** Dòng nhỏ dưới tên việc (hệ quả), nếu có */
  hint?: string
  confirmLabel: string
}

/** Khung chung của hộp xác nhận trên timeline: tiêu đề, biểu tượng tròn vàng nhạt, tên việc in đậm, hai nút Đóng / xác nhận. */
function ConfirmLayout({ item, onClose, onConfirm, title, icon: Icon, question, hint, confirmLabel }: ConfirmLayoutProps) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px] rounded-[28px] px-8 pt-9 pb-8 text-center">
        <DialogHeader className="items-center px-10">
          <DialogTitle className="text-center text-[30px] font-medium">{title}</DialogTitle>
          <span aria-hidden className="mx-auto mt-3 block h-1 w-12 rounded-pill bg-gold-100" />
        </DialogHeader>
        <span className="mx-auto mt-6 mb-4 grid size-[72px] place-items-center rounded-full bg-gold-100 text-gold-700" aria-hidden>
          <Icon className="size-10" strokeWidth={2.2} />
        </span>
        <DialogDescription className="text-center text-base">
          {question}
          <b className="mt-1.5 block font-semibold text-ink">“{item?.title}”?</b>
          {hint && <span className="mt-2 block text-[13px]">{hint}</span>}
        </DialogDescription>
        <DialogFooter className="mt-8 grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" className="h-12 rounded-[16px] font-bold uppercase tracking-[0.08em]" onClick={onClose}>
            Đóng
          </Button>
          <Button type="button" className="h-12 rounded-[16px] font-bold uppercase tracking-[0.08em]" autoFocus onClick={() => item && onConfirm(item)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Hộp "Xác nhận hoàn thành" khi bấm thẻ hoặc ô tick của việc chưa xong. */
export function CompleteTaskDialog(props: ConfirmProps) {
  return <ConfirmLayout {...props} title="Xác nhận hoàn thành" icon={CircleCheck} question="Bạn đã hoàn thành công việc" confirmLabel="Hoàn thành" />
}

/** Hộp "Xác nhận xóa" trước khi xóa việc khung hoặc việc tự thêm. */
export function DeleteTaskDialog(props: ConfirmProps) {
  return <ConfirmLayout {...props} title="Xác nhận xóa" icon={Trash2} question="Bạn muốn xóa công việc" hint="Việc sẽ bị xóa khỏi timeline của bạn." confirmLabel="Xóa" />
}
