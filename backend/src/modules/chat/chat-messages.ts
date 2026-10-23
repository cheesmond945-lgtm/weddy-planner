import type { PrismaService } from '../../prisma/prisma.service';

type MessageType = 'Text' | 'Order' | 'DepositReceipt' | 'FinalInvoice';

/** Ghi một tin vào hội thoại và cập nhật thời điểm tin cuối. sender_id = null là tin hệ thống. */
export async function postMessage(
  prisma: PrismaService,
  data: { conversationId: string; senderId: string | null; content: string; type?: MessageType; orderId?: string | null; isRead?: boolean },
) {
  const now = new Date();
  const [message] = await prisma.$transaction([
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
      include: { orders: { select: { order_code: true } } },
    }),
    prisma.conversations.update({ where: { id: data.conversationId }, data: { last_message_date: now } }),
  ]);
  return message;
}

/** Thông báo cho một người dùng (bảng notifications). */
export async function notify(
  prisma: PrismaService,
  data: { userId: string; type: string; title: string; content: string; referenceType?: string; referenceId?: string },
) {
  await prisma.notifications.create({
    data: { user_id: data.userId, type: data.type, title: data.title, content: data.content, reference_type: data.referenceType ?? null, reference_id: data.referenceId ?? null },
  });
}
