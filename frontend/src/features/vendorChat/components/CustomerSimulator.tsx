import { ChevronDown, FlaskConical } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isMock } from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CHANGE_LABEL } from '@/features/vendorOrders/constants'
import { clockOffsetHours } from '@/lib/clock'
import { cn } from '@/lib/utils'
import type { CustomerSimulation } from '@/types/vendorConversation'
import { REVISION_CHANGE_TYPES, type Order, type RevisionChangeType } from '@/types/vendorOrder'
import { useAdvanceTime, useSimulateCustomer } from '../hooks'

interface Item {
  label: string
  sim: CustomerSimulation
  when: (o: Order | undefined) => boolean
  /** Cần nhập thêm (hộp "Yêu cầu chỉnh sửa") trước khi chạy */
  dialog?: boolean
}

const canRequestRevision = (o: Order | undefined) =>
  o?.status === 'Pending'

/** Hộp giả lập khách "Yêu cầu chỉnh sửa": chọn nội dung muốn đổi và nhập lời nhắn (bắt buộc), như form phía khách. */
function RevisionDialog({ order, busy, onClose, onSubmit }: { order: Order | undefined; busy: boolean; onClose: () => void; onSubmit: (changes: RevisionChangeType[], note: string) => void }) {
  const [changes, setChanges] = useState<RevisionChangeType[]>([])
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const missing = !note.trim()
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Yêu cầu chỉnh sửa</DialogTitle>
          <DialogDescription>
            Giả lập khách yêu cầu chỉnh sửa đơn {order?.orderCode}. Đơn {order?.status === 'Pending' ? 'chuyển sang Chờ chỉnh sửa' : 'vẫn Đã đặt cọc, chờ bạn chỉnh sửa'}.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-medium">Nội dung muốn thay đổi</legend>
          {REVISION_CHANGE_TYPES.map((c) => (
            <label key={c} className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--gold)]" checked={changes.includes(c)} onChange={(e) => setChanges((cur) => (e.target.checked ? [...cur, c] : cur.filter((x) => x !== c)))} />
              {CHANGE_LABEL[c]}
            </label>
          ))}
        </fieldset>
        <label className="grid gap-1 text-[13px] font-medium">
          Lời nhắn *
          <textarea
            rows={3}
            value={note}
            aria-invalid={tried && missing ? true : undefined}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Giảm từ 20 xuống 15 bàn nhé."
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-normal leading-relaxed outline-none focus:border-gold aria-invalid:border-destructive"
          />
          {tried && missing && <span role="alert" className="text-xs font-normal text-destructive">Vui lòng nhập lời nhắn cho nhà cung cấp.</span>}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setTried(true)
              if (!missing) onSubmit(REVISION_CHANGE_TYPES.filter((c) => changes.includes(c)), note.trim())
            }}
          >
            Gửi yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
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
  const [revising, setRevising] = useState(false)
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
    { label: 'Khách yêu cầu chỉnh sửa đơn', sim: { action: 'REQUEST_REVISION', changes: [], note: '' }, when: canRequestRevision, dialog: true },
  ]
  const target = (sim: CustomerSimulation) => (sim.action === 'MESSAGE' ? undefined : newest(orders, ['Pending']))
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
          {items.map(({ label, sim, when, dialog }) => {
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
                  if (dialog) setRevising(true)
                  else simulate.mutate(sim)
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
      {revising && (
        <RevisionDialog
          order={target({ action: 'REQUEST_REVISION', changes: [], note: '' })}
          busy={simulate.isPending}
          onClose={() => setRevising(false)}
          onSubmit={(changes, note) => simulate.mutate({ action: 'REQUEST_REVISION', changes, note }, { onSuccess: () => setRevising(false) })}
        />
      )}
    </div>
  )
}
