import type { postMessage } from './chat-messages';

export type ChatRole = 'Couple' | 'Vendor';
export type MessageType = 'Text' | 'Order' | 'DepositReceipt' | 'FinalInvoice';
export type MessageSender = 'COUPLE' | 'VENDOR' | 'SYSTEM';

export type MessageRow = Awaited<ReturnType<typeof postMessage>>;

/** SenderId rỗng là tin hệ thống; còn lại so với tài khoản cặp đôi của hội thoại. */
export const senderOf = (m: { sender_id: string | null }, coupleId: string): MessageSender =>
  m.sender_id === null ? 'SYSTEM' : m.sender_id === coupleId ? 'COUPLE' : 'VENDOR';

/**
 * Tin nhắn dùng chung cho cả hai vai trò (docs/database.md 4.18). `order` là phần thêm cho tin Order,
 * DepositReceipt, FinalInvoice để FE vẽ ô đơn gọn khi chưa nối API đơn hàng.
 */
export function toMessage(m: MessageRow, coupleId: string) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    sender: senderOf(m, coupleId),
    type: m.type as MessageType,
    orderId: m.order_id,
    content: m.content,
    isRead: m.is_read,
    sentDate: m.sent_date.toISOString(),
    order: m.orders ? { orderCode: m.orders.order_code, status: m.orders.status } : null,
  };
}

/** Tin cuối của một hội thoại, dùng trong danh sách. */
export function toLastMessage(m: MessageRow, coupleId: string) {
  const { sender, type, content, sentDate, order } = toMessage(m, coupleId);
  return { sender, type, content, sentDate, orderCode: order?.orderCode ?? null };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);

/** Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const todayVn = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
