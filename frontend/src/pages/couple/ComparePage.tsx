import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { compareApi } from '@/api/compare'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { CompareTable } from '@/features/compare/components/CompareTable'
import { AddToPlanButton, OpenChatButton } from '@/features/weddings/planActions'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'
import { MAX_COMPARE } from '@/store/compare'

/**
 * Trang Kết quả so sánh (3.4). Danh sách lấy từ URL ?ids=a,b,c nên tải lại trang vẫn giữ.
 * So sánh bằng thuật toán ở BE (docs/api/compare.md), không gọi AI, không đề xuất chọn bên nào.
 */
export default function ComparePage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const ids = [...new Set((params.get('ids') ?? '').split(',').filter(Boolean))].slice(0, MAX_COMPARE)
  // Gói khách đổi ở dropdown: gọi lại API để BE tính lại tổng, so với ngân sách, nhãn và dòng tóm tắt
  const [picked, setPicked] = useState<Record<string, string>>({})
  const result = useQuery({
    queryKey: ['compare', user?.id, ids.join(','), picked],
    queryFn: ({ signal }) => compareApi.compare(ids, picked, signal),
    enabled: ids.length >= 2,
    placeholderData: keepPreviousData,
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

  const d = result.data
  const summary = d.comparison.summary

  return (
    <>
      <PageTitle title="So sánh dịch vụ" description={`${d.category.name}, ${d.items.length} nhà cung cấp`} actions={back} />
      {/* Đã cọc một NCC của hạng mục: một cảnh báo đỏ duy nhất ở đầu trang (thay cho lý do lặp lại dưới từng cột) */}
      {d.comparison.lockNote && (
        <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-[14px] text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {d.comparison.lockNote}{' '}
            <Link to={paths.planTab.services} className="font-semibold underline underline-offset-[3px]">
              Mở tab Dịch vụ
            </Link>
          </span>
        </p>
      )}
      {/* Dòng tóm tắt do BE ghép: chỉ nêu khác biệt, không khuyên chọn bên nào; không có khác biệt thì ẩn */}
      {summary.length > 0 && (
        <p className="mb-3 rounded-lg border border-line bg-surface px-4 py-3 text-[14px]" aria-live="polite">
          {summary.join(' ')}
        </p>
      )}
      {d.budget !== null && (
        <p className="mb-3 text-[14px] text-muted-foreground">
          Mức gợi ý cho {d.category.name.toLowerCase()} trong ngân sách của bạn: <b className="font-semibold text-ink">{formatMoney(d.budget)}</b>
        </p>
      )}
      <CompareTable
        result={d}
        updating={result.isFetching}
        onPick={(serviceId, packageId) => setPicked((m) => ({ ...m, [serviceId]: packageId }))}
        renderAdd={(s) => <AddToPlanButton service={s} primary />}
        renderQuote={(s) => <OpenChatButton service={s} />}
      />
    </>
  )
}
