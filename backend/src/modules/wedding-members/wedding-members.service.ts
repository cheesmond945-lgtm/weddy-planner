import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dbFeatures } from '../../prisma/db-features';
import { isPlanTab, roleDto, tabsOf, type MemberRole, type PlanTab, type WeddingAccess } from './wedding-access';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RELATION_DTO: Record<string, 'BRIDE' | 'GROOM' | 'RELATIVE'> = { Bride: 'BRIDE', Groom: 'GROOM', Relative: 'RELATIVE' };

/**
 * Thành viên của đám cưới (wedding_members) và quyền của người gọi. Mỗi tài khoản thuộc tối đa một đám cưới.
 * docs/api/weddings.md mục Thành viên.
 */
@Injectable()
export class WeddingMembersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Đám cưới người này đang tham gia và quyền của họ; null nếu chưa có. */
  async resolve(userId: string): Promise<WeddingAccess | null> {
    const m = await this.prisma.wedding_members.findUnique({ where: { user_id: userId }, select: { wedding_id: true, role: true, tabs: true, weddings: { select: { user_id: true } } } });
    if (m) {
      const role = m.role as MemberRole;
      return { weddingId: m.wedding_id, ownerId: m.weddings.user_id, role, tabs: tabsOf(role, m.tabs) };
    }
    // Đám cưới tạo bởi backend bản cũ (chưa ghi wedding_members): tự thêm owner
    const w = await this.prisma.weddings.findUnique({ where: { user_id: userId }, select: { id: true } });
    if (!w) return null;
    await this.prisma.wedding_members.createMany({ data: [{ wedding_id: w.id, user_id: userId, role: 'Owner' }], skipDuplicates: true });
    return { weddingId: w.id, ownerId: userId, role: 'Owner', tabs: tabsOf('Owner', null) };
  }

  /** Danh sách thành viên, owner đứng đầu rồi theo ngày tham gia. */
  async list(access: WeddingAccess, meId: string) {
    const rows = await this.prisma.wedding_members.findMany({
      where: { wedding_id: access.weddingId },
      orderBy: { joined_date: 'asc' },
      include: { users: { select: { full_name: true, email: true } } },
    });
    return rows
      .sort((a, b) => Number(b.role === 'Owner') - Number(a.role === 'Owner'))
      .map((m) => {
        const role = m.role as MemberRole;
        return {
          userId: m.user_id,
          fullName: m.users.full_name,
          email: m.users.email,
          displayName: m.display_name,
          role: roleDto(role),
          relation: m.relation ? RELATION_DTO[m.relation] : null,
          tabs: tabsOf(role, m.tabs),
          joinedDate: m.joined_date.toISOString(),
          isMe: m.user_id === meId,
        };
      });
  }

  private async member(access: WeddingAccess, userId: string) {
    const m = UUID.test(userId) ? await this.prisma.wedding_members.findFirst({ where: { wedding_id: access.weddingId, user_id: userId } }) : null;
    return m ?? fail('MEMBER_NOT_FOUND', 'Không tìm thấy thành viên.', 404);
  }

  /** Owner đổi quyền hoặc các subtab được xem của một thành viên. */
  async update(access: WeddingAccess, meId: string, userId: string, body: { role?: unknown; tabs?: unknown }) {
    const m = await this.member(access, userId);
    if (m.role === 'Owner') return fail('MEMBER_IS_OWNER', 'Không đổi được quyền của chủ kế hoạch.', 409);
    const errors: Record<string, string> = {};
    const data: { role?: MemberRole; tabs?: PlanTab[] } = {};
    if (body.role !== undefined) {
      if (body.role === 'EDITOR') data.role = 'Editor';
      else if (body.role === 'VIEWER') data.role = 'Viewer';
      else errors.role = 'Quyền phải là EDITOR hoặc VIEWER.';
    }
    if (body.tabs !== undefined) {
      const tabs = Array.isArray(body.tabs) ? [...new Set(body.tabs)] : null;
      if (!tabs || !tabs.every(isPlanTab)) errors.tabs = 'Phần được xem không hợp lệ.';
      else if (!tabs.length) errors.tabs = 'Chọn ít nhất 1 phần được xem.';
      else data.tabs = tabs;
    }
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin thành viên chưa hợp lệ.', 400, errors);
    if (Object.keys(data).length) await this.prisma.wedding_members.update({ where: { id: m.id }, data });
    return this.list(access, meId);
  }

  /** Owner xóa người khác, hoặc thành viên tự rời kế hoạch. Owner không rời được. */
  async remove(access: WeddingAccess, meId: string, userId: string) {
    const m = await this.member(access, userId);
    if (m.role === 'Owner') return fail('MEMBER_IS_OWNER', 'Chủ kế hoạch không rời được kế hoạch.', 409);
    if (userId !== meId && access.role !== 'Owner') return fail('WEDDING_FORBIDDEN', 'Chỉ chủ kế hoạch mới xóa được người khác.', 403);
    // Xóa thành viên thì bỏ luôn các việc đang giao cho người đó
    await this.prisma.$transaction([
      ...(dbFeatures.timelineAssign
        ? [this.prisma.timeline_tasks.updateMany({ where: { wedding_id: access.weddingId, assignee_user_id: userId }, data: { assignee: null, assignee_user_id: null } })]
        : []),
      this.prisma.wedding_members.delete({ where: { id: m.id } }),
    ]);
    return null;
  }
}
