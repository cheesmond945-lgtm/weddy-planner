import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { vendorConversationsApi } from '@/api/vendorConversations'
import { showMessageToast } from '@/features/notifications/components/MessageToaster'
import { vendorKeys } from '@/features/vendorOrders/keys'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'
import { useUnreadQuery } from './hooks'

const excerpt = (s: string) => (s.length > 90 ? `${s.slice(0, 87)}...` : s)

/**
 * NCC đang ở trang khác mà khách nhắn tin mới thì hiện toast "{tên khách}: {trích đoạn}", bấm vào mở hội thoại.
 * Đang mở đúng hội thoại đó (trang Tin nhắn, ?c= hoặc hội thoại đầu danh sách khi chưa chọn) thì không hiện.
 * Phát hiện qua số tin chưa đọc (hỏi lại 15 giây, dừng khi tab ẩn): số đổi thì tải danh sách hội thoại và so với tin khách mới nhất đã thấy.
 */
export function useIncomingMessageToasts() {
  const { user } = useAuth()
  const uid = user?.role === 'VENDOR' ? user.id : undefined
  const qc = useQueryClient()
  const { data: unread } = useUnreadQuery()
  const location = useLocation()
  const where = useRef(location)
  where.current = location
  const prev = useRef<number | null>(null)
  const seenAt = useRef<string | null>(null)

  useEffect(() => {
    if (!uid || unread === undefined || prev.current === unread) return
    const first = prev.current === null
    prev.current = unread
    let cancelled = false
    void (async () => {
      const list = await qc.fetchQuery({ queryKey: vendorKeys.conversations(uid), queryFn: vendorConversationsApi.list, staleTime: 0 })
      if (cancelled) return
      const incoming = list.filter((c) => c.lastMessage?.sender === 'COUPLE')
      const latest = incoming.reduce((m, c) => (c.lastMessage!.sentDate > m ? c.lastMessage!.sentDate : m), '')
      if (!first && seenAt.current !== null) {
        const { pathname, search } = where.current
        const openId = pathname.startsWith(paths.vendor.chat) ? (new URLSearchParams(search).get('c') ?? list[0]?.id ?? null) : null
        for (const c of incoming) {
          const m = c.lastMessage!
          if (c.unreadCount > 0 && m.sentDate > seenAt.current && c.id !== openId) {
            showMessageToast({ title: c.customer.name, text: excerpt(m.content), href: `${paths.vendor.chat}?c=${encodeURIComponent(c.id)}` })
          }
        }
      }
      if (seenAt.current === null || latest > seenAt.current) seenAt.current = latest
    })()
    return () => {
      cancelled = true
    }
  }, [uid, unread, qc])
}
