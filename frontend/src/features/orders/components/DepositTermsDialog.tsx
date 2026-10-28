import { ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { DEPOSIT_TERMS_ARTICLES, DEPOSIT_TERMS_INTRO } from '../depositTerms'

/** "Điều 1. Hủy đơn..." -> số điều và tên điều. */
const splitTitle = (title: string) => {
  const m = /^Điều\s+(\d+)\.\s*(.*)$/.exec(title)
  return { no: m?.[1] ?? '', name: m?.[2] ?? title }
}

/** Toàn văn Điều khoản đặt dịch vụ dành cho khách hàng. Bố cục giống Điều khoản hợp tác của đối tác. */
export function DepositTermsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gold-palette flex max-h-[min(88dvh,820px)] max-w-[760px] flex-col gap-0 overflow-hidden p-0">
        {/* Đầu hộp thoại: dải màu nhấn, biểu tượng, tiêu đề, phiên bản */}
        <div className="border-b border-line bg-gold-soft px-7 pt-6 pr-16 pb-5">
          <div className="flex items-start gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-(image:--gold-grad) text-gold-on shadow-[0_8px_20px_-10px_rgba(169,130,58,0.8)]">
              <ScrollText className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <DialogTitle className="bg-[linear-gradient(90deg,var(--sage),var(--gold))] bg-clip-text pr-1 pb-1 font-serif text-[clamp(30px,5.5vw,42px)] leading-[1.1] font-medium tracking-normal text-transparent italic">
                Điều khoản đặt dịch vụ
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[13px] text-muted-foreground">Dành cho khách hàng của Everly</DialogDescription>
            </div>
          </div>
        </div>

        {/* Nội dung cuộn */}
        <div className="grid gap-5 overflow-y-auto px-7 py-6 text-sm leading-relaxed">
          <p className="rounded-lg border border-gold/30 bg-gold-soft/60 px-4 py-3 text-[13.5px] text-ink">{DEPOSIT_TERMS_INTRO}</p>

          {DEPOSIT_TERMS_ARTICLES.map((a) => {
            const { no, name } = splitTitle(a.title)
            return (
              <section key={a.title} className="rounded-lg border border-line bg-surface px-5 py-4">
                <h3 className="mb-2.5 flex flex-wrap items-center gap-2 font-sans text-[16px] font-semibold">
                  <span>
                    <span className="text-gold-ink">Điều {no}:</span> {name}
                  </span>
                  {a.key && <span className="rounded-pill bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">Quan trọng</span>}
                </h3>
                <p className="flex gap-2.5 text-ink/90">
                  <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gold" />
                  <span>{a.body}</span>
                </p>
              </section>
            )
          })}
        </div>

        <DialogFooter className="mt-0 border-t border-line bg-surface px-7 py-4">
          <Button className="h-10 min-w-28" onClick={() => onOpenChange(false)}>
            Đã hiểu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
