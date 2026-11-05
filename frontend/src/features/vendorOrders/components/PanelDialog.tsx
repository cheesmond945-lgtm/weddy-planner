import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface PanelDialogProps {
  open: boolean
  /** Bấm X, Esc hoặc nền mờ */
  onRequestClose: () => void
  title: string
  subtitle?: ReactNode
  footer?: ReactNode
  /** Rộng tối đa: lg 860px (xem đơn), xl 1160px (form đơn) */
  size?: 'md' | 'lg' | 'xl'
  children: ReactNode
}

const WIDTH = { md: 'max-w-[640px]', lg: 'max-w-[860px]', xl: 'max-w-[1160px]' }

/** Hộp thoại lớn: dùng khung chung của Dialog (đầu và chân dính mép, thân cuộn), chỉ thêm cỡ rộng và cách đóng. */
export function PanelDialog({ open, onRequestClose, title, subtitle, footer, size = 'lg', children }: PanelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onRequestClose()}>
      <DialogContent
        className={cn('max-h-[92dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:rounded-none', WIDTH[size])}
        onInteractOutside={(e) => {
          e.preventDefault()
          // Bấm hoặc nhận focus trong hộp thoại khác nằm chồng lên (hộp xác nhận) thì không phải đóng hộp này
          if ((e.target as HTMLElement | null)?.closest('[role=dialog], [role=alertdialog]')) return
          onRequestClose()
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          onRequestClose()
        }}
      >
        <DialogHeader>
          <DialogTitle className="[overflow-wrap:anywhere]">{title}</DialogTitle>
          <DialogDescription className={cn('mt-1 text-[12.5px]', !subtitle && 'sr-only')}>{subtitle ?? title}</DialogDescription>
        </DialogHeader>
        {children}
        {footer && <DialogFooter className="max-sm:[&>button]:flex-1">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
