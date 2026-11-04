import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { CategoryIcon } from '@/features/catalog/categoryIcons'
import { RatingMeta } from '@/features/catalog/components/RatingMeta'
import { useCategories } from '@/features/catalog/hooks'
import { CategoryOrders } from '@/features/orders/components/CategoryOrders'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import type { Order } from '@/types/order'
import type { PlanItem } from '@/types/wedding'
import { useRemovePlanItem } from '../hooks'
import { usePlanActions } from '../planActions'
import { PLAN_STATUS } from '../status'
import { useAiSuggest } from '../useAiSuggest'
import { PackageSwitcher } from './PackageSwitcher'

interface PlanSlotsProps {
  categorySlugs: string[]
  items: PlanItem[]
  hasWedding: boolean
  /** Mọi đơn NCC đã gửi cho khách (GET /orders), hiện dưới đúng hạng mục */
  orders: Order[]
  onRevise: (order: Order) => void
  /** Số khách dự kiến (cảnh báo gói không đủ chỗ) */
  guestCount?: number
}

/**
 * Các hạng mục của kế hoạch, mỗi hạng mục một dịch vụ (planServices trong prototype), kèm các đơn dịch vụ của hạng mục đó
 * (Thanh toán cọc, Yêu cầu chỉnh sửa, Xem chi tiết, Nhắn NCC). Hạng mục có đơn nhưng không còn trong kế hoạch vẫn hiện ở cuối.
 */
export function PlanSlots({ categorySlugs, items, hasWedding, orders, onRevise, guestCount = 0 }: PlanSlotsProps) {
  const { data: categories = [] } = useCategories()
  const { openChat } = usePlanActions()
  const remove = useRemovePlanItem()
  const aiSuggest = useAiSuggest()

  const ordersOf = (slug: string) => orders.filter((o) => o.category?.slug === slug)
  const extraSlugs = [...new Set(orders.map((o) => o.category?.slug).filter((s): s is string => !!s && !categorySlugs.includes(s)))]
  const slugs = [...categorySlugs, ...extraSlugs]

  if (!slugs.length) {
    return (
      <EmptyState
        title="Kế hoạch đang trống"
        description="Thêm dịch vụ từ trang dịch vụ, hoặc thiết lập thông tin đám cưới để có sẵn các hạng mục."
        action={
          <Button asChild>
            <Link to={paths.services}>Khám phá dịch vụ</Link>
          </Button>
        }
      />
    )
  }

  const awaiting = orders.filter((o) => o.status === 'Pending')
  const depositTotal = awaiting.reduce((sum, o) => sum + o.depositAmount, 0)

  return (
    <>
      {awaiting.length > 0 && (
        <div className="mb-3.5 rounded-md bg-[color-mix(in_srgb,var(--gold)_14%,var(--surface))] px-3.5 py-3 text-sm">
          <b className="font-semibold">{awaiting.length} đơn dịch vụ đang chờ thanh toán cọc</b> · Tổng cần cọc {formatMoney(depositTotal)}
        </div>
      )}
      {slugs.map((slug) => {
        const catOrders = ordersOf(slug)
        const name = categories.find((c) => c.slug === slug)?.name ?? catOrders[0]?.category?.name ?? slug
        // Thường một NCC mỗi hạng mục; có thể hai khi khách nhắn NCC khác lúc hạng mục đã chốt rồi cọc thêm đơn của NCC đó
        const catItems = items.filter((i) => i.service.category.slug === slug)
        const extra = extraSlugs.includes(slug)
        return (
          <section key={slug} className="mb-9">
            {/* Tiêu đề hạng mục: biểu tượng một màu xanh rêu trong vòng tròn nhạt (không dùng màu riêng từng hạng mục), đường kẻ mảnh kéo dài */}
            <h2 className="mb-3.5 flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[var(--moss-700)]">
                <CategoryIcon slug={slug} size={18} />
              </span>
              {name}
              <span aria-hidden className="h-px flex-1 bg-line" />
            </h2>
            {catItems.length ? (
              <div className="flex flex-col gap-2.5">
                {catItems.map((item) => (
                  <article key={item.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface px-[22px] py-[18px]">
                    <div className="min-w-[200px] flex-1">
                      <b className="font-serif text-[19px] font-semibold">{item.service.name}</b>
                      <RatingMeta service={item.service} />
                      <PackageSwitcher item={item} guestCount={guestCount} />
                    </div>
                    <Badge tone={PLAN_STATUS[item.status].tone}>{PLAN_STATUS[item.status].label}</Badge>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={item.status === 'PLANNED' || item.status === 'DISCUSSING' ? 'default' : 'outline'}
                        onClick={() => openChat(item.service)}
                      >
                        Nhắn tin
                      </Button>
                      {(item.status === 'PLANNED' || item.status === 'DISCUSSING') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-warn"
                          aria-label={`Bỏ ${item.service.name} khỏi kế hoạch`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item.id)}
                        >
                          <Trash2 className="size-[15px]" />
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : extra ? null : (
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-line-strong/60 px-[22px] py-[18px]">
                <div className="min-w-[200px] flex-1 text-[15px] text-muted-foreground">Chưa chọn dịch vụ cho hạng mục này.</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`${paths.services}?category=${slug}`}>Xem dịch vụ</Link>
                  </Button>
                  {hasWedding && (
                    <Button variant="secondary" size="sm" onClick={() => aiSuggest(slug)}>
                      Gợi ý cho bạn
                    </Button>
                  )}
                </div>
              </div>
            )}
            <CategoryOrders orders={catOrders} onRevise={onRevise} />
          </section>
        )
      })}
    </>
  )
}
