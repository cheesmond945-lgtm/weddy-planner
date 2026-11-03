import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ServiceCard } from '@/features/catalog/components/ServiceCard'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import type { ServiceSummary } from '@/types/catalog'
import type { AiSuggestion, AiSuggestionResult } from '@/types/wedding'
import { useAiSuggestions } from '../hooks'

/** Nút gắn vào thẻ dịch vụ (yêu thích, dấu cộng thêm vào kế hoạch), do trang Dịch vụ truyền vào */
type CardActions = (s: ServiceSummary) => { imageAction?: ReactNode; extraActions?: ReactNode }

const grid = 'grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-6'

/** Nhãn nhỏ góc ảnh của thẻ được gợi ý */
export const suggestionBadge = (
  <span className="rounded-pill bg-[rgb(255_253_248/0.94)] px-2.5 py-1 text-xs font-semibold text-gold-800 shadow-sm">Gợi ý cho bạn</span>
)

/** Nơi tổ chức để ghi trên trang: phường/xã nếu có, không thì tỉnh/thành */
const placeOf = (d: AiSuggestionResult) => d.ward || d.location

/**
 * Dòng căn cứ chung phía trên các thẻ (thay cho lý do lặp lại trên từng thẻ):
 * "Gợi ý cho hạng mục trang trí: trong ngân sách 17.500.000đ tại Phường Cầu Giấy. Xếp theo mức khớp ngân sách và điểm đánh giá."
 */
export function suggestionBasis(d: AiSuggestionResult, categoryName: string) {
  return `Gợi ý cho hạng mục ${categoryName.toLowerCase()}: trong ngân sách ${formatMoney(d.budget)} tại ${placeOf(d)}. Xếp theo mức khớp ngân sách và điểm đánh giá.`
}

/**
 * Dòng ngắn dưới giá: chỉ khi có dữ liệu thật và khác nhau giữa các thẻ (backend đã lọc, ví dụ "4.8/5 từ 12 lượt"),
 * kèm cảnh báo số bàn tối thiểu của nhà hàng. Không có gì thì không hiện.
 */
export function SuggestionReasons({ suggestion }: { suggestion: AiSuggestion }) {
  if (!suggestion.reasons.length && !suggestion.warning) return null
  return (
    <div className="mt-1 grid gap-1 text-[13px] text-ink-2">
      {suggestion.reasons.map((r) => (
        <p key={r}>{r}</p>
      ))}
      {suggestion.warning && (
        <p className="flex items-start gap-1.5 text-warn">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{suggestion.warning}</span>
        </p>
      )}
    </div>
  )
}

/** Props thẻ dịch vụ khi là gợi ý: nhãn góc ảnh + lý do */
export function suggestionCardProps(s: AiSuggestion | undefined) {
  return s ? { imageBadge: suggestionBadge, details: <SuggestionReasons suggestion={s} /> } : {}
}

/**
 * Trạng thái thu gọn của "Gợi ý cho bạn" trên trang Dịch vụ (mặc định khi vào từ nút gợi ý ở Kế hoạch / Timeline):
 * dòng căn cứ, tối đa 3 thẻ dịch vụ kèm lý do, nút xem thêm. Thanh hạng mục và bộ lọc do trang ẩn đi ở trạng thái này.
 */
