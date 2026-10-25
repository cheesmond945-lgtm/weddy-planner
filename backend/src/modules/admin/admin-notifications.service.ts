import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { fail, UUID } from './admin-common';

const QUAL_OUT: Record<string, string> = { Pending: 'UNRATED', Qualified: 'QUALIFIED', NotQualified: 'UNQUALIFIED' };

/** Thông báo của chính tài khoản Admin đang đăng nhập (bảng notifications): yêu cầu tư vấn mới, hồ sơ và gói chờ duyệt. */
@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, limitInput?: string | number) {
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(limitInput)) || 20));
    const [rows, unread] = await Promise.all([
      this.prisma.notifications.findMany({ where: { user_id: userId }, orderBy: [{ created_date: 'desc' }, { id: 'asc' }], take: limit }),
      this.prisma.notifications.count({ where: { user_id: userId, is_read: false } }),
    ]);
    // Trạng thái hiện tại của yêu cầu tư vấn mà thông báo trỏ tới, để bấm vào thì chuyển đúng bộ lọc
    const ids = rows.filter((n) => n.reference_type === 'ConsultationRequest' && n.reference_id).map((n) => n.reference_id!);
    const consults = ids.length ? await this.prisma.consultation_requests.findMany({ where: { id: { in: ids } }, select: { id: true, is_contacted: true, qualification: true, service_categories: { select: { name: true } } } }) : [];
    const stateOf = new Map(consults.map((c) => [c.id, { isContacted: c.is_contacted, qualification: QUAL_OUT[c.qualification] ?? 'UNRATED', categorySlug: categorySlug(c.service_categories.name) }]));
    return {
      unread,
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        isRead: n.is_read,
        createdAt: n.created_date.toISOString(),
        refType: n.reference_type,
        refId: n.reference_id,
        consultation: n.reference_id ? (stateOf.get(n.reference_id) ?? null) : null,
      })),
    };
  }

  /** Đánh dấu một thông báo của chính Admin này là đã đọc (không đụng thông báo của người khác). */
  async markRead(userId: string, id: string) {
    if (!UUID.test(id)) return fail('NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.', 404);
    const { count } = await this.prisma.notifications.updateMany({ where: { id, user_id: userId, is_read: false }, data: { is_read: true, read_date: new Date() } });
    if (!count && !(await this.prisma.notifications.findFirst({ where: { id, user_id: userId }, select: { id: true } }))) {
      return fail('NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.', 404);
    }
    return null;
  }

  async markAllRead(userId: string) {
    await this.prisma.notifications.updateMany({ where: { user_id: userId, is_read: false }, data: { is_read: true, read_date: new Date() } });
    return null;
  }
}
