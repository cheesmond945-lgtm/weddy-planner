import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UUID, fail } from '../orders/order-rules';

const MAX_LIMIT = 100;

export interface NotificationQuery {
  limit?: string | number;
  unreadOnly?: string;
  before?: string;
}

/**
 * Thông báo của người dùng đang đăng nhập (bảng Notifications), dùng chung cho cặp đôi, NCC và Admin: chỉ đọc và đánh dấu
 * thông báo của chính mình. Thông báo do các module khác tạo (tin nhắn mới, đơn gửi/cọc/hết hạn/hoàn thành/hủy...).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mới nhất trước. before = createdDate của thông báo cuối trang trước (phân trang), unreadOnly = 'true' chỉ lấy chưa đọc. */
  async list(userId: string, q: NotificationQuery) {
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(q.limit)) || 30));
    const before = q.before ? new Date(q.before) : null;
    const rows = await this.prisma.notifications.findMany({
      where: {
        user_id: userId,
        ...(q.unreadOnly === 'true' ? { is_read: false } : {}),
        ...(before && !Number.isNaN(before.getTime()) ? { created_date: { lt: before } } : {}),
      },
      orderBy: [{ created_date: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      referenceType: n.reference_type,
      referenceId: n.reference_id,
      isRead: n.is_read,
      readDate: n.read_date ? n.read_date.toISOString() : null,
      createdDate: n.created_date.toISOString(),
    }));
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notifications.count({ where: { user_id: userId, is_read: false } }) };
  }

  /** Đánh dấu một thông báo đã đọc (idempotent). Không phải của người gọi: 404 NOTIFICATION_NOT_FOUND. */
  async markRead(userId: string, id: string) {
    const n = UUID.test(id) ? await this.prisma.notifications.findFirst({ where: { id, user_id: userId }, select: { id: true, is_read: true } }) : null;
    if (!n) return fail('NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.', 404);
    if (!n.is_read) await this.prisma.notifications.updateMany({ where: { id, user_id: userId, is_read: false }, data: { is_read: true, read_date: new Date() } });
    return null;
  }

  async markAllRead(userId: string) {
    const r = await this.prisma.notifications.updateMany({ where: { user_id: userId, is_read: false }, data: { is_read: true, read_date: new Date() } });
    return { updated: r.count };
  }
}
