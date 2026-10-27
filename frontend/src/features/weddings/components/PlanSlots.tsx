import { Sparkles, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { CategoryIcon, categoryColor } from '@/features/catalog/categoryIcons'
import { RatingMeta } from '@/features/catalog/components/RatingMeta'
import { useCategories } from '@/features/catalog/hooks'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { PlanItem } from '@/types/wedding'
import { useRemovePlanItem } from '../hooks'
import { usePlanActions } from '../planActions'
import { PLAN_STATUS } from '../status'
import { useAiSuggest } from '../useAiSuggest'

interface PlanSlotsProps {
  categorySlugs: string[]
  items: PlanItem[]
  hasWedding: boolean
}

/** Dòng thông tin đơn dưới dịch vụ (orderLine trong prototype). */
function OrderLine({ item }: { item: PlanItem }) {
  const o = item.order
  if (!o) return null
  const rest = o.totalAmount - o.depositAmount
  return (
    <div className="mt-2 flex flex-wrap gap-x-[18px] gap-y-1 border-t border-dashed border-line pt-2 text-[13px] text-muted-foreground">
      <span>
        Đơn <b className="font-semibold text-ink">{o.code}</b>
      </span>
      <span>
        Thực hiện <b className="font-semibold text-ink">{formatDate(o.serviceDate)}</b>
      </span>
      {o.status === 'PAID' ? (
        <>
          <span>
            Đã cọc <b className="font-semibold text-ink">{formatMoney(o.depositAmount)}</b>
          </span>
          <span>
            Còn lại <b className="font-semibold text-ink">{formatMoney(rest)}</b> (thanh toán trực tiếp cho NCC)
          </span>
        </>
      ) : (
        <>
          <span>
            Cần cọc <b className="font-semibold text-ink">{formatMoney(o.depositAmount)}</b>
          </span>
          <span>
            Còn lại <b className="font-semibold text-ink">{formatMoney(rest)}</b>
          </span>
        </>
      )}
      {o.status === 'REVISION_REQUESTED' && (
        <span className="basis-full rounded-md bg-[color-mix(in_srgb,var(--gold)_14%,var(--surface))] px-2.5 py-1.5 text-ink">
          Bạn đã yêu cầu chỉnh sửa: {o.revisionNote}. Chờ nhà cung cấp gửi lại đơn.
        </span>
      )}
    </div>
  )
}

/** Các hạng mục của kế hoạch, mỗi hạng mục một dịch vụ (planServices trong prototype). */
export function PlanSlots({ categorySlugs, items, hasWedding }: PlanSlotsProps) {
  const { data: categories = [] } = useCategories()
  const { openChat } = usePlanActions()
  const remove = useRemovePlanItem()
  const aiSuggest = useAiSuggest()
  const navigate = useNavigate()

  if (!categorySlugs.length) {
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

  const awaiting = items.filter((i) => i.status === 'AWAITING_DEPOSIT' && i.order)
  const depositTotal = awaiting.reduce((sum, i) => sum + i.order!.depositAmount, 0)

  return (
    <>
      {awaiting.length > 0 && (
        <div className="mb-3.5 rounded-md bg-[color-mix(in_srgb,var(--gold)_14%,var(--surface))] px-3.5 py-3 text-sm">
          <b className="font-semibold">{awaiting.length} đơn dịch vụ đang chờ thanh toán cọc</b> · Tổng cần cọc {formatMoney(depositTotal)}
        </div>
      )}
      {categorySlugs.map((slug) => {
        const name = categories.find((c) => c.slug === slug)?.name ?? slug
        const item = items.find((i) => i.service.category.slug === slug)
        return (
          <section key={slug} className="mb-[26px]" style={{ '--cc': categoryColor(slug) } as CSSProperties}>
            <h2 className="mb-2.5 flex items-center gap-2.5 text-lg">
              <CategoryIcon slug={slug} size={20} className="text-(--cc)" />
              {name}
            </h2>
            {item ? (
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface px-[18px] py-4">
                <div className="min-w-[200px] flex-1">
                  <b className="font-serif text-base font-semibold">{item.service.name}</b>
                  <RatingMeta service={item.service} />
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {item.packageName}: {formatMoney(item.price)}
                  </div>
                  <OrderLine item={item} />
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
                  {item.status === 'AWAITING_DEPOSIT' && item.order && (
                    <Button size="sm" onClick={() => navigate(paths.deal(item.order!.id))}>
                      Thanh toán cọc
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
            ) : (
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
          </section>
        )
      })}
    </>
  )
}
