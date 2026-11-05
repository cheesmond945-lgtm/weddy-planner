import { Check, Star } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StarRating } from '@/features/catalog/components/StarRating'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { REVIEW_TAGS, type OrderReviewItem } from '@/types/review'
import { useOrderReviews, useSaveReviews } from '../hooks'

const MIN_LEN = 10
const MAX_LEN = 1000
const RATING_TEXT = ['', 'Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Tuyệt vời']

interface Draft {
  rating: number
  content: string
  tags: string[]
}

/**
 * Khách đánh giá đơn đã hoàn thành: mỗi gói của đơn một khối (sao, thẻ gợi ý nhanh, nội dung); đơn không gắn gói thì đánh giá các dòng.
 * Đã đánh giá thì sửa được trong 30 ngày, quá hạn chỉ xem (kèm phản hồi của nhà cung cấp nếu có).
 */
export function ReviewDialog({ orderId, vendorName, onClose }: { orderId: string; vendorName?: string; onClose: () => void }) {
  const q = useOrderReviews(orderId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Chia sẻ cảm nhận</DialogTitle>
          <DialogDescription>
            {vendorName ? `Bạn thấy dịch vụ của ${vendorName} thế nào? ` : ''}Đánh giá hiện trên trang dịch vụ (tên bạn được rút gọn), giúp các cặp đôi khác chọn nhà cung cấp.
          </DialogDescription>
        </DialogHeader>
        {q.isPending ? (
          <div className="h-[260px] animate-pulse rounded-md bg-muted" aria-busy="true" aria-label="Đang tải" />
        ) : q.isError ? (
          <p className="text-sm text-warn">{q.error.message}</p>
        ) : (
          <ReviewForm orderId={orderId} items={q.data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReviewForm({ orderId, items: all, onClose }: { orderId: string; items: OrderReviewItem[]; onClose: () => void }) {
  // Ưu tiên các dòng gắn gói; đơn không có gói nào thì đánh giá các dòng tự nhập
  const items = all.some((i) => i.isPackage) ? all.filter((i) => i.isPackage) : all
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(items.map((i) => [i.orderItemId, { rating: i.review?.rating ?? 0, content: i.review?.content ?? '', tags: i.review?.tags ?? [] }])),
  )
  const [tried, setTried] = useState(false)
  const save = useSaveReviews(orderId)

  const editable = (i: OrderReviewItem) => (i.review ? i.review.canEdit : i.canReview)
  const set = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }))
  const errorOf = (d: Draft) => (!d.rating ? 'Chọn số sao.' : d.content.trim().length < MIN_LEN ? `Viết ít nhất ${MIN_LEN} ký tự.` : null)
  // Dòng cần lưu: còn sửa được và (chưa có đánh giá, hoặc đã đổi so với đánh giá cũ)
  const changed = items.filter((i) => {
    if (!editable(i)) return false
    const d = drafts[i.orderItemId]
    const r = i.review
    return !r || r.rating !== d.rating || r.content !== d.content.trim() || r.tags.join('|') !== d.tags.join('|')
  })
  const anyEditable = items.some(editable)

  function submit() {
    setTried(true)
    if (changed.some((i) => errorOf(drafts[i.orderItemId]))) return
    if (!changed.length) return onClose()
    save.mutate(
      changed.map((i) => {
        const d = drafts[i.orderItemId]
        return { orderItemId: i.orderItemId, existing: !!i.review, body: { rating: d.rating, content: d.content.trim(), tags: REVIEW_TAGS.filter((t) => d.tags.includes(t)) } }
      }),
      { onSuccess: onClose },
    )
  }

  if (!items.length) return <p className="text-sm text-muted-foreground">Đơn này không có dịch vụ nào để đánh giá.</p>

  return (
    <>
      <div className="grid gap-5">
        {items.map((i) => {
          const d = drafts[i.orderItemId]
          const can = editable(i)
          const err = tried && changed.includes(i) ? errorOf(d) : null
          return (
            <section key={i.orderItemId} className={cn(items.length > 1 && 'rounded-md border border-line p-3.5')}>
              <h3 className="mb-2 text-[14px] font-semibold">{i.name}</h3>
              {can ? (
                <>
                  <StarInput value={d.rating} onChange={(rating) => set(i.orderItemId, { rating })} />
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Điều bạn hài lòng">
                    {REVIEW_TAGS.map((t) => {
                      const on = d.tags.includes(t)
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set(i.orderItemId, { tags: on ? d.tags.filter((x) => x !== t) : [...d.tags, t] })}
                          className={cn('inline-flex items-center gap-1 rounded-pill border px-3 py-1 text-[13px] transition-colors', on ? 'border-gold bg-gold-100 text-gold-800' : 'border-line bg-surface hover:border-gold')}
                        >
                          {on && <Check aria-hidden className="size-3.5" strokeWidth={2.6} />}
                          {t}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    rows={4}
                    maxLength={MAX_LEN}
                    value={d.content}
                    onChange={(e) => set(i.orderItemId, { content: e.target.value })}
                    aria-label={`Cảm nhận về ${i.name}`}
                    placeholder="Chất lượng dịch vụ, thái độ, đúng giờ, điều bạn thích hoặc chưa hài lòng..."
                    className="mt-3 w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
                  />
                  <div className="mt-1 flex justify-between gap-3 text-xs">
                    <span className="text-destructive">{err}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {d.content.trim().length}/{MAX_LEN}
                    </span>
                  </div>
                  {i.review?.editableUntil && <p className="mt-1 text-xs text-muted-foreground">Bạn sửa được đánh giá này đến ngày {formatDate(i.review.editableUntil.slice(0, 10))}.</p>}
                </>
              ) : i.review ? (
                <div className="text-sm">
                  <StarRating value={i.review.rating} size={15} />
                  {i.review.tags.length > 0 && <p className="mt-1.5 text-[13px] text-muted-foreground">{i.review.tags.join(' · ')}</p>}
                  <p className="mt-1.5 whitespace-pre-wrap">{i.review.content}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">Đã quá 30 ngày nên không sửa được nữa.</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chỉ đánh giá được khi đơn đã hoàn thành.</p>
              )}
              {i.review?.vendorReply && (
                <div className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-[13px]">
                  <b className="font-semibold">Phản hồi từ nhà cung cấp</b>
                  <p className="mt-0.5 whitespace-pre-wrap">{i.review.vendorReply.content}</p>
                </div>
              )}
            </section>
          )
        })}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {anyEditable ? 'Để sau' : 'Đóng'}
        </Button>
        {anyEditable && (
          <Button type="button" onClick={submit} disabled={save.isPending}>
            {items.some((i) => i.review) ? 'Lưu đánh giá' : 'Gửi đánh giá'}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

/** Chọn 1 đến 5 sao (rê chuột xem trước), kèm chữ mô tả mức */
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Số sao" className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sao`} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)} className="p-0.5">
            <Star className={cn('size-8 transition-colors', n <= shown ? 'fill-gold text-gold' : 'text-line')} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      {shown > 0 && <span className="text-sm font-medium text-gold-700">{RATING_TEXT[shown]}</span>}
    </div>
  )
}
