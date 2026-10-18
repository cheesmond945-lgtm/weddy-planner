import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useSearchParams } from 'react-router'
import { compareApi } from '@/api/compare'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { CompareTable } from '@/features/compare/components/CompareTable'
import { RecommendBox } from '@/features/compare/components/RecommendBox'
import { useWedding } from '@/features/weddings/hooks'
import { AddToPlanButton } from '@/features/weddings/planActions'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'
import { MAX_COMPARE } from '@/store/compare'

/** Trang Kết quả so sánh (3.4). Danh sách lấy từ URL ?ids=a,b,c nên tải lại trang vẫn giữ. */
export default function ComparePage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const ids = [...new Set((params.get('ids') ?? '').split(',').filter(Boolean))].slice(0, MAX_COMPARE)
  const { data: wedding } = useWedding()
  // Kết quả phụ thuộc thông tin đám cưới: sửa thông tin thì tính lại
  const result = useQuery({
    queryKey: ['compare', user?.id, ids.join(','), wedding?.budget, wedding?.guestCount, wedding?.location, wedding?.styles.join(',')],
    queryFn: () => compareApi.compare(ids),
    enabled: ids.length >= 2,
  })

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

  const { items, recommendation } = result.data
  const recommended = items.find((s) => s.id === recommendation.serviceId) ?? null

  return (
    <>
      <PageTitle title="So sánh dịch vụ" description={`${items[0].category.name}, ${items.length} nhà cung cấp`} actions={back} />
      <RecommendBox recommendation={recommendation} recommendedName={recommended?.name ?? null} hasWedding={!!wedding} />
      <CompareTable
        services={items}
        recommendedId={recommendation.isTie ? null : recommendation.serviceId}
        isTie={recommendation.isTie}
        renderActions={(s, primary) => <AddToPlanButton service={s} primary={primary} />}
      />
    </>
  )
}
