import type { postMessage } from './chat-messages';

export type ChatRole = 'Couple' | 'Vendor';
export type MessageType = 'Text' | 'Order' | 'DepositReceipt' | 'FinalInvoice' | 'Image' | 'File' | 'Audio';
export type MessageSender = 'COUPLE' | 'VENDOR' | 'SYSTEM';

export type MessageRow = Awaited<ReturnType<typeof postMessage>>;

/** SenderId rỗng là tin hệ thống; còn lại so với tài khoản cặp đôi của hội thoại. */
export const senderOf = (m: { sender_id: string | null }, coupleId: string | null): MessageSender =>
  m.sender_id === null ? 'SYSTEM' : m.sender_id === coupleId ? 'COUPLE' : 'VENDOR';

/** Cảm xúc thả được vào tin (như Messenger) */
export const REACTIONS = ['❤️', '😆', '😮', '😢', '😠', '👍'] as const;

/** Độ dài đoạn trích của tin được trả lời */
const QUOTE_CHARS = 120;

/** Gộp cảm xúc theo emoji, theo thứ tự của REACTIONS; `mine`: người xem đã thả emoji này */
function reactionsOf(rows: { user_id: string; emoji: string | null }[], viewerId: string | undefined) {
  const out: { emoji: string; count: number; mine: boolean }[] = [];
  for (const emoji of REACTIONS) {
    const who = rows.filter((r) => r.emoji === emoji);
    if (who.length) out.push({ emoji, count: who.length, mine: who.some((r) => r.user_id === viewerId) });
  }
  return out;
}

/**
 * Tin nhắn dùng chung cho cả hai vai trò (docs/database.md 4.18). `order` là phần thêm cho tin Order,
 * DepositReceipt, FinalInvoice để FE vẽ ô đơn gọn khi chưa nối API đơn hàng. `replyTo`: đoạn trích tin được trả lời;
 * `reactions`: cảm xúc đã gộp (`mine` theo `viewerId`); `isAuto`: tin NCC do hệ thống trả lời tự động.
 */
/** Nội dung thay cho tin đã thu hồi (tin cuối trong danh sách hội thoại, đoạn trích khi trả lời) */
export const RECALLED_TEXT = 'Tin nhắn đã được thu hồi';

export function toMessage(m: MessageRow, coupleId: string | null, viewerId?: string, fileUrls?: Map<string, string>) {
  const quoted = m.messages;
  // Tin đã thu hồi: không trả nội dung, tệp, cảm xúc, đoạn trích
  if (m.recalled_date) {
    return {
      id: m.id,
      conversationId: m.conversation_id,
      sender: senderOf(m, coupleId),
      type: m.type as MessageType,
      orderId: m.order_id,
      content: RECALLED_TEXT,
      isRead: m.is_read,
      sentDate: (m.sent_date ?? new Date(0)).toISOString(),
      order: null,
      replyTo: null,
      reactions: [],
      isAuto: !!m.is_auto,
      attachment: null,
      recalled: true,
    };
  }
  const attachment = m.attachment_path
    ? { url: fileUrls?.get(m.attachment_path) ?? null, name: m.attachment_name ?? 'tệp', mime: m.attachment_mime ?? 'application/octet-stream', size: m.attachment_size ?? 0, duration: m.attachment_duration ?? null }
    : null;
  return {
    id: m.id,
    conversationId: m.conversation_id,
    sender: senderOf(m, coupleId),
    type: m.type as MessageType,
    orderId: m.order_id,
    content: m.content,
    isRead: m.is_read,
    sentDate: (m.sent_date ?? new Date(0)).toISOString(),
    order: m.orders ? { orderCode: m.orders.order_code, status: m.orders.status } : null,
    replyTo: quoted ? { id: quoted.id, sender: senderOf(quoted, coupleId), content: quoted.recalled_date ? RECALLED_TEXT : (quoted.content ?? '').slice(0, QUOTE_CHARS) } : null,
    reactions: reactionsOf(m.message_reactions, viewerId),
    isAuto: !!m.is_auto,
    /** Tin Image / File / Audio: link xem tạm (ký 1 giờ), tên, kiểu, dung lượng, độ dài ghi âm (giây) */
    attachment,
    recalled: false,
  };
}

/** Tin cuối của một hội thoại, dùng trong danh sách. */
export function toLastMessage(m: MessageRow, coupleId: string | null) {
  const { sender, type, content, sentDate, order } = toMessage(m, coupleId);
  return { sender, type, content, sentDate, orderCode: order?.orderCode ?? null };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);

/** Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const todayVn = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
