import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { formatMoney } from '@/lib/format'
import { useReveal } from '@/lib/useReveal'
import { paths } from '@/routes/paths'
import type { ServiceSummary } from '@/types/catalog'
import { RatingMeta } from './RatingMeta'

interface ServiceCardProps {
  service: ServiceSummary
  /** Vị trí trong lưới, để các thẻ cùng hàng hiện lệch nhau một chút */
  index?: number
  /** Nút nổi góc ảnh (yêu thích, module favorites) */
  imageAction?: ReactNode
  /** Nút cạnh "Xem chi tiết" (thêm vào kế hoạch, module plan) */
  extraActions?: ReactNode
  /** Nhãn phụ dưới tên (ví dụ "Gợi ý cho bạn") */
  badge?: ReactNode
  /** Nhãn danh mục trên ảnh; ẩn khi đang lọc đúng danh mục đó */
  showCategory?: boolean
}

/**
 * Thẻ dịch vụ trong lưới (svcCard trong prototype).
 * Thứ tự ưu tiên: tên (lớn nhất) → địa chỉ → khoảng giá các gói. Nút "Xem chi tiết" dạng viền để lưới nhẹ hơn, rê chuột mới đổ nền vàng.
 */
export function ServiceCard({ service, index = 0, imageAction, extraActions, badge, showCategory = true }: ServiceCardProps) {
  const location = useLocation()
  const reveal = useReveal<HTMLElement>()
  const detail = { pathname: paths.serviceDetail(service.id) }
  const fromState = { from: location.pathname + location.search }

  return (
    // Hiện dần khi cuộn tới gắn ở ngoài, nhấc thẻ khi rê chuột gắn ở trong để hai hiệu ứng không đè nhau
    <article ref={reveal.ref} style={{ transitionDelay: `${(index % 3) * 75}ms` }} className={`flex ${reveal.className}`}>
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden bg-line">
          <img src={service.coverImageUrl} alt={service.name} loading="lazy" className="block size-full object-cover" />
          {/* Phủ rất nhẹ để ảnh ghép nhiều tấm và ảnh đơn đều độ sáng */}
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-black/[0.04]" />
          {showCategory && (
            <span className="absolute bottom-3 left-3 rounded-pill bg-[rgb(255_253_248/0.92)] px-2.5 py-1 text-xs font-semibold text-moss-700">
              {service.category.name}
            </span>
          )}
          {imageAction && <div className="absolute top-3 right-3">{imageAction}</div>}
        </div>

        <div className="flex flex-1 flex-col gap-2 px-5 pt-4 pb-5">
          {badge}
          {/* Luôn cao đủ 2 dòng (tên ngắn cũng vậy) để địa chỉ, giá và nút thẳng hàng giữa các thẻ */}
          <h3 className="line-clamp-2 min-h-[2.6em] text-xl leading-[1.3]">
            <Link to={detail} state={fromState} className="hover:text-gold-700">
              {service.name}
            </Link>
          </h3>
          <RatingMeta service={service} />
          {/* Khoảng giá từ gói rẻ nhất đến gói đắt nhất; chỉ một mức giá (hoặc dữ liệu thiếu priceTo) thì hiện một số */}
          <p className="mt-1">
            <span className="text-base font-semibold text-gold-700">
              {service.priceTo && service.priceTo > service.priceFrom ? (
                <>
                  {formatMoney(service.priceFrom)} <span className="font-normal text-ink-2">–</span> {formatMoney(service.priceTo)}
                </>
              ) : (
                formatMoney(service.priceFrom)
              )}
            </span>
            <span className="text-[13px] text-ink-2"> / gói</span>
          </p>
          <div className="mt-auto flex gap-2 pt-3">
            <Link
              to={detail}
              state={fromState}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-md border-[1.5px] border-gold-700 font-serif text-[13px] font-semibold tracking-[0.12em] text-gold-700 uppercase transition-colors hover:border-transparent hover:btn-gold"
            >
              Xem chi tiết
            </Link>
            {extraActions}
          </div>
        </div>
      </div>
    </article>
  )
}
