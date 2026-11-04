import { ArrowRight, Check } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ServiceCard } from '@/features/catalog/components/ServiceCard'
import { useCategories } from '@/features/catalog/hooks'
import { FavoriteButton } from '@/features/favorites/components/FavoriteButton'
import { paths } from '@/routes/paths'
import type { AiSuggestionResult } from '@/types/wedding'
import { useAiSuggestions } from '../hooks'
import { AddToPlanButton } from '../planActions'
import { closeSuggestions, useSuggestDialog } from '../suggestDialog'
import { suggestionBasis, suggestionCardProps } from './SuggestionsPanel'

const grid = 'grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-5'

/**
 * Popup "Gợi ý {dịch vụ}" mở từ nút gợi ý (Timeline, Kế hoạch): tối đa 3 nhà cung cấp hợp ngân sách, mỗi thẻ có thả tim,
 * thêm vào kế hoạch, bấm thẻ thì sang trang nhà cung cấp; "Xem thêm" sang trang Dịch vụ cưới chỉ lọc dịch vụ đó. Gắn một lần ở CoupleLayout.
 */
export function SuggestionsDialog() {
  const slug = useSuggestDialog()
  const { pathname } = useLocation()
  // Bấm thẻ / "Xem thêm" chuyển trang: đóng popup
  useEffect(() => closeSuggestions(), [pathname])
  const { data: categories } = useCategories()
  const name = categories?.find((c) => c.slug === slug)?.name ?? 'dịch vụ'

  return (
    <Dialog open={!!slug} onOpenChange={(o) => !o && closeSuggestions()}>
      <DialogContent className="max-w-[960px]">
        {slug && <Body slug={slug} name={name} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({ slug, name }: { slug: string; name: string }) {
  const { data, isPending, isError, error, refetch } = useAiSuggestions(slug, true)
  const cat = name.toLowerCase()
  const count = data?.suggestions.length ?? 0

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-3 text-[28px] font-medium">
          Gợi ý {cat}
          {count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-sage-soft px-2.5 py-1 font-sans text-xs font-bold tracking-[0.06em] text-sage uppercase">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
              {count} nhà cung cấp
            </span>
          )}
        </DialogTitle>
        <DialogDescription className="text-[14px]">{data ? suggestionBasis(data, name) : 'Nhà cung cấp trên Forever phù hợp với ngân sách và nơi tổ chức của bạn.'}</DialogDescription>
      </DialogHeader>

      {isPending ? (
        <div className={grid} aria-busy="true" aria-label="Đang tìm nhà cung cấp phù hợp">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-line bg-surface">
              <div className="aspect-[4/3] bg-muted" />
              <div className="flex flex-col gap-3 p-5">
                <div className="h-5 w-3/4 rounded-sm bg-muted" />
                <div className="h-3.5 w-1/2 rounded-sm bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-dashed border-line p-6 text-center">
          <p className="text-muted-foreground">{error.message || 'Chưa tải được gợi ý.'}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <Results data={data} cat={cat} />
      )}

      <div className="mt-6 flex justify-center">
        <Button asChild variant="outline">
          <Link to={`${paths.services}?category=${slug}`}>
            Xem thêm nhà cung cấp {cat}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </>
  )
}

function Results({ data, cat }: { data: AiSuggestionResult; cat: string }) {
  if (!data.suggestions.length) {
    const place = data.ward || data.location
    return (
      <div className="rounded-xl border border-dashed border-line p-6 text-center">
        <p className="text-ink-2">
          {data.noVenueFits && data.guestCount
            ? `Chưa có ${cat} nào đủ chỗ cho ${data.guestCount.toLocaleString('vi-VN')} khách tại ${place}.`
            : `Chưa có nhà cung cấp ${cat} nào trong ngân sách của bạn tại ${place}.`}
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link to={paths.planTab.budget}>Điều chỉnh ngân sách hạng mục</Link>
        </Button>
      </div>
    )
  }
  return (
    <div className={grid}>
      {data.suggestions.map((s, i) => (
        <ServiceCard
          key={s.service.id}
          service={s.service}
          index={i}
          showCategory={false}
          imageAction={<FavoriteButton service={s.service} />}
          extraActions={<AddToPlanButton service={s.service} variant="icon" />}
          {...suggestionCardProps(s)}
        />
      ))}
    </div>
  )
}
