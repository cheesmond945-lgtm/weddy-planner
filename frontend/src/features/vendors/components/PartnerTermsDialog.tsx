import { Handshake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { fillTerms, TERMS_ARTICLES, TERMS_EFFECTIVE_DATE, TERMS_INTRO, type TermsVars } from '../partnerTerms'

/** "Điều 1. Phí hoa hồng" -> số điều và tên điều. */
const splitTitle = (title: string) => {
  const m = /^Điều\s+(\d+)\.\s*(.*)$/.exec(title)
  return { no: m?.[1] ?? '', name: m?.[2] ?? title }
}

/** Toàn văn Điều khoản hợp tác dành cho đối tác, đã điền tên doanh nghiệp, loại dịch vụ và tỷ lệ hoa hồng của NCC. */
export function PartnerTermsDialog({ open, onOpenChange, vars }: { open: boolean; onOpenChange: (open: boolean) => void; vars: TermsVars }) {
  const t = (s: string) => fillTerms(s, vars)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gold-palette flex max-h-[min(88dvh,820px)] max-w-[760px] flex-col gap-0 overflow-hidden p-0">
        {/* Đầu hộp thoại: dải vàng, biểu tượng, tiêu đề, phiên bản */}
        <div className="border-b border-line bg-gold-soft px-7 pt-6 pb-5 pr-16">
          <div className="flex items-start gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-(image:--gold-grad) text-gold-on shadow-[0_8px_20px_-10px_rgba(169,130,58,0.8)]">
              <Handshake className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <DialogTitle className="bg-[linear-gradient(90deg,var(--sage),var(--gold))] bg-clip-text pr-1 pb-1 font-serif text-[clamp(34px,6vw,46px)] leading-[1.1] font-medium tracking-normal text-transparent italic">
                Điều khoản hợp tác
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[13px] text-muted-foreground">Dành cho đối tác Everly</DialogDescription>
              <div className="mt-2.5 flex flex-wrap gap-2 text-[11.5px] font-medium">
                <span className="rounded-pill border border-line bg-surface px-2.5 py-0.5 text-muted-foreground">Hiệu lực từ {TERMS_EFFECTIVE_DATE}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nội dung cuộn */}
        <div className="grid gap-5 overflow-y-auto px-7 py-6 text-sm leading-relaxed">
          <p className="rounded-lg border border-gold/30 bg-gold-soft/60 px-4 py-3 text-[13.5px] text-ink">{t(TERMS_INTRO)}</p>

          {TERMS_ARTICLES.map((a) => {
            const { no, name } = splitTitle(a.title)
            return (
              <section key={a.title} className="rounded-lg border border-line bg-surface px-5 py-4">
                <h3 className="mb-2.5 font-sans text-[16px] font-semibold">
                  <span className="text-gold-ink">Điều {no}:</span> {name}
                </h3>
                <ul className="grid gap-2 text-ink/90">
                  {a.paragraphs.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gold" />
                      <span>{t(p)}</span>
                    </li>
                  ))}
                  {a.bullets?.map((b) => (
                    <li key={b} className="ml-[18px] flex gap-2.5">
                      <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full border border-gold" />
                      <span>{t(b)}</span>
                    </li>
                  ))}
                  {a.after?.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gold" />
                      <span>{t(p)}</span>
                    </li>
                  ))}
                </ul>
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
