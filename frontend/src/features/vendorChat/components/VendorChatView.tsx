import { MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { OrderFormDialog, type OrderFormMode } from '@/features/vendorOrders/components/OrderFormDialog'
import { cn } from '@/lib/utils'
import type { Order } from '@/types/vendorOrder'
import { useVendorConversations } from '../hooks'
import { ChatThread } from './ChatThread'
import { ConversationList } from './ConversationList'

/**
 * Trang Tin nhắn của NCC: danh sách hội thoại trái, khung chat phải; tạo, sửa, gửi lại đơn ngay trong chat.
 * Hội thoại đang mở nằm trên URL (?c=) để tải lại trang vẫn giữ. Màn hình ≤ 900px: chỉ hiện một bên.
 */
export function VendorChatView() {
  const { data: conversations, isPending, isError, error, refetch } = useVendorConversations()
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState<OrderFormMode | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)

  const picked = params.get('c')
  const active = conversations?.find((c) => c.id === picked) ?? (picked ? undefined : conversations?.[0])
  const showChat = !!picked

  // Làm nổi thẻ đơn vừa gửi trong 2,4 giây (như prototype)
  useEffect(() => {
    if (!highlight) return
    const t = setTimeout(() => setHighlight(null), 2400)
    return () => clearTimeout(t)
  }, [highlight])

  const select = (id: string | null) => {
    setForm(null)
    setParams(id ? { c: id } : {}, { replace: !id })
  }

  // 62px header + 90px đệm trên/dưới của VendorLayout (mobile 70px)
  const frame =
    'grid h-[calc(100dvh-152px)] max-h-[900px] min-h-[610px] overflow-hidden rounded-[26px] bg-surface shadow-panel max-[900px]:h-[calc(100dvh-132px)] max-[900px]:min-h-[520px]'

  if (isPending) return <div aria-busy="true" aria-label="Đang tải tin nhắn" className={cn(frame, 'animate-pulse bg-muted')} />
  if (isError) {
    return <EmptyState title="Chưa tải được tin nhắn" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
  }

  return (
    <>
      <section className={cn(frame, 'grid-cols-[340px_minmax(0,1fr)] max-[900px]:grid-cols-1')}>
        <div className={cn('flex min-h-0 flex-col', showChat && 'max-[900px]:hidden')}>
          <ConversationList conversations={conversations} selectedId={active?.id ?? null} onSelect={select} />
        </div>
        <div className={cn('flex min-h-0 min-w-0 flex-col', !showChat && 'max-[900px]:hidden')}>
          {active ? (
            <ChatThread key={active.id} conversation={active} highlightOrderId={highlight} onBack={() => select(null)} onOpenForm={setForm} />
          ) : (
            <EmptyState
              className="m-auto border-0 bg-transparent"
              title={conversations.length ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện'}
              description={conversations.length ? 'Chọn một cuộc trò chuyện ở danh sách bên trái.' : 'Khi khách nhắn tin, cuộc trò chuyện sẽ hiện ở đây.'}
              action={<MessageSquare className="mx-auto size-6 text-gold" />}
            />
          )}
        </div>
      </section>

      {form && active && (
        <OrderFormDialog
          // Key theo chế độ và đơn để form nạp lại giá trị khi mở đơn khác
          key={`${form.kind}-${'order' in form ? form.order.id : 'from' in form ? form.from.id : 'new'}`}
          conversationId={active.id}
          customer={active.customer}
          mode={form}
          onClose={() => setForm(null)}
          onSent={(o: Order) => setHighlight(o.id)}
        />
      )}
    </>
  )
}
