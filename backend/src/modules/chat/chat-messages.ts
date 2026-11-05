import type { PrismaService } from '../../prisma/prisma.service';
import { publish } from '../realtime/realtime.bus';

type MessageType = 'Text' | 'Order' | 'DepositReceipt' | 'FinalInvoice' | 'Image' | 'File' | 'Audio';

/** Tệp đính kèm của tin Image / File / Audio (đã upload lên bucket chat-files) */
export interface MessageAttachment {
  path: string;
  name: string;
  mime: string;
  size: number;
  duration?: number | null;
}

/** Phần đọc kèm mỗi tin: mã / trạng thái đơn, tin được trả lời, cảm xúc */
export const messageInclude = {
  orders: { select: { order_code: true, status: true } },
  messages: { select: { id: true, sender_id: true, content: true, type: true, recalled_date: true } },
  message_reactions: { select: { user_id: true, emoji: true } },
} as const;

/**
 * Ghi một tin vào hội thoại, cập nhật thời điểm tin cuối và báo realtime cho cả hai bên. sender_id = null là tin hệ thống.
 * `replyToId`: tin được trả lời (đã kiểm cùng hội thoại); `isAuto`: tin NCC do hệ thống trả lời tự động.
 */
export async function postMessage(
  prisma: PrismaService,
  data: { conversationId: string; senderId: string | null; content: string; type?: MessageType; orderId?: string | null; isRead?: boolean; replyToId?: string | null; isAuto?: boolean; attachment?: MessageAttachment },
) {
  const now = new Date();
  const [message, conv] = await prisma.$transaction([
    prisma.messages.create({
      data: {
        conversation_id: data.conversationId,
        sender_id: data.senderId,
        order_id: data.orderId ?? null,
        content: data.content,
        type: data.type ?? 'Text',
        is_read: data.isRead ?? false,
        sent_date: now,
        reply_to_id: data.replyToId ?? null,
        is_auto: data.isAuto ?? false,
        ...(data.attachment && {
          attachment_path: data.attachment.path,
          attachment_name: data.attachment.name,
          attachment_mime: data.attachment.mime,
          attachment_size: data.attachment.size,
          attachment_duration: data.attachment.duration ?? null,
        }),
      },
      include: messageInclude,
    }),
    prisma.conversations.update({ where: { id: data.conversationId }, data: { last_message_date: now }, select: { couple_id: true, vendor_id: true } }),
  ]);
  publish({ users: [conv.couple_id!, conv.vendor_id!], event: 'message', data: { conversationId: data.conversationId, orderId: message.order_id, type: message.type } });
  return message;
}

/** Thông báo cho một người dùng (bảng notifications), kèm báo realtime cho người đó. */
export async function notify(
  prisma: PrismaService,
  data: { userId: string; type: string; title: string; content: string; referenceType?: string; referenceId?: string },
) {
  await prisma.notifications.create({
    data: { user_id: data.userId, type: data.type, title: data.title, content: data.content, reference_type: data.referenceType ?? null, reference_id: data.referenceId ?? null },
  });
  publish({ users: [data.userId], event: 'notification', data: { type: data.type, referenceType: data.referenceType ?? null, referenceId: data.referenceId ?? null } });
}

/** Người nhận đã mở hội thoại: đánh dấu đã đọc thông báo NewMessage của hội thoại đó. */
export async function markNewMessageRead(prisma: PrismaService, userId: string, conversationId: string) {
  await prisma.notifications.updateMany({
    where: { user_id: userId, type: 'NewMessage', reference_type: 'Conversation', reference_id: conversationId, is_read: false },
    data: { is_read: true, read_date: new Date() },
  });
}
