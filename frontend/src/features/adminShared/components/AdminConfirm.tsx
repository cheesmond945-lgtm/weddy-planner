import { LoaderCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface AdminConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: LucideIcon
  title: string
  children: ReactNode
  /** Khối lưu ý (nền vàng nhạt) dưới nội dung */
  notice?: ReactNode
  confirmLabel: string
  confirmIcon?: LucideIcon
  /** Hành động nguy hiểm (xóa): nút và biểu tượng màu cảnh báo */
  danger?: boolean
  pending?: boolean
  onConfirm: () => void
}

/** Hộp xác nhận ở giữa màn hình: biểu tượng tròn, tiêu đề, nội dung, hai nút Hủy / Xác nhận. */
export function AdminConfirm({ open, onOpenChange, icon: Icon, title, children, notice, confirmLabel, confirmIcon: ConfirmIcon, danger, pending, onConfirm }: AdminConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-w-[480px] px-6 pt-8 pb-6 text-center">
        <span className={cn('mx-auto grid size-16 place-items-center rounded-full', danger ? 'bg-warn-soft text-warn' : 'bg-gold-soft text-gold-ink')}>
          <Icon className="size-7" />
        </span>
        <DialogTitle className="mt-4 text-[22px]">{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{children}</div>
        </DialogDescription>
        {notice && <div className="mt-4 rounded-md border border-gold/30 bg-gold-soft px-4 py-3 text-left text-[13px] text-gold-ink">{notice}</div>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" className="border-line-strong" disabled={pending} onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button size="lg" variant={danger ? 'destructive' : 'default'} disabled={pending} onClick={onConfirm}>
            {pending ? <LoaderCircle className="animate-spin" /> : ConfirmIcon && <ConfirmIcon />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
