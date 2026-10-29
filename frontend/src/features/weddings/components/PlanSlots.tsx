import { Sparkles, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { CategoryIcon, categoryColor } from '@/features/catalog/categoryIcons'
import { RatingMeta } from '@/features/catalog/components/RatingMeta'
import { useCategories } from '@/features/catalog/hooks'
import { CategoryOrders } from '@/features/orders/components/CategoryOrders'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { Order } from '@/types/order'
import type { PlanItem } from '@/types/wedding'
import { useRemovePlanItem } from '../hooks'
import { usePlanActions } from '../planActions'
import { PLAN_STATUS } from '../status'
import { useAiSuggest } from '../useAiSuggest'

interface PlanSlotsProps {
  categorySlugs: string[]
  items: PlanItem[]
  hasWedding: boolean
  /** Mọi đơn NCC đã gửi cho khách (GET /orders), hiện dưới đúng hạng mục */
  orders: Order[]
  onRevise: (order: Order) => void
}

/**
 * Các hạng mục của kế hoạch, mỗi hạng mục một dịch vụ (planServices trong prototype), kèm các đơn dịch vụ của hạng mục đó
 * (Thanh toán cọc, Yêu cầu chỉnh sửa, Xem chi tiết, Nhắn NCC). Hạng mục có đơn nhưng không còn trong kế hoạch vẫn hiện ở cuối.
 */
export function PlanSlots({ categorySlugs, items, hasWedding, orders, onRevise }: PlanSlotsProps) {
  const { data: categories = [] } = useCategories()
  const { openChat } = usePlanActions()
  const remove = useRemovePlanItem()
  const aiSuggest = useAiSuggest()
  const navigate = useNavigate()

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
          <section key={slug} className="mb-[26px]" style={{ '--cc': categoryColor(slug) } as CSSProperties}>
            <h2 className="mb-2.5 flex items-center gap-2.5 text-lg">
              <CategoryIcon slug={slug} size={20} className="text-(--cc)" />
              {name}
            </h2>
            {catItems.length ? (
              <div className="flex flex-col gap-2.5">
                {catItems.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface px-[18px] py-4">
                    <div className="min-w-[200px] flex-1">
                      <b className="font-serif text-base font-semibold">{item.service.name}</b>
                      <RatingMeta service={item.service} />
                      <div className="mt-1 text-[13px] text-muted-foreground">
                        {item.packageName}: {formatMoney(item.price)}
                        {/* Chưa có đơn, giá theo mâm: ghi rõ cách ước tính */}
                        {item.estimate && (
                          <span className="block text-xs">
                            Ước tính {formatMoney(item.estimate.unitPrice)}/mâm × {item.estimate.tables} mâm
                            {item.estimate.minTables && item.estimate.tables === item.estimate.minTables ? ' (số mâm tối thiểu)' : ''}, đã gồm sảnh
                          </span>
                        )}
                      </div>
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
                      {item.status === 'CONFIRMED' && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`${paths.timeline}?category=${slug}`)}>
                          Xem việc cần làm
                        </Button>
                      )}
                      {(item.status === 'PLANNED' || item.status === 'DISCUSSING') && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label={`Bỏ ${item.service.name} khỏi kế hoạch`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item.id)}
                        >
                          <Trash2 className="size-[15px]" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : extra ? null : (
              <div className={cn('flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-line px-[18px] py-4')}>
                <div className="min-w-[200px] flex-1 text-muted-foreground">Chưa chọn dịch vụ cho hạng mục này.</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`${paths.services}?category=${slug}`}>Xem dịch vụ</Link>
                  </Button>
                  {hasWedding && (
                    <Button variant="secondary" size="sm" onClick={() => aiSuggest(slug)}>
                      <Sparkles className="size-[15px]" />
                      Gợi ý bằng AI
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
