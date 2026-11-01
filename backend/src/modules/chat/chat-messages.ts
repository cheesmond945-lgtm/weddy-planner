import type { PrismaService } from '../../prisma/prisma.service';
import { publish } from '../realtime/realtime.bus';

type MessageType = 'Text' | 'Order' | 'DepositReceipt' | 'FinalInvoice';

/** Ghi một tin vào hội thoại, cập nhật thời điểm tin cuối và báo realtime cho cả hai bên. sender_id = null là tin hệ thống. */
export async function postMessage(
  prisma: PrismaService,
  data: { conversationId: string; senderId: string | null; content: string; type?: MessageType; orderId?: string | null; isRead?: boolean },
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
      },
      include: { orders: { select: { order_code: true, status: true } } },
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

/**
 * Báo tin nhắn mới: mỗi hội thoại chỉ giữ một thông báo NewMessage chưa đọc cho mỗi người nhận,
 * đã có thì không tạo thêm. Người nhận mở hội thoại (markNewMessageRead) thì tin kế tiếp báo lại.
 * Lỗi ghi thông báo không được làm hỏng việc gửi tin, nên hàm này không ném lỗi.
 */
export async function notifyNewMessage(prisma: PrismaService, data: { userId: string; conversationId: string; from: string; content: string }) {
  try {
    const where = { user_id: data.userId, type: 'NewMessage', reference_type: 'Conversation', reference_id: data.conversationId, is_read: false };
    if (await prisma.notifications.count({ where })) return;
    await notify(prisma, {
      userId: data.userId,
      type: 'NewMessage',
      title: `Tin nhắn mới từ ${data.from}`,
      content: data.content.length > 120 ? `${data.content.slice(0, 117)}...` : data.content,
      referenceType: 'Conversation',
      referenceId: data.conversationId,
    });
  } catch {
    /* bỏ qua: thông báo chỉ là phụ */
  }
}

/** Người nhận đã mở hội thoại: đánh dấu đã đọc thông báo NewMessage của hội thoại đó. */
export async function markNewMessageRead(prisma: PrismaService, userId: string, conversationId: string) {
  await prisma.notifications.updateMany({
    where: { user_id: userId, type: 'NewMessage', reference_type: 'Conversation', reference_id: conversationId, is_read: false },
    data: { is_read: true, read_date: new Date() },
  });
}
