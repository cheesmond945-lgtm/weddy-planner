import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
}

/** Hộp thoại xác nhận Hủy / Đồng ý (ConfirmDialog trong prototype NCC). */
export function ConfirmDialog({ open, onOpenChange, title, children, confirmLabel, cancelLabel = 'Hủy', danger, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm leading-relaxed text-ink [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
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
