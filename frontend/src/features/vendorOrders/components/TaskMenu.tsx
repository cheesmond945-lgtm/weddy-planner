import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { RowMenu, type RowMenuItem } from '@/features/vendorPackages/components/RowMenu'
import type { OrderTask } from '@/types/vendorOrder'
import { useOrderTaskEdits } from '../taskActions'
import { OrderTaskDialog } from './OrderTaskDialog'

type MenuTask = Pick<OrderTask, 'id' | 'title' | 'owner' | 'status' | 'isDone' | 'isPackageTask' | 'isCustomOrderTask'>

/** Nhãn nhỏ "Thêm riêng" cạnh nhãn chủ việc: việc do NCC thêm cho riêng đơn này. */
export function CustomTaskTag() {
  return <span className="shrink-0 rounded-pill border border-dashed border-gold-ink/50 px-2 py-0.5 text-[11.5px] leading-none font-medium whitespace-nowrap text-gold-ink">Thêm riêng</span>
}

/**
 * Menu "⋯" của một thẻ việc chưa xong:
 *   việc riêng ('ORD:'): Sửa việc, Bỏ việc khỏi đơn · việc của gói ('PKG:'): Bỏ việc khỏi đơn (hỏi xác nhận) · thanh toán ('PAY:') và việc đã xong: không có menu.
 * Bỏ việc chỉ gỡ khỏi ĐƠN NÀY, gói và các đơn khác không đổi.
 */
export function TaskMenu({ task, orderId, customerName, eventDate, readOnly }: { task: MenuTask; orderId: string; customerName?: string; eventDate: string; readOnly?: boolean }) {
  const { remove } = useOrderTaskEdits()
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)

  if (readOnly || task.isDone || (!task.isCustomOrderTask && !task.isPackageTask)) return null
  const items: RowMenuItem[] = [
    ...(task.isCustomOrderTask ? [{ label: 'Sửa việc', icon: Pencil, onClick: () => setEditing(true) }] : []),
    { label: 'Bỏ việc khỏi đơn', icon: Trash2, danger: true, onClick: () => setRemoving(true) },
  ]
  return (
    <>
      <RowMenu compact label={task.title} items={items} />
      {editing && <OrderTaskDialog open orderId={orderId} eventDate={eventDate} task={task as OrderTask} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={removing} onOpenChange={setRemoving} title="Bỏ việc khỏi đơn?" confirmLabel="Bỏ việc" danger onConfirm={() => void remove(orderId, task.id)}>
        <p>
          Bỏ “{task.title}” khỏi đơn của {customerName || 'khách'}? Gói dịch vụ và các đơn khác không thay đổi.
        </p>
      </ConfirmDialog>
    </>
  )
}
