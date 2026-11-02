import { Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { RatingMeta } from '@/features/catalog/components/RatingMeta'
import { formatMillions, formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import { useAiSuggestions, useBudgetMutations } from '../hooks'
import { AddToPlanButton } from '../planActions'

interface AiSuggestionStripProps {
  categorySlug: string
  categoryName: string
  onClose: () => void
}

/** Khung "Gợi ý bằng AI cho hạng mục …" trên trang Dịch vụ cưới (aiStrip trong prototype). */
export function AiSuggestionStrip({ categorySlug, categoryName, onClose }: AiSuggestionStripProps) {
  const { data, isPending, isError, error, refetch } = useAiSuggestions(categorySlug, true)
  const { setManual, clearManual } = useBudgetMutations()
  const cat = categoryName.toLowerCase()

  /** Một chạm: tăng ngân sách hạng mục lên đúng chi phí gói rẻ nhất đủ chỗ, kèm Hoàn tác. */
  function raiseBudget(categoryId: string, amount: number, previous: { amount: number; manual: boolean }) {
    setManual.mutate(
      { categoryId, amount },
      {
        onSuccess: () => {
          void refetch()
          toast(`Đã tăng ngân sách ${cat} lên ${formatMoney(amount)}`, {
            action: {
              label: 'Hoàn tác',
              onClick: () =>
                (previous.manual ? setManual.mutateAsync({ categoryId, amount: previous.amount }) : clearManual.mutateAsync(categoryId)).then(() => refetch()),
            },
          })
        },
      },
    )
  }

  const head = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[19px]">
        <Sparkles className="size-5 text-gold-700" aria-hidden />
        Gợi ý bằng AI cho hạng mục {cat}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.plan}>Quay lại kế hoạch</Link>
        </Button>
        <button type="button" onClick={onClose} className="text-sm font-medium text-gold-700 underline underline-offset-[3px]">
          Đóng gợi ý
        </button>
      </div>
    </div>
  )

  let body
  if (isPending) {
    body = (
      <div className="mt-3.5 flex items-center gap-3" role="status">
        <span className="size-[30px] shrink-0 animate-spin rounded-full border-[3px] border-line border-t-primary" aria-hidden />
        <span className="text-muted-foreground">Đang chọn nhà cung cấp hợp với ngân sách, địa điểm và số khách của bạn</span>
      </div>
    )
  } else if (isError) {
    body = (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-destructive">{error.message}</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    )
  } else {
    const need = data.guestCount ? `, đủ chỗ cho ${data.guestCount} khách${data.tables ? ` (${data.tables} bàn)` : ''}` : ''
    const canRaise = data.isChosenCategory && !!data.categoryId && !!data.raiseBudgetTo
    body = (
      <>
        <p className="mt-1.5 text-muted-foreground">
          Dựa trên ngân sách hạng mục {formatMoney(data.budget)}
          {data.budgetReason ? ` (${data.budgetReason.toLowerCase()})` : ''}, địa điểm {data.location}
          {need}. Xếp theo điểm đánh giá, rồi số lượt đánh giá.
        </p>
        {data.suggestions.length ? (
          <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
            {data.suggestions.map(({ service, reasons }) => (
              <div key={service.id} className="grid gap-1.5 rounded-md border border-line px-4 py-3.5">
                <h4 className="text-base">{service.name}</h4>
                <RatingMeta service={service} />
                <div className="text-[13px] text-muted-foreground">{reasons.join(' ')}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={paths.serviceDetail(service.id)}>Xem chi tiết</Link>
                  </Button>
                  <AddToPlanButton service={service} primary />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="mt-3">
              {data.noVenueFits
                ? `Chưa có nhà hàng nào tại ${data.location} đủ chỗ cho ${data.guestCount} khách.`
                : `Chưa có nhà cung cấp ${cat} tại ${data.location} trong ngân sách ${formatMillions(data.budget)}${need ? ' và đủ chỗ' : ''}.`}
              {data.cheapest && ` Lựa chọn rẻ nhất phù hợp là ${data.cheapest.name}${data.cheapestPackage ? `, ${data.cheapestPackage.calculation}` : ''}.`}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {canRaise && (
                <Button
                  size="sm"
                  disabled={setManual.isPending}
                  onClick={() => raiseBudget(data.categoryId!, data.raiseBudgetTo!, { amount: data.budget, manual: data.budgetSource === 'ALLOCATED' })}
                >
                  Tăng ngân sách {cat} lên {formatMoney(data.raiseBudgetTo!)}
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <Link to={paths.planTab.budget}>{data.noVenueFits ? 'Sửa số khách dự kiến' : 'Điều chỉnh ngân sách hạng mục'}</Link>
              </Button>
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <section className="mb-[22px] rounded-lg border border-primary bg-surface px-5 py-[18px]" aria-live="polite">
      {head}
      {body}
    </section>
  )
}
