import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thông báo của chính tài khoản đang đăng nhập (bảng notifications), dùng chung cho NCC và cặp đôi. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, limitInput?: string | number) {
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(limitInput)) || 20));
    const [rows, unread] = await Promise.all([
      this.prisma.notifications.findMany({ where: { user_id: userId }, orderBy: [{ created_date: 'desc' }, { id: 'asc' }], take: limit }),
      this.prisma.notifications.count({ where: { user_id: userId, is_read: false } }),
    ]);
    return {
      unread,
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        isRead: n.is_read,
        createdAt: n.created_date!.toISOString(),
        refType: n.reference_type,
        refId: n.reference_id,
      })),
    };
  }

  async markRead(userId: string, id: string) {
    const notFound = () => new HttpException({ code: 'NOTIFICATION_NOT_FOUND', message: 'Không tìm thấy thông báo.' }, 404);
    if (!UUID.test(id)) throw notFound();
    const { count } = await this.prisma.notifications.updateMany({ where: { id, user_id: userId, is_read: false }, data: { is_read: true, read_date: new Date() } });
    if (!count && !(await this.prisma.notifications.findFirst({ where: { id, user_id: userId }, select: { id: true } }))) throw notFound();
    return null;
  }

  async markAllRead(userId: string) {
    await this.prisma.notifications.updateMany({ where: { user_id: userId, is_read: false }, data: { is_read: true, read_date: new Date() } });
    return null;
  }
}
