import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
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

/** Hộp thoại lớn: tiêu đề và chân cố định, thân cuộn (.modal trong prototype NCC). Dựng trên Dialog có sẵn. */
export function PanelDialog({ open, onRequestClose, title, subtitle, footer, size = 'lg', children }: PanelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onRequestClose()}>
      <DialogContent
        className={cn('flex max-h-[92dvh] flex-col overflow-hidden p-0 max-sm:max-h-[100dvh] max-sm:w-full max-sm:rounded-none', WIDTH[size])}
        onInteractOutside={(e) => {
          e.preventDefault()
          onRequestClose()
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          onRequestClose()
        }}
      >
        <div className="flex-none border-b border-line py-4 pr-16 pl-6 max-sm:pl-4">
          <DialogTitle className="text-[26px] leading-tight [overflow-wrap:anywhere]">{title}</DialogTitle>
          <DialogDescription className={cn('mt-1 text-[12.5px]', !subtitle && 'sr-only')}>{subtitle ?? title}</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-sm:px-4">{children}</div>
        {footer && (
          <div className="flex flex-none flex-wrap items-center justify-end gap-2.5 border-t border-line bg-surface px-6 py-3.5 max-sm:px-4 max-sm:pb-[calc(10px+env(safe-area-inset-bottom,0px))] max-sm:[&>button]:flex-1">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
