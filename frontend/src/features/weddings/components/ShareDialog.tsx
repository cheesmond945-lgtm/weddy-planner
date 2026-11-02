import { Copy, Link2, RefreshCw } from 'lucide-react'
import { fullLink } from '@/api/sharing'
import { FormError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { PLAN_TABS, type PlanTab } from '@/types/wedding'
import { PLAN_TAB_LABEL, VISIBLE_PLAN_TABS, withTaskAccess } from '../access'
import { copyLink, useSharingMutations, useShareLink } from '../sharingHooks'

/** Chọn subtab được xem: tắt được mọi tab, miễn còn ít nhất 1. Quyền 'timeline' (thẻ Công việc) đi kèm Tổng quan. */
export function TabPicker({ value, onChange, disabled, label = 'Phần được xem' }: { value: PlanTab[]; onChange: (tabs: PlanTab[]) => void; disabled?: boolean; label?: string }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-[13px] font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {VISIBLE_PLAN_TABS.map((t) => {
          const on = value.includes(t)
          const last = on && value.filter((x) => x !== 'timeline').length === 1
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              title={last ? 'Phải còn ít nhất 1 phần được xem' : undefined}
              onClick={() => !last && onChange(withTaskAccess(on ? value.filter((x) => x !== t) : PLAN_TABS.filter((x) => x === t || value.includes(x))))}
              className={cn('rounded-pill border px-3 py-1 text-[13px] font-medium disabled:opacity-60', on ? 'border-gold bg-accent-soft text-gold-700' : 'border-line text-muted-foreground hover:border-primary', last && 'cursor-not-allowed')}
            >
              {PLAN_TAB_LABEL[t]}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function PublicLinkSection() {
  const { data: link, isPending, error } = useShareLink()
  const { putShareLink, regenerate } = useSharingMutations()
  if (isPending) return <div className="h-16 animate-pulse rounded-md bg-muted" />
  if (!link) return <FormError message={error?.message} />
  const url = link.path ? fullLink(link.path) : null
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-[18px] accent-sage" checked={link.enabled} disabled={putShareLink.isPending} onChange={(e) => putShareLink.mutate({ enabled: e.target.checked })} />
        Bật link xem kế hoạch
      </label>
      {link.enabled && (
        <>
          <TabPicker value={link.tabs} disabled={putShareLink.isPending} onChange={(tabs) => putShareLink.mutate({ tabs })} />
          <p className="text-[13px] text-muted-foreground">Tab Dịch vụ chỉ hiện giá khi tab Ngân sách cũng được chia sẻ. Người xem không thấy ghi chú, tin nhắn, đơn hàng và email.</p>
          {url && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-muted-foreground">
                <Link2 className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{url}</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => void copyLink(url)}>
                <Copy />
                Sao chép
              </Button>
              <Button variant="ghost" size="sm" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
                <RefreshCw />
                Tạo link mới
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Hộp "Chia sẻ kế hoạch": một link xem công khai, ai có link cũng xem được, không cần đăng nhập. */
export function ShareDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Chia sẻ kế hoạch</DialogTitle>
          <DialogDescription>Ai có link đều xem được kế hoạch (chỉ xem, không chỉnh sửa, không cần đăng nhập).</DialogDescription>
        </DialogHeader>
        {open && <PublicLinkSection />}
      </DialogContent>
    </Dialog>
  )
}