export function SuggestionsPanel({ categorySlug, categoryName, onExpand, cardActions }: { categorySlug: string; categoryName: string; onExpand: () => void; cardActions: CardActions }) {
  const { data, isPending, isError, error, refetch } = useAiSuggestions(categorySlug, true)
  const cat = categoryName.toLowerCase()

  return (
    <section aria-labelledby="suggest-title" className="mb-8">
      <h1 id="suggest-title" className="font-serif text-[clamp(26px,3vw,34px)] leading-tight font-semibold">
        Gợi ý cho bạn
      </h1>

      {isPending ? (
        <>
          <div className="mt-2 h-5 w-[min(520px,90%)] animate-pulse rounded-sm bg-muted" />
          <div className={`${grid} mt-6`} aria-busy="true" aria-label="Đang tìm dịch vụ phù hợp">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-line bg-surface">
                <div className="aspect-[4/3] bg-muted" />
                <div className="flex flex-col gap-3 p-5">
                  <div className="h-5 w-3/4 rounded-sm bg-muted" />
                  <div className="h-3.5 w-1/2 rounded-sm bg-muted" />
                  <div className="h-16 rounded-sm bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : isError ? (
        <div className="mt-4 rounded-xl border border-dashed border-line p-6 text-center">
          <p className="text-muted-foreground">{error.message || 'Chưa tải được gợi ý.'}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2.5">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Thử lại
            </Button>
            <Button variant="outline" size="sm" onClick={onExpand}>
              Xem tất cả dịch vụ {cat}
            </Button>
          </div>
        </div>
      ) : (
        <Results data={data} cat={cat} categoryName={categoryName} onExpand={onExpand} cardActions={cardActions} />
      )}
    </section>
  )
}

function Results({ data, cat, categoryName, onExpand, cardActions }: { data: AiSuggestionResult; cat: string; categoryName: string; onExpand: () => void; cardActions: CardActions }) {
  const shown = data.suggestions.length
  const rest = Math.max(0, (data.totalInCategory ?? 0) - shown)

  if (!shown) {
    return (
      <>
        <p className="mt-1.5 text-[15px] text-ink-2">{suggestionBasis(data, categoryName)}</p>
        <div className="mt-5 rounded-xl border border-dashed border-line p-6 text-center">
          <p className="text-ink-2">
            {data.noVenueFits && data.guestCount
              ? `Chưa có ${cat} nào đủ chỗ cho ${data.guestCount.toLocaleString('vi-VN')} khách tại ${placeOf(data)}`
              : `Chưa có dịch vụ ${cat} nào trong ngân sách của bạn tại ${placeOf(data)}`}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            <Button asChild>
              <Link to={paths.planTab.budget}>Điều chỉnh ngân sách hạng mục</Link>
            </Button>
            <Button variant="outline" onClick={onExpand}>
              Xem tất cả dịch vụ {cat}
            </Button>
          </div>
        </div>
      </>
    )
  }

  // Ít hơn 3 gợi ý mà vẫn còn dịch vụ ngoài ngân sách: mời xem tất cả thay vì "xem thêm"
  const more = shown < 3 && (data.outOfBudgetCount ?? 0) > 0 ? `Xem tất cả dịch vụ ${cat}` : rest > 0 ? `Xem thêm ${rest} dịch vụ ${cat}` : null

  return (
    <>
      <p className="mt-1.5 text-[15px] text-ink-2">{suggestionBasis(data, categoryName)}</p>
      <div className={`${grid} mt-6`}>
        {data.suggestions.map((s, i) => (
          <ServiceCard key={s.service.id} service={s.service} index={i} showCategory={false} {...cardActions(s.service)} {...suggestionCardProps(s)} />
        ))}
      </div>
      {more && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onExpand}>
            {more}
          </Button>
        </div>
      )}
    </>
  )
}

/** Thanh nhỏ trên danh sách đầy đủ khi đang ghim gợi ý: căn cứ + nút "Thu gọn" về trạng thái thu gọn */
export function SuggestionsBar({ data, categoryName, onCollapse }: { data: AiSuggestionResult | undefined; categoryName: string; onCollapse: () => void }) {
  if (!data?.suggestions.length) return null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-500/30 bg-gold-100/50 px-4 py-3 text-sm">
      <span className="text-ink-2">
        <b className="font-semibold text-ink">Gợi ý cho bạn</b> ở đầu danh sách. {suggestionBasis(data, categoryName)}
      </span>
      <Button variant="ghost" size="sm" onClick={onCollapse}>
        Thu gọn
      </Button>
    </div>
  )
}
