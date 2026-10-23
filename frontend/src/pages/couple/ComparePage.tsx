import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { compareApi } from '@/api/compare'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { useGoogleRatings } from '@/features/catalog/useGoogleRating'
import { CompareTable, type RatingCell } from '@/features/compare/components/CompareTable'
import { RecommendBox } from '@/features/compare/components/RecommendBox'
import { recommend } from '@/features/compare/recommend'
import { useWedding } from '@/features/weddings/hooks'
import { AddToPlanButton } from '@/features/weddings/planActions'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'
import { MAX_COMPARE } from '@/store/compare'
import type { CompareRecommendation } from '@/types/compare'

/** Trang Kết quả so sánh (3.4). Danh sách lấy từ URL ?ids=a,b,c nên tải lại trang vẫn giữ. */
export default function ComparePage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const ids = [...new Set((params.get('ids') ?? '').split(',').filter(Boolean))].slice(0, MAX_COMPARE)
  const { data: wedding } = useWedding()
  const result = useQuery({
    queryKey: ['compare', user?.id, ids.join(',')],
    queryFn: () => compareApi.compare(ids),
    enabled: ids.length >= 2,
  })
  // Điểm Google cùng nguồn với thẻ dịch vụ (mode summary)
  const ratingQueries = useGoogleRatings(ids, 'summary')

  const ratings: Record<string, RatingCell> = {}
  ids.forEach((id, i) => {
    const q = ratingQueries[i]
    ratings[id] =
      q.isPending ? { status: 'loading' } : q.data && q.data.rating !== null ? { status: 'ok', rating: q.data.rating, count: q.data.userRatingCount } : { status: 'none' }
  })
  const ratingsSettled = ids.every((id) => ratings[id].status !== 'loading')
  const ratingsKey = ids.map((id) => JSON.stringify(ratings[id])).join('|')

  // BE trả sẵn đề xuất; chế độ dữ liệu giả (null) thì FE tự tính khi đã có đủ kết quả điểm (có thể là lỗi)
  const recommendation = useMemo<CompareRecommendation | null>(() => {
    if (!result.data) return null
    if (result.data.recommendation) return result.data.recommendation
    if (!ratingsSettled) return null
    const slug = result.data.items[0].category.slug
    const rec = recommend(
      result.data.items.map((s) => {
        const r = ratings[s.id]
        return {
          id: s.id,
          price: s.priceFrom,
          rating: r.status === 'ok' ? r.rating : null,
          reviewCount: r.status === 'ok' ? r.count : null,
          styles: s.styles,
          city: s.location,
          capacity: s.capacity,
        }
      }),
      // Module weddings dùng location/styles; đổi sang city/styles cho hàm đề xuất
      wedding ? { budget: wedding.budget, guestCount: wedding.guestCount, city: wedding.location, styles: wedding.styles } : null,
      slug,
    )
    return { serviceId: rec.recommendedId, reasons: rec.reasons, isTie: rec.isTie }
    // ratingsKey đại diện cho ratings
  }, [result.data, ratingsSettled, ratingsKey, wedding])

  if (ids.length < 2) return <Navigate to={paths.favorites} replace />

  const back = (
    <Button asChild variant="outline">
      <Link to={paths.favorites}>Quay lại yêu thích</Link>
    </Button>
  )

  if (result.isError) {
    return (
      <>
        <PageTitle title="So sánh dịch vụ" actions={back} />
        <EmptyState title="Không so sánh được" description={result.error.message} />
      </>
    )
  }

  if (!result.data) {
    return (
      <>
        <PageTitle title="So sánh dịch vụ" actions={back} />
        <div className="h-[420px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải" />
      </>
    )
  }

  const { items } = result.data
  const recommended = recommendation ? (items.find((s) => s.id === recommendation.serviceId) ?? null) : null

  return (
    <>
      <PageTitle title="So sánh dịch vụ" description={`${items[0].category.name}, ${items.length} nhà cung cấp`} actions={back} />
      {recommendation ? (
        <RecommendBox recommendation={recommendation} recommendedName={recommended?.name ?? null} hasWedding={!!wedding} />
      ) : (
        <div className="mb-4 h-[74px] animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label="Đang tính đề xuất" />
      )}
      <CompareTable
        services={items}
        ratings={ratings}
        recommendedId={recommendation && !recommendation.isTie ? recommendation.serviceId : null}
        isTie={!!recommendation?.isTie}
        renderActions={(s, primary) => <AddToPlanButton service={s} primary={recommendation ? primary : false} />}
      />
    </>
  )
}
