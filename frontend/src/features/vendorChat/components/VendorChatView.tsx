import { MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { AdjustmentView, OrderDetailDialog } from '@/features/serviceOrders/components/OrderDetailDialog'
import { OrderFormDialog } from '@/features/serviceOrders/components/OrderFormDialog'
import { PanelDialog } from '@/features/serviceOrders/components/PanelDialog'
import { cn } from '@/lib/utils'
import type { ServiceOrder } from '@/types/serviceOrder'
import { useVendorConversations } from '../hooks'
import { ChatThread } from './ChatThread'
import { ConversationList } from './ConversationList'

type Panel =
  | { type: 'form'; order?: ServiceOrder }
  | { type: 'detail'; order: ServiceOrder; version: number }
  | { type: 'adjustment'; order: ServiceOrder; adjustmentId: string }

/**
 * Trang Tin nhắn của NCC: danh sách hội thoại trái, khung chat phải; tạo, sửa, gửi lại đơn ngay trong chat.
 * Hội thoại đang mở nằm trên URL (?c=) để tải lại trang vẫn giữ. Màn hình ≤ 900px: chỉ hiện một bên.
 */
export function VendorChatView() {
  const { data: conversations, isPending, isError, error, refetch } = useVendorConversations()
  const [params, setParams] = useSearchParams()
  const [panel, setPanel] = useState<Panel | null>(null)
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
    setPanel(null)
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
            <ChatThread
              key={active.id}
              conversation={active}
              highlightOrderId={highlight}
              onBack={() => select(null)}
              onOpenForm={(order) => setPanel({ type: 'form', order })}
              onEditOrder={(order) => setPanel({ type: 'form', order })}
              onViewOrder={(order, version) => setPanel({ type: 'detail', order, version })}
              onViewAdjustment={(order, adjustmentId) => setPanel({ type: 'adjustment', order, adjustmentId })}
            />
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

      {panel?.type === 'form' && active && (
        <OrderFormDialog
          conversationId={active.id}
          customer={active.customer}
          order={panel.order}
          onClose={() => setPanel(null)}
          onSent={(o) => setHighlight(o.id)}
        />
      )}
      {panel?.type === 'detail' && <OrderDetailDialog order={panel.order} version={panel.version} onClose={() => setPanel(null)} />}
      {panel?.type === 'adjustment' &&
        (() => {
          const a = panel.order.adjustments.find((x) => x.id === panel.adjustmentId)
          return (
            <PanelDialog
              open
              size="md"
              onRequestClose={() => setPanel(null)}
              title={`Phương án điều chỉnh ${panel.order.code}`}
              subtitle="Đơn hiện hành giữ nguyên tới khi khách đồng ý. Lập, sửa phương án ở Quản lý đơn hàng."
              footer={<Button onClick={() => setPanel(null)}>Đóng</Button>}
            >
              {a ? <AdjustmentView adjustment={a} /> : <p className="text-muted-foreground">Không tìm thấy phương án.</p>}
            </PanelDialog>
          )
        })()}
    </>
  )
}
