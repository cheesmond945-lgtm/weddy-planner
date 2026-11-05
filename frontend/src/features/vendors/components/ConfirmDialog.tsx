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
        <DialogHeader className="flex items-center gap-3">
          {icon && (
            <div className={cn('grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5', danger ? 'bg-warn-soft text-warn' : 'bg-gold-soft text-gold-ink')}>{icon}</div>
          )}
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className="text-sm leading-relaxed text-ink [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
        </DialogDescription>
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
