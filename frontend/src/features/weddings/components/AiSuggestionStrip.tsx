import { Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { RatingMeta } from '@/features/catalog/components/RatingMeta'
import { formatMillions } from '@/lib/format'
import { paths } from '@/routes/paths'
import { useAiSuggestions } from '../hooks'
import { AddToPlanButton } from '../planActions'

interface AiSuggestionStripProps {
  categorySlug: string
  categoryName: string
  onClose: () => void
}

/** Khung "Gợi ý bằng AI cho hạng mục …" trên trang Dịch vụ cưới (aiStrip trong prototype). */
export function AiSuggestionStrip({ categorySlug, categoryName, onClose }: AiSuggestionStripProps) {
  const { data, isPending, isError, error, refetch } = useAiSuggestions(categorySlug, true)
  const cat = categoryName.toLowerCase()

  const head = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[19px]">
        <Sparkles className="size-5 text-gold-700" aria-hidden />
        Gợi ý bằng AI cho hạng mục {cat}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.timeline}>Quay lại timeline</Link>
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
        <span className="text-muted-foreground">Đang chọn nhà cung cấp hợp với ngân sách, địa điểm và phong cách của bạn</span>
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
    const need = data.guestCount ? `, sức chứa ${data.guestCount} khách` : ''
    body = (
      <>
        <p className="mt-1.5 text-muted-foreground">
          Dựa trên ngân sách hạng mục {formatMillions(data.budget)}, địa điểm {data.location}
          {data.styles.length ? `, phong cách ${data.styles.join(', ').toLowerCase()}` : ''}
          {need}.
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
              Chưa có nhà cung cấp {cat} tại {data.location} trong ngân sách {formatMillions(data.budget)}
              {need ? ' và đủ chỗ' : ''}.
              {data.cheapest && ` Lựa chọn thấp nhất hiện có là ${data.cheapest.name} (${data.cheapest.location}), từ ${formatMillions(data.cheapest.priceFrom)}.`}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2.5">
              <Link to={paths.plan}>Điều chỉnh ngân sách hạng mục</Link>
            </Button>
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
