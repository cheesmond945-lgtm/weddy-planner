import { ChevronDown, FlaskConical } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isMock } from '@/api'
import { currentVersion } from '@/features/serviceOrders/calc'
import { cn } from '@/lib/utils'
import type { ServiceOrder } from '@/types/serviceOrder'
import type { CustomerSimulation } from '@/types/vendorChat'
import { useSimulateCustomer } from '../hooks'

const ACTIONS: { action: CustomerSimulation; label: string; when: (o: ServiceOrder | undefined) => boolean }[] = [
  { action: 'MESSAGE', label: 'Khách nhắn tin', when: () => true },
  { action: 'CONFIRM_ORDER', label: 'Khách xác nhận đơn', when: (o) => o?.status === 'AWAITING_CONFIRMATION' },
  { action: 'REQUEST_REVISION', label: 'Khách yêu cầu chỉnh sửa đơn', when: (o) => o?.status === 'AWAITING_CONFIRMATION' },
  {
    action: 'PAY_DEPOSIT',
    label: 'Khách đặt cọc qua VNPay',
    when: (o) => {
      const dep = o && currentVersion(o)?.content.installments[0]
      return o?.status === 'CONFIRMED' && !!dep && !o.payments.some((p) => p.installmentId === dep.id)
    },
  },
  {
    action: 'REQUEST_ADJUSTMENT',
    label: 'Khách yêu cầu điều chỉnh',
    when: (o) => o?.status === 'CONFIRMED' && !o.adjustmentRequest && !o.adjustments.some((a) => a.status === 'AWAITING_CONFIRMATION' || a.status === 'REVISION_REQUESTED'),
  },
  { action: 'ACCEPT_ADJUSTMENT', label: 'Khách đồng ý phương án', when: (o) => !!o?.adjustments.some((a) => a.status === 'AWAITING_CONFIRMATION') },
  { action: 'REVISE_ADJUSTMENT', label: 'Khách yêu cầu sửa phương án', when: (o) => !!o?.adjustments.some((a) => a.status === 'AWAITING_CONFIRMATION') },
]

/**
 * CHỈ CÓ KHI VITE_USE_MOCK=true: nút giả lập việc khách làm trên đơn mới nhất của hội thoại,
 * để thử luồng khi chưa có BE và phía cặp đôi dùng dữ liệu giả riêng.
 */
export function CustomerSimulator({ conversationId, latestOrder }: { conversationId: string; latestOrder: ServiceOrder | undefined }) {
  const simulate = useSimulateCustomer(conversationId)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!isMock('vendorChat')) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={simulate.isPending}
        onClick={() => setOpen((o) => !o)}
        title="Chỉ có khi dùng dữ liệu giả"
        className="inline-flex h-[34px] items-center gap-1.5 rounded-sm border border-dashed border-info/50 bg-info-soft px-2.5 text-[12.5px] text-info disabled:opacity-60"
      >
        <FlaskConical className="size-4" />
        <span className="max-sm:hidden">Giả lập khách</span>
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div role="menu" className="absolute top-[calc(100%+4px)] right-0 z-30 grid w-[240px] gap-0.5 rounded-lg border border-line bg-surface p-1.5 shadow-portal-lift">
          <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] text-muted-foreground">Dữ liệu giả: khách làm trên đơn mới nhất{latestOrder ? ` (${latestOrder.code})` : ''}</p>
          {ACTIONS.map(({ action, label, when }) => {
            const enabled = when(latestOrder)
            return (
              <button
                key={action}
                type="button"
                role="menuitem"
                disabled={!enabled}
                onClick={() => {
                  setOpen(false)
                  simulate.mutate(action)
                }}
                className={cn('rounded-sm px-2.5 py-2 text-left text-[13px]', enabled ? 'hover:bg-info-soft hover:text-info' : 'cursor-not-allowed opacity-45')}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
