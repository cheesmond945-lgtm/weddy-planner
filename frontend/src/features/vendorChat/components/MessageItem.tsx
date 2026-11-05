import { Receipt } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AttachmentContent, ImageAlbum } from '@/features/chat/components/ChatAttachments'
import { imagesOf, MessageShell, type NameOf } from '@/features/chat/components/MessageExtras'
import { effectiveSender } from '@/features/chat/messageSender'
import { formatStamp } from '@/features/vendorOrders/calc'
import { OrderCard } from '@/features/vendorOrders/components/OrderCard'
import type { OrderFormMode } from '@/features/vendorOrders/components/OrderFormDialog'
import { cn } from '@/lib/utils'
import type { VendorMessage } from '@/types/vendorConversation'
import type { InvoiceType, Order } from '@/types/vendorOrder'

interface MessageItemProps {
  message: VendorMessage
  order: Order | undefined
  /** Thẻ mới nhất của đơn (gửi lại thì các thẻ cũ thu gọn) */
  isLatestCard: boolean
  /** Đơn vừa gửi: làm nổi thẻ */
  highlight: boolean
  onOpenForm: (mode: OrderFormMode) => void
  onViewOrder: (order: Order) => void
  onViewInvoice: (order: Order, type: InvoiceType) => void
  /** Tin chữ: trả lời / thả cảm xúc (như Messenger) */
  nameOf: NameOf
  onReply: (m: VendorMessage) => void
  onReact: (messageId: string, emoji: string | null) => void
  onRecall: (messageId: string) => void
  /** Tin đầu của album ảnh: mọi tin ảnh của album (albums.ts) */
  album?: VendorMessage[]
}

const Time = ({ at }: { at: string }) => <time className="mt-1 text-[11px] text-muted-foreground">{formatStamp(at)}</time>

/** Khung tin: của NCC bên phải (kể cả hóa đơn cuối), của khách bên trái; tin hệ thống và giấy xác nhận cọc nằm giữa. */
function Bubble({ mine, wide, at, children }: { mine: boolean; wide?: boolean; at: string; children: ReactNode }) {
  return (
    <div className={cn('grid max-w-[78%] max-[640px]:max-w-[94%]', mine ? 'self-end justify-items-end' : 'self-start', wide && 'w-full max-w-[min(420px,92%)] max-[640px]:max-w-full')}>
      {children}
      <Time at={at} />
    </div>
  )
}

/** Một tin trong khung chat, theo Messages.Type (Text, Order, DepositReceipt, FinalInvoice) và tin hệ thống (SenderId rỗng). */
export function MessageItem({ message: m, order, isLatestCard, highlight, onOpenForm, onViewOrder, onViewInvoice, nameOf, onReply, onReact, onRecall, album }: MessageItemProps) {
  switch (m.type) {
    case 'Order': {
      if (!order) break
      // Gửi lại: các thẻ cũ của cùng đơn thu gọn thành một dòng
      if (!isLatestCard) {
        return (
          <p className="self-center rounded-pill bg-bg px-3.5 py-1.5 text-center text-[12.5px] text-muted-foreground">
            Đơn {order.orderCode} đã được chỉnh sửa, xem bản mới nhất bên dưới <time className="ml-1 text-[11px]">{formatStamp(m.sentDate)}</time>
          </p>
        )
      }
      return (
        <Bubble mine wide at={m.sentDate}>
          <OrderCard order={order} highlight={highlight} onOpenForm={onOpenForm} onView={onViewOrder} onViewInvoice={onViewInvoice} />
        </Bubble>
      )
    }
    case 'DepositReceipt':
    case 'FinalInvoice': {
      // Suy theo loại tin (tin cũ có thể lưu sai sender): hóa đơn cuối do NCC xuất = bên PHẢI; giấy xác nhận cọc = tin hệ thống GIỮA khung
      const viewButton = order && (
        <Button size="sm" variant="outline" className="mt-2.5 border-line-strong" onClick={() => onViewInvoice(order, m.type as InvoiceType)}>
          Xem
        </Button>
      )
      if (effectiveSender(m) === 'SYSTEM') {
        return (
          <div className="grid w-full max-w-[min(420px,92%)] justify-items-center self-center max-[640px]:max-w-full">
            <div className="w-full rounded-[22px] border border-sage/25 bg-sage-soft px-4 py-3">
              <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-sage uppercase">Forever xác nhận</p>
              <div className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
                <Receipt className="mt-0.5 size-4 flex-none text-sage" />
                <span>{m.content}</span>
              </div>
              {viewButton}
            </div>
            <Time at={m.sentDate} />
          </div>
        )
      }
      return (
        <Bubble mine wide at={m.sentDate}>
          <div className="w-full rounded-[22px] rounded-br-[5px] border border-line bg-surface px-4 py-3 shadow-bubble">
            <div className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
              <Receipt className="mt-0.5 size-4 flex-none text-sage" />
              <span>{m.content}</span>
            </div>
            {viewButton}
          </div>
        </Bubble>
      )
    }
  }

  if (m.sender === 'SYSTEM') {
    return (
      <p
        className={cn(
          'flex max-w-[94%] flex-wrap items-center justify-center gap-x-2 self-center rounded-[20px] px-[15px] py-[9px] text-center text-[13px]',
          /hủy|hết hạn|yêu cầu chỉnh sửa|bỏ ghi nhận/i.test(m.content) ? 'bg-warn-soft text-warn' : 'bg-sage-soft text-sage',
        )}
      >
        {m.content}
        <span className="text-[11.5px] text-muted-foreground">{formatStamp(m.sentDate)}</span>
      </p>
    )
  }

  const mine = m.sender === 'VENDOR'
  return (
    <Bubble mine={mine} at={m.sentDate}>
      <MessageShell
        message={m}
        mine={mine}
        nameOf={nameOf}
        width="max-w-full"
        onReply={(x) => onReply(x as VendorMessage)}
        onReact={onReact}
        // Thu hồi album là thu hồi mọi ảnh của album
        onRecall={() => (album ?? [m]).forEach((x) => onRecall(x.id))}
        images={imagesOf(album ?? [m])}
      >
        {album ? (
          <ImageAlbum images={album.flatMap((x) => (x.attachment ? [x.attachment] : []))} />
        ) : m.attachment ? (
          <AttachmentContent attachment={m.attachment} mine={mine} />
        ) : (
          <div className={cn('rounded-[20px] px-[15px] py-[11px] text-[13px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]', mine ? 'rounded-br-[5px] bg-primary text-primary-foreground' : 'rounded-bl-[5px] bg-bg text-ink')}>
            {m.content}
          </div>
        )}
      </MessageShell>
    </Bubble>
  )
}
