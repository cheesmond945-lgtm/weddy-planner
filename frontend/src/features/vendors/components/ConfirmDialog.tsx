import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  /** Biểu tượng tròn phía trên tiêu đề. */
  icon?: ReactNode
  onConfirm: () => void
}

/** Hộp thoại xác nhận Hủy / Đồng ý (ConfirmDialog trong prototype NCC). */
export function ConfirmDialog({ open, onOpenChange, title, children, confirmLabel, cancelLabel = 'Hủy', danger, icon, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          {/* Có icon: tiêu đề nằm trên dải nền màu tràn mép popup (bù p-6 của DialogContent và pr-10 của DialogHeader) */}
          <div
            className={cn(
              'flex items-center gap-3',
              icon && '-mt-6 -mr-16 mb-4 -ml-6 py-4 pr-16 pl-6',
              icon && (danger ? 'bg-warn-soft' : 'bg-gold-soft'),
            )}
          >
            {icon && (
              <div className={cn('grid size-11 shrink-0 place-items-center rounded-full bg-surface [&_svg]:size-5', danger ? 'text-warn' : 'text-gold')}>
                {icon}
              </div>
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription asChild>
            <div className="text-sm leading-relaxed text-ink [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="min-w-24" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            className="min-w-24"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
