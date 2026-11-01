import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { hallKeys } from '@/features/halls/hooks'
import { coupleOrderKeys } from '@/features/orders/hooks'
import { vendorKeys } from '@/features/vendorOrders/keys'
import { planningKeys } from '@/features/weddings/hooks'
import { connectRealtime, disconnectRealtime } from '@/lib/realtime'
import { useAuth } from '@/store/auth'

/**
 * Nối sự kiện realtime của backend vào cache React Query: có tin mới (kể cả thẻ đơn, tin hệ thống khi đơn đổi trạng thái),
 * đã đọc, thông báo mới thì tải lại đúng các truy vấn liên quan đang hiển thị. Không vẽ gì.
 * Chỉ kết nối khi đăng nhập thật (dữ liệu giả không có backend để nghe).
 */
export function RealtimeBridge() {
  const { session, user } = useAuth()
  const qc = useQueryClient()
  const token = session?.accessToken
  const uid = user?.id
  const role = user?.role

  useEffect(() => {
    if (!token || !uid) return
    const invalidate = (queryKey: readonly unknown[]) => void qc.invalidateQueries({ queryKey })

    connectRealtime(token, {
      message: ({ conversationId, orderId }) => {
        if (role === 'COUPLE') {
          invalidate(planningKeys.conversations(uid))
          invalidate(planningKeys.messages(uid, conversationId))
          if (orderId) {
            invalidate(planningKeys.order(uid, orderId))
            invalidate(coupleOrderKeys.all(uid))
            // Đặt cọc, hủy đơn đổi kế hoạch và việc cần làm của khách
            invalidate(planningKeys.plan(uid))
            invalidate(planningKeys.timeline(uid))
            // Cọc / hủy làm sảnh bận / trống (lịch của sảnh, số sảnh trống)
            invalidate(['halls'])
          }
        } else if (role === 'VENDOR') {
          invalidate(vendorKeys.conversations(uid))
          invalidate(vendorKeys.unread(uid))
          invalidate(vendorKeys.messages(uid, conversationId))
          if (orderId) {
            invalidate(vendorKeys.orders(uid, conversationId))
            invalidate(vendorKeys.order(uid, orderId))
            invalidate(vendorKeys.orderLists(uid))
            invalidate(vendorKeys.calendar(uid))
            invalidate(vendorKeys.orderCounts(uid))
            // Cọc / hủy / đổi ngày thực hiện sinh hoặc gỡ việc chi tiết của đơn
            invalidate(vendorKeys.orderProgress(uid))
            invalidate(vendorKeys.taskBoard(uid))
            // Khách cọc / NCC hủy hoặc đổi ngày, đổi sảnh: lịch bận theo sảnh đổi
            invalidate(hallKeys.vendorBusy(uid))
          }
        }
      },
      // Việc của đơn đổi (khách tick / đổi hạn, NCC tick / bỏ tick): timeline của khách, lịch và tiến độ của NCC tải lại
      task: () => {
        if (role === 'COUPLE') invalidate(planningKeys.timeline(uid))
        if (role === 'VENDOR') {
          invalidate(vendorKeys.orderProgress(uid))
          invalidate(['vendor', uid, 'order-tasks'])
          invalidate(vendorKeys.calendar(uid))
          invalidate(vendorKeys.taskBoard(uid))
        }
      },
      read: () => {
        if (role === 'COUPLE') invalidate(planningKeys.conversations(uid))
        if (role === 'VENDOR') {
          invalidate(vendorKeys.conversations(uid))
          invalidate(vendorKeys.unread(uid))
        }
      },
      notification: ({ type }) => {
        const task = type.startsWith('Task')
        if (role === 'COUPLE') {
          invalidate(['couple', 'notifications'])
          // NCC cập nhật tiến độ: việc trên timeline của khách đổi theo
          if (task) invalidate(planningKeys.timeline(uid))
        }
        if (role === 'VENDOR') {
          invalidate(['vendor', 'notifications'])
          if (task || type === 'WeddingDateChanged') {
            invalidate(vendorKeys.orderProgress(uid))
            invalidate(['vendor', uid, 'order-tasks'])
            invalidate(vendorKeys.calendar(uid))
            invalidate(vendorKeys.taskBoard(uid))
          }
        }
        if (role === 'ADMIN') invalidate(['admin', 'notifications'])
      },
    })
    return disconnectRealtime
  }, [qc, token, uid, role])

  return null
}
