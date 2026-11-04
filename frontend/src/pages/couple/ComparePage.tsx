import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { compareApi } from '@/api/compare'
import { EmptyState } from '@/components/EmptyState'
import { CompareTable } from '@/features/compare/components/CompareTable'
import { AddToPlanButton, OpenChatButton } from '@/features/weddings/planActions'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'
import { MAX_COMPARE } from '@/store/compare'

/**
 * Trang Kết quả so sánh (3.4). Danh sách lấy từ URL ?ids=a,b,c nên tải lại trang vẫn giữ.
 * So sánh bằng thuật toán ở BE (docs/api/compare.md), không gọi AI, không đề xuất chọn bên nào.
 * Đầu trang kiểu bìa tạp chí gọn (compare-theme.css); mọi thông tin so sánh nằm trong bảng.
 */
export default function ComparePage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const ids = [...new Set((params.get('ids') ?? '').split(',').filter(Boolean))].slice(0, MAX_COMPARE)
  // Gói khách đổi ở dropdown: gọi lại API để BE tính lại tổng và nhãn
  const [picked, setPicked] = useState<Record<string, string>>({})
  const result = useQuery({
    queryKey: ['compare', user?.id, ids.join(','), picked],
    queryFn: ({ signal }) => compareApi.compare(ids, picked, signal),
    enabled: ids.length >= 2,
    placeholderData: keepPreviousData,
  })

  if (ids.length < 2) return <Navigate to={paths.favorites} replace />

  const d = result.data
  return (
    // Mọi thông tin nằm trên một tờ giấy trắng ngà viền mảnh (compare-theme.css); lớp ngoài chừa chỗ cho kẹp ở mép trên
    <div className="compare-sheet-wrap">
      {/* Kẹp càng nhỏ kim loại champagne mờ (SVG): thân thon, hai càng dây mảnh */}
      <svg className="compare-clip" viewBox="0 0 64 48" aria-hidden>
        <defs>
          <linearGradient id="clip-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#efe6d6" />
            <stop offset="0.55" stopColor="#c8b796" />
            <stop offset="1" stopColor="#ddd0b6" />
          </linearGradient>
        </defs>
        <path d="M21 27 L25 7 Q32 2 39 7 L43 27" fill="none" stroke="#b9a684" strokeWidth="2" strokeLinejoin="round" />
        <path d="M24.5 27 L27.5 10.5 Q32 7.5 36.5 10.5 L39.5 27" fill="none" stroke="#cdbd9e" strokeWidth="1.6" strokeLinejoin="round" />
        <rect x="9" y="25" width="46" height="18" rx="3" fill="url(#clip-body)" />
        <rect x="9.5" y="25.5" width="45" height="3" rx="1.5" fill="#fff" opacity="0.45" />
      </svg>
      <div className="compare-theme compare-sheet">
        {/* Đầu kiểu bìa tạp chí: "So sánh" nghiêng + tên hạng mục lớn, mức gợi ý, quay lại; ảnh ngang nhỏ bên phải.
            Không lặp lại thứ bảng đã có (tên NCC, rẻ hơn bao nhiêu, tỉnh/thành). */}
        <header className="compare-hero">
          <div>
            <h1>
              <em>So sánh</em>
              <span>{d?.category.name ?? 'dịch vụ'}</span>
            </h1>
            {d && d.budget !== null && (
              <p className="compare-budget">
                Mức gợi ý trong ngân sách của bạn <b>{formatMoney(d.budget)}</b>
              </p>
            )}
            <Link to={paths.favorites} className="compare-back">
              <ArrowLeft className="size-3.5" aria-hidden />
              Quay lại yêu thích
            </Link>
          </div>
          {/* Ảnh dán kiểu polaroid: viền trắng, hơi nghiêng, băng dính washi ở góc */}
          <figure className="compare-photo">
            <span className="compare-tape" aria-hidden />
            <img src="/images/compare-hero.jpg?v=3" alt="" />
          </figure>
        </header>
        {result.isError ? (
          <EmptyState title="Không so sánh được" description={result.error.message} />
        ) : !d ? (
          <div className="h-[420px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải" />
        ) : (
          <>
            {/* Đã cọc một NCC của hạng mục: một cảnh báo đỏ duy nhất (thay cho lý do lặp lại dưới từng cột) */}
            {d.comparison.lockNote && (
              <p role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-[14px] text-warn">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {d.comparison.lockNote}{' '}
                  <Link to={paths.planTab.services} className="font-semibold underline underline-offset-[3px]">
                    Mở tab Dịch vụ
                  </Link>
                </span>
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
        )}
      </div>
    </div>
  )
}
