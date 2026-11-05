import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ordersApi } from '@/api/orders'
import { FormError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatUnitPrice } from '@/features/catalog/price'
import { useService } from '@/features/catalog/hooks'
import { CHANGE_LABEL } from '@/features/vendorOrders/constants'
import { RESTAURANT_SLUG } from '@/features/vendors/constants'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { REVISION_CHANGE_TYPES, type RevisionChangeType } from '@/types/vendorOrder'
import type { ServicePackage } from '@/types/catalog'
import type { Order } from '@/types/order'
import { useRequestRevision } from '../hooks'

/**
 * Yêu cầu chỉnh sửa đơn: 4 ô chọn tùy chọn, nội dung chi tiết bắt buộc (docs/THE_DON_PHIA_KHACH.md mục 3.2).
 * Chờ thanh toán cọc: đơn chuyển Chờ chỉnh sửa. Đã đặt cọc (trước ngày thực hiện): đơn vẫn Đã đặt cọc, tiền cọc giữ nguyên.
 */
export function ReviseOrderDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{order ? `Yêu cầu chỉnh sửa đơn ${order.orderCode}` : 'Yêu cầu chỉnh sửa đơn'}</DialogTitle>
          <DialogDescription>
            Cho nhà cung cấp biết bạn muốn chỉnh sửa gì. Nội dung này hiện trong khung chat và cho nhà cung cấp khi họ chỉnh sửa đơn.
            {order?.status === 'Deposited' && ` Đơn đã đặt cọc: khoản cọc ${formatMoney(order.depositAmount)} giữ nguyên, chỉ hạng mục, số lượng, ngày, ghi chú được đổi.`}
          </DialogDescription>
        </DialogHeader>
        {order && <ReviseForm order={order} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ReviseForm({ order, onClose }: { order: Order; onClose: () => void }) {
  const [changes, setChanges] = useState<RevisionChangeType[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  // Đổi hạng mục: gói khách muốn đổi sang (chọn từ danh sách gói của NCC)
  const [packageId, setPackageId] = useState<string | null>(null)
  const revise = useRequestRevision()
  const service = useService(order.serviceId ?? '')
  // Đơn đã cọc: hỏi backend còn cho đổi gói không (NCC đã xong từ 50% việc của gói, hoặc còn dưới 7 ngày tới ngày thực hiện thì khóa)
  const lockQuery = useQuery({ queryKey: ['orders', order.id, 'package-change-lock'], queryFn: () => ordersApi.packageChangeLock(order.id), enabled: order.status === 'Deposited', staleTime: 30_000 })
  const itemLock = lockQuery.data?.lock ?? null
  const changingItem = changes.includes('Item') && !itemLock
  const target = changingItem ? service.data?.packages.find((p) => p.id === packageId) : undefined

  // Đổi số bàn chỉ với trung tâm tiệc cưới (đặt theo bàn); dịch vụ trọn gói không có lựa chọn này
  const byTable = order.category?.slug === RESTAURANT_SLUG || !!order.package || order.items.some((i) => i.unit === 'Bàn')
  const options = REVISION_CHANGE_TYPES.filter((c) => c !== 'Quantity' || byTable)

  const toggle = (c: RevisionChangeType) => setChanges((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  function submit(e: FormEvent) {
    e.preventDefault()
    // Chọn gói rồi thì lời nhắn không bắt buộc: yêu cầu tự ghi gói muốn đổi sang (NCC thấy trong chat và khi chỉnh sửa đơn)
    if (!note.trim() && !target) return setError('Vui lòng ghi rõ nội dung chi tiết cần chỉnh sửa để nhà cung cấp biết.')
    const wanted = target && service.data ? `Đổi sang gói "${target.name}" (${formatUnitPrice(target.price, { priceUnit: target.pricingUnit ?? service.data.priceUnit })})` : ''
    const text = [wanted, note.trim()].filter(Boolean).join('. ')
    revise.mutate({ orderId: order.id, changes: REVISION_CHANGE_TYPES.filter((c) => changes.includes(c) && !(c === 'Item' && itemLock)), note: text }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-medium">Bạn muốn thay đổi gì?</legend>
        <div className="grid grid-cols-2 gap-2.5 max-[420px]:grid-cols-1">
          {options.map((c) => {
            const locked = c === 'Item' && !!itemLock
            return (
              <label key={c} className={cn('inline-flex items-center gap-[7px] text-sm', locked ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer')}>
                <input type="checkbox" disabled={locked} checked={!locked && changes.includes(c)} onChange={() => toggle(c)} className="accent-primary" />
                {CHANGE_LABEL[c]}
              </label>
            )
          })}
        </div>
        {/* Đơn đã cọc mà NCC đã chuẩn bị nhiều / sắp tới ngày thực hiện: không cho yêu cầu đổi gói nữa */}
        {itemLock && <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-[12.5px] text-muted-foreground">Không đổi hạng mục được: {itemLock} Nếu thật sự cần, bạn nhắn nhà cung cấp trong chat.</p>}
      </fieldset>
      {changingItem && (
        <PackagePicker
          order={order}
          loading={!!order.serviceId && service.isPending}
          packages={service.data?.packages ?? []}
          priceUnit={service.data?.priceUnit}
          value={packageId}
          onChange={(id) => {
            setPackageId(id)
            setError(undefined)
          }}
        />
      )}
      <div>
        <label htmlFor="revise-note" className="mb-1.5 block text-[13px] font-medium">
          Nội dung chi tiết {target ? <span className="font-normal text-muted-foreground">(không bắt buộc)</span> : '*'}
        </label>
        <textarea
          id="revise-note"
          rows={changingItem ? 2 : 4}
          autoFocus
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setError(undefined)
          }}
          placeholder={byTable ? 'Ví dụ: Giảm còn 15 bàn, dời sang ngày 20/12...' : 'Ví dụ: Dời sang ngày 20/12, thêm cổng hoa...'}
          className="w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
        />
      </div>
      <FormError message={error ?? revise.error?.message} />
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy bỏ
        </Button>
        <Button type="submit" disabled={revise.isPending}>
          Gửi yêu cầu
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Đổi hạng mục: danh sách gói đang đăng của NCC để khách chọn gói muốn đổi sang (ảnh, tên, giá, sức chứa). Gói đang có trong đơn ghi
 * "Đang dùng" và không chọn được; bấm lại gói đang chọn để bỏ chọn.
 */
function PackagePicker({
  order,
  loading,
  packages,
  priceUnit,
  value,
  onChange,
}: {
  order: Order
  loading: boolean
  packages: ServicePackage[]
  priceUnit?: 'TABLE' | 'PACKAGE'
  value: string | null
  onChange: (id: string | null) => void
}) {
  const inOrder = new Set([...order.items.flatMap((i) => (i.packageId ? [i.packageId] : [])), ...(order.package ? [order.package.id] : [])])
  return (
    <fieldset>
      <legend className="mb-1.5 block text-[13px] font-medium">Chọn gói muốn đổi sang</legend>
      {loading ? (
        <div className="h-[132px] animate-pulse rounded-md bg-muted" aria-busy="true" aria-label="Đang tải các gói" />
      ) : packages.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nhà cung cấp chưa có gói nào khác. Hãy ghi rõ mong muốn ở ô bên dưới.</p>
      ) : (
        <div role="radiogroup" className="grid max-h-[272px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 max-[480px]:grid-cols-1">
          {packages.map((p) => {
            const current = inOrder.has(p.id)
            const on = value === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={current}
                onClick={() => onChange(on ? null : p.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  on ? 'border-primary bg-gold-100 ring-1 ring-primary' : 'border-line bg-surface hover:border-gold-500',
                )}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" loading="lazy" className="size-14 flex-none rounded-sm object-cover" />
                ) : (
                  <span aria-hidden className="size-14 flex-none rounded-sm bg-gold-100" />
                )}
                <span className="min-w-0 flex-1">
                  <b className="line-clamp-2 text-[13px] leading-snug font-semibold">{p.name}</b>
                  <span className="mt-0.5 block text-[12.5px] font-semibold text-gold-700 tabular-nums">{formatUnitPrice(p.price, { priceUnit: p.pricingUnit ?? priceUnit })}</span>
                  {current ? (
                    <span className="text-[11.5px] text-muted-foreground">Đang dùng</span>
                  ) : p.capacity ? (
                    <span className="text-[11.5px] text-muted-foreground">Tối đa {p.capacity} khách</span>
                  ) : null}
                </span>
                {on && <Check aria-hidden className="size-4 flex-none text-primary" strokeWidth={2.6} />}
              </button>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}
