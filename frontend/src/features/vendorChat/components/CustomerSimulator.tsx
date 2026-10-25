import { ChevronDown, FlaskConical } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isMock } from '@/api'
import { clockOffsetHours } from '@/lib/clock'
import { cn } from '@/lib/utils'
import type { CustomerSimulation } from '@/types/vendorConversation'
import type { Order } from '@/types/vendorOrder'
import { useAdvanceTime, useSimulateCustomer } from '../hooks'

interface Item {
  label: string
  sim: CustomerSimulation
  when: (o: Order | undefined) => boolean
}

const newest = (orders: Order[], status: Order['status'][]) =>
  orders.filter((o) => status.includes(o.status)).sort((a, b) => b.createdDate.localeCompare(a.createdDate))[0]

const TIME_STEPS: { label: string; hours: number }[] = [
  { label: 'Tua 1 giờ', hours: 1 },
  { label: 'Tua 6 giờ', hours: 6 },
  { label: 'Tua 1 ngày', hours: 24 },
  { label: 'Tua 8 ngày', hours: 24 * 8 },
]

/**
 * CHỈ CÓ KHI DÙNG DỮ LIỆU GIẢ: nút giả lập việc khách làm trên đơn của hội thoại (đặt cọc, yêu cầu chỉnh sửa,
 * hủy sau cọc, nhắn tin) và giả lập thời gian (tua đồng hồ để thử đơn hết hạn cọc, tự hoàn thành).
 */
export function CustomerSimulator({ conversationId, orders }: { conversationId: string; orders: Order[] }) {
  const simulate = useSimulateCustomer(conversationId)
  const advance = useAdvanceTime()
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

  if (!isMock('orders')) return null

  const items: Item[] = [
    { label: 'Khách nhắn tin', sim: { action: 'MESSAGE' }, when: () => true },
    { label: 'Khách đặt cọc qua VNPay', sim: { action: 'PAY_DEPOSIT' }, when: (o) => o?.status === 'Pending' },
    {
      label: 'Khách yêu cầu chỉnh sửa đơn',
      sim: { action: 'REQUEST_REVISION', changes: ['Quantity'], note: 'Cho nhà mình chỉnh lại số lượng một chút nhé.' },
      when: (o) => o?.status === 'Pending' || (o?.status === 'Deposited' && !o.revisions.some((r) => r.revisionType === 'AfterDeposit' && r.status === 'Requested')),
    },
    { label: 'Khách hủy đơn (sau cọc, mất cọc)', sim: { action: 'CANCEL_ORDER' }, when: (o) => o?.status === 'Deposited' },
  ]
  const target = (sim: CustomerSimulation) => (sim.action === 'PAY_DEPOSIT' ? newest(orders, ['Pending']) : sim.action === 'CANCEL_ORDER' ? newest(orders, ['Deposited']) : newest(orders, ['Pending', 'Deposited']))
  const shift = clockOffsetHours()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={simulate.isPending}
        onClick={() => setOpen((o) => !o)}
        title="Chỉ có khi dùng dữ liệu giả"
        className="inline-flex h-[34px] items-center gap-1.5 rounded-pill border border-dashed border-info/50 bg-info-soft px-3 text-[12.5px] text-info disabled:opacity-60"
      >
        <FlaskConical className="size-4" />
        <span className="max-sm:hidden">Giả lập{shift > 0 ? ` · +${shift >= 48 ? `${Math.round(shift / 24)} ngày` : `${shift} giờ`}` : ''}</span>
        <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div role="menu" className="absolute top-[calc(100%+4px)] right-0 z-30 grid w-[260px] gap-0.5 rounded-lg border border-line bg-surface p-1.5 shadow-portal-lift">
          <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] text-muted-foreground">Giả lập khách (dữ liệu giả)</p>
          {items.map(({ label, sim, when }) => {
            const t = target(sim)
            const enabled = when(t)
            return (
              <button
                key={label}
                type="button"
                role="menuitem"
                disabled={!enabled}
                onClick={() => {
                  setOpen(false)
                  simulate.mutate(sim)
                }}
                className={cn('rounded-sm px-2.5 py-2 text-left text-[13px]', enabled ? 'hover:bg-info-soft hover:text-info' : 'cursor-not-allowed opacity-45')}
              >
                {label}
                {sim.action !== 'MESSAGE' && t && <span className="ml-1.5 text-[11.5px] text-muted-foreground">{t.orderCode}</span>}
              </button>
            )
          })}
          <p className="mt-1 border-t border-line px-2.5 pt-2 pb-1 text-[11.5px] text-muted-foreground">Giả lập thời gian (thử hết hạn cọc, tự hoàn thành)</p>
          {TIME_STEPS.map(({ label, hours }) => (
            <button key={label} type="button" role="menuitem" onClick={() => advance(hours)} className="rounded-sm px-2.5 py-2 text-left text-[13px] hover:bg-info-soft hover:text-info">
              {label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            disabled={shift === 0}
            onClick={() => advance(0)}
            className={cn('rounded-sm px-2.5 py-2 text-left text-[13px]', shift === 0 ? 'cursor-not-allowed opacity-45' : 'hover:bg-info-soft hover:text-info')}
          >
            Về giờ thật
          </button>
        </div>
      )}
    </div>
  )
}
