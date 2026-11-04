import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// shadcn/ui Dialog, chỉnh theo .mb / .md trong prototype

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Khung chung của mọi hộp thoại: đầu (DialogHeader, viền dưới), thân cuộn, chân (DialogFooter, viền trên) dính mép khi nội dung dài,
 * nút đóng cố định ở góc. Mọi thứ đặt trong DialogContent đều nằm trong thân; DialogHeader / DialogFooter tự tràn ra mép nhờ --dp (lề thân).
 * bare: bỏ khung này, nơi gọi tự dàn bố cục (lá thư giấy, hộp đăng nhập, hộp điều khoản có thanh tiêu đề riêng).
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  bare = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean; bare?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface text-ink shadow-portal-lift outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          bare ? 'overflow-auto p-6 [--dp:0px]' : 'flex flex-col overflow-hidden p-0',
          className,
        )}
        {...props}
      >
        {bare ? children : <div data-slot="dialog-body" className="min-h-0 flex-1 overflow-y-auto p-[var(--dp)] [--dp:1.5rem] max-sm:[--dp:1rem]">{children}</div>}
        {showCloseButton && (
          <DialogPrimitive.Close
            aria-label="Đóng"
            className="absolute top-4 right-4 z-20 grid size-8 place-items-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink hover:bg-surface-2"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('sticky top-0 z-10 -mx-[var(--dp)] -mt-[var(--dp)] mb-5 border-b border-line bg-surface px-6 pt-5 pr-16 pb-4 max-sm:px-4 max-sm:pr-14', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('sticky bottom-0 z-10 -mx-[var(--dp)] -mb-[var(--dp)] mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-line bg-surface-2 px-6 py-3.5 max-sm:px-4', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn('font-serif text-2xl leading-tight font-semibold [overflow-wrap:anywhere]', className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn('mt-1.5 text-sm text-muted-foreground', className)} {...props} />
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogTitle, DialogTrigger }
