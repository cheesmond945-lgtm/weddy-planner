import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dbFeatures, requireDbFeature } from '../../prisma/db-features';
import { ymd } from '../orders/order-mapping';
import { roleDto, type MemberRole, type PlanTab, type WeddingAccess } from '../wedding-members/wedding-access';
import { WeddingMembersService } from '../wedding-members/wedding-members.service';
import { BudgetService } from '../weddings/budget.service';
import { GuestsService } from '../weddings/guests.service';
import { OverviewService } from '../weddings/overview.service';
import { TimelineService } from '../weddings/timeline.service';
import { WeddingsService } from '../weddings/weddings.service';
import {
  DEFAULT_SHARE_TABS,
  INVITE_TTL_DAYS,
  MAX_PENDING_INVITES,
  acceptDecision,
  hashToken,
  inviteDefaults,
  inviteStatus,
  isTokenShape,
  linkToken,
  normalizeTabs,
  type InviteRelation,
} from './sharing-rules';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;
const RELATION_DB: Record<string, InviteRelation> = { BRIDE: 'Bride', GROOM: 'Groom', RELATIVE: 'Relative' };
const RELATION_DTO = { Bride: 'BRIDE', Groom: 'GROOM', Relative: 'RELATIVE' } as const;

/** Khóa bí mật sinh mã link (SHARE_TOKEN_SECRET, không có thì dùng JWT_SECRET). */
function secret() {
  const s = process.env.SHARE_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!s) throw new HttpException({ code: 'CONFIG_ERROR', message: 'Thiếu SHARE_TOKEN_SECRET hoặc JWT_SECRET.' }, 500);
  return s;
}

/**
 * Chia sẻ kế hoạch (P7, docs/api/sharing.md): link mời cùng lập kế hoạch và link xem công khai chỉ đọc.
 * Mã link = HMAC(khóa bí mật, id dòng); DB chỉ lưu SHA-256 của mã.
 */
@Injectable()
export class WeddingSharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: WeddingMembersService,
    private readonly weddings: WeddingsService,
    private readonly overview: OverviewService,
    private readonly timeline: TimelineService,
    private readonly budget: BudgetService,
    private readonly guests: GuestsService,
  ) {}

  // ---------- Lời mời (owner) ----------

  private inviteDto(i: { id: string; relation: string; display_name: string | null; role: string; tabs: string[]; expires_date: Date; created_date: Date }) {
    const token = linkToken(secret(), 'invite', i.id);
    return {
      id: i.id,
      token,
      path: `/moi/${token}`,
      relation: RELATION_DTO[i.relation as InviteRelation],
      displayName: i.display_name,
      role: i.role === 'Editor' ? ('EDITOR' as const) : ('VIEWER' as const),
      tabs: i.tabs as PlanTab[],
      expiresDate: i.expires_date.toISOString(),
      createdDate: i.created_date.toISOString(),
    };
  }

  /** Link mời đang chờ (chưa dùng, chưa thu hồi, chưa hết hạn), mới nhất trước. */
  async listInvites(access: WeddingAccess) {
    requireDbFeature('sharing');
    const rows = await this.prisma.wedding_invites.findMany({
      where: { wedding_id: access.weddingId, used_date: null, revoked_date: null, expires_date: { gt: new Date() } },
      orderBy: { created_date: 'desc' },
    });
    return rows.map((r) => this.inviteDto(r));
  }

  async createInvite(access: WeddingAccess, userId: string, body: { relation?: unknown; displayName?: unknown; role?: unknown; tabs?: unknown }) {
    requireDbFeature('sharing');
    const errors: Record<string, string> = {};
    const relation = RELATION_DB[String(body.relation)];
    if (!relation) errors.relation = 'Chọn quan hệ: Cô dâu, Chú rể hoặc Người thân.';
    const defaults = inviteDefaults(relation ?? 'Relative');
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim().replace(/\s+/g, ' ') : '';
    if (displayName.length > 40) errors.displayName = 'Tên hiển thị tối đa 40 ký tự.';
    let role = defaults.role;
    if (body.role !== undefined) {
      if (body.role === 'EDITOR') role = 'Editor';
      else if (body.role === 'VIEWER') role = 'Viewer';
      else errors.role = 'Quyền phải là EDITOR hoặc VIEWER.';
    }
    let tabs = defaults.tabs;
    if (body.tabs !== undefined) {
      const t = normalizeTabs(body.tabs);
      if (!t) errors.tabs = 'Chọn ít nhất 1 phần được xem.';
      else tabs = t;
    }
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin lời mời chưa hợp lệ.', 400, errors);

    const pending = await this.prisma.wedding_invites.count({ where: { wedding_id: access.weddingId, used_date: null, revoked_date: null, expires_date: { gt: new Date() } } });
    if (pending >= MAX_PENDING_INVITES) return fail('INVITE_LIMIT', `Đã có ${MAX_PENDING_INVITES} link mời đang chờ. Thu hồi bớt link cũ rồi tạo link mới.`, 409);

    // Mã phụ thuộc id nên tạo dòng trước với giá trị tạm, rồi ghi SHA-256 của mã thật trong cùng giao dịch
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.wedding_invites.create({
        data: {
          wedding_id: access.weddingId,
          token_hash: hashToken(`pending:${crypto.randomUUID()}`),
          role,
          relation: relation!,
          display_name: displayName || null,
          tabs,
          created_by: userId,
          expires_date: new Date(Date.now() + INVITE_TTL_DAYS * DAY),
        },
      });
      return tx.wedding_invites.update({ where: { id: r.id }, data: { token_hash: hashToken(linkToken(secret(), 'invite', r.id)) } });
    });
    return this.inviteDto(row);
  }

  async revokeInvite(access: WeddingAccess, id: string) {
    requireDbFeature('sharing');
    const inv = UUID.test(id) ? await this.prisma.wedding_invites.findFirst({ where: { id, wedding_id: access.weddingId } }) : null;
    if (!inv) return fail('INVITE_NOT_FOUND', 'Không tìm thấy link mời.', 404);
    if (!inv.revoked_date && !inv.used_date) await this.prisma.wedding_invites.update({ where: { id }, data: { revoked_date: new Date() } });
    return null;
  }

  // ---------- Lời mời (người nhận) ----------

  private async inviteByToken(token: string) {
    requireDbFeature('sharing');
    const inv = isTokenShape(token)
      ? await this.prisma.wedding_invites.findUnique({
          where: { token_hash: hashToken(token) },
          include: { weddings: { select: { groom_name: true, bride_name: true, wedding_date: true } }, creator: { select: { full_name: true } } },
        })
      : null;
    return inv ?? fail('INVITE_NOT_FOUND', 'Link mời không tồn tại.', 404);
  }

  /** Xem lời mời trước khi nhận (không cần đăng nhập). */
  async getInvite(token: string) {
    const inv = await this.inviteByToken(token);
    return {
      status: inviteStatus(inv),
      wedding: { groomName: inv.weddings.groom_name, brideName: inv.weddings.bride_name, date: ymd(inv.weddings.wedding_date) },
      inviterName: inv.creator.full_name,
      relation: RELATION_DTO[inv.relation as InviteRelation],
      displayName: inv.display_name,
      role: inv.role === 'Editor' ? 'EDITOR' : 'VIEWER',
      tabs: inv.tabs,
      expiresDate: inv.expires_date.toISOString(),
    };
  }

  /** Nhận lời mời (tài khoản cặp đôi). Đang có kế hoạch riêng thì xử lý theo acceptDecision (Q5). */
  async acceptInvite(token: string, userId: string, body: { leaveOwnPlan?: unknown }) {
    const inv = await this.inviteByToken(token);
    const status = inviteStatus(inv);
    const current = await this.members.resolve(userId);
    if (current?.weddingId === inv.wedding_id) return { weddingId: inv.wedding_id, joined: false };
    if (status === 'EXPIRED') return fail('INVITE_EXPIRED', 'Link mời đã hết hạn. Hãy xin link mới.', 410);
    if (status === 'USED') return fail('INVITE_USED', 'Link mời đã được dùng.', 410);
    if (status === 'REVOKED') return fail('INVITE_REVOKED', 'Link mời đã bị thu hồi.', 410);

    const info = current
      ? await Promise.all([
          this.prisma.conversations.count({ where: { couple_id: userId } }),
          this.prisma.orders.count({ where: { wedding_id: current.weddingId } }),
          this.prisma.wedding_members.count({ where: { wedding_id: current.weddingId, user_id: { not: userId } } }),
        ])
      : [0, 0, 0];
    const decision = acceptDecision(
      current ? { role: current.role, sameWedding: false, conversations: info[0], orders: info[1], otherMembers: info[2] } : null,
      body.leaveOwnPlan === true,
    );
    if (decision === 'LEAVE_OTHER_FIRST') return fail('ALREADY_MEMBER', 'Bạn đang tham gia một kế hoạch khác. Hãy rời kế hoạch đó trước.', 409);
    if (decision === 'OWN_PLAN_IN_USE') {
      return fail('ALREADY_IN_WEDDING', 'Kế hoạch riêng của bạn đã có tin nhắn, đơn dịch vụ hoặc người cùng lập nên không bỏ được để tham gia.', 409);
    }
    if (decision === 'CONFIRM_LEAVE_OWN_PLAN') {
      return fail('OWN_PLAN_EXISTS', 'Bạn đang có kế hoạch riêng. Bỏ kế hoạch riêng để tham gia?', 409, { canLeave: true });
    }

    await this.prisma.$transaction(async (tx) => {
      if (decision === 'DELETE_OWN_PLAN_THEN_JOIN') {
        const id = current!.weddingId;
        await tx.timeline_tasks.deleteMany({ where: { wedding_id: id } });
        await tx.plan_vendors.deleteMany({ where: { wedding_id: id } });
        await tx.wedding_categories.deleteMany({ where: { wedding_id: id } });
        if (dbFeatures.guests) await tx.wedding_guests.deleteMany({ where: { wedding_id: id } });
        if (dbFeatures.budgetTiers) {
          await tx.wedding_category_budgets.deleteMany({ where: { wedding_id: id } });
          await tx.wedding_extra_costs.deleteMany({ where: { wedding_id: id } });
        }
        await tx.wedding_invites.deleteMany({ where: { wedding_id: id } });
        await tx.wedding_share_links.deleteMany({ where: { wedding_id: id } });
        await tx.wedding_members.deleteMany({ where: { wedding_id: id } });
        await tx.weddings.delete({ where: { id } });
      }
      // Đánh dấu đã dùng có điều kiện: hai người nhận cùng lúc thì chỉ một người thành công
      const used = await tx.wedding_invites.updateMany({ where: { id: inv.id, used_date: null, revoked_date: null }, data: { used_by: userId, used_date: new Date() } });
      if (!used.count) fail('INVITE_USED', 'Link mời đã được dùng.', 410);
      await tx.wedding_members.create({
        data: { wedding_id: inv.wedding_id, user_id: userId, role: inv.role, relation: inv.relation, display_name: inv.display_name, tabs: inv.tabs },
      });
    });
    return { weddingId: inv.wedding_id, joined: true };
  }

  // ---------- Link xem công khai (owner) ----------

  private shareDto(link: { id: string; is_enabled: boolean; tabs: string[]; updated_date: Date } | null) {
    if (!link) return { enabled: false, tabs: DEFAULT_SHARE_TABS, token: null, path: null, updatedDate: null };
    const token = linkToken(secret(), 'share', link.id);
    return { enabled: link.is_enabled, tabs: link.tabs as PlanTab[], token, path: `/xem/${token}`, updatedDate: link.updated_date.toISOString() };
  }

  async getShareLink(access: WeddingAccess) {
    requireDbFeature('sharing');
    return this.shareDto(await this.prisma.wedding_share_links.findUnique({ where: { wedding_id: access.weddingId } }));
  }

  private async createLink(weddingId: string, data: { is_enabled: boolean; tabs: PlanTab[] }) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.wedding_share_links.create({ data: { wedding_id: weddingId, token_hash: hashToken(`pending:${crypto.randomUUID()}`), ...data } });
      return tx.wedding_share_links.update({ where: { id: r.id }, data: { token_hash: hashToken(linkToken(secret(), 'share', r.id)) } });
    });
  }

  /** Bật/tắt và chọn tab. Chưa có link thì tạo. */
  async putShareLink(access: WeddingAccess, body: { enabled?: unknown; tabs?: unknown }) {
    requireDbFeature('sharing');
    const errors: Record<string, string> = {};
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') errors.enabled = 'Giá trị bật/tắt không hợp lệ.';
    const tabs = body.tabs === undefined ? undefined : normalizeTabs(body.tabs);
    if (tabs === null) errors.tabs = 'Chọn ít nhất 1 phần được xem.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin link chia sẻ chưa hợp lệ.', 400, errors);
    const current = await this.prisma.wedding_share_links.findUnique({ where: { wedding_id: access.weddingId } });
    if (!current) {
      return this.shareDto(await this.createLink(access.weddingId, { is_enabled: (body.enabled as boolean | undefined) ?? true, tabs: tabs ?? DEFAULT_SHARE_TABS }));
    }
    const link = await this.prisma.wedding_share_links.update({
      where: { id: current.id },
      data: { ...(body.enabled !== undefined && { is_enabled: body.enabled as boolean }), ...(tabs && { tabs }), updated_date: new Date() },
    });
    return this.shareDto(link);
  }

  /** Tạo link mới, link cũ hết hiệu lực ngay (giữ trạng thái bật/tắt và tab). */
  async regenerateShareLink(access: WeddingAccess) {
    requireDbFeature('sharing');
    const current = await this.prisma.wedding_share_links.findUnique({ where: { wedding_id: access.weddingId } });
    if (current) await this.prisma.wedding_share_links.delete({ where: { id: current.id } });
    return this.shareDto(await this.createLink(access.weddingId, { is_enabled: current?.is_enabled ?? true, tabs: (current?.tabs as PlanTab[]) ?? DEFAULT_SHARE_TABS }));
  }

  // ---------- Xem công khai (không cần đăng nhập) ----------

  /** Link đang bật, kèm owner và các tab được xem. Không có, tắt hoặc đã tạo lại: 404. */
  private async publicLink(token: string) {
    requireDbFeature('sharing');
    const link = isTokenShape(token)
      ? await this.prisma.wedding_share_links.findUnique({ where: { token_hash: hashToken(token) }, include: { weddings: true } })
      : null;
    if (!link || !link.is_enabled) return fail('SHARE_LINK_NOT_FOUND', 'Link xem kế hoạch không tồn tại hoặc đã tắt.', 404);
    return { link, ownerId: link.weddings.user_id, tabs: link.tabs as PlanTab[] };
  }

  async publicPlan(token: string) {
    const { link, tabs } = await this.publicLink(token);
    const w = link.weddings;
    const members = await this.prisma.wedding_members.findMany({
      where: { wedding_id: w.id },
      orderBy: { joined_date: 'asc' },
      include: { users: { select: { full_name: true } } },
    });
    return {
      wedding: { groomName: w.groom_name, brideName: w.bride_name, date: ymd(w.wedding_date) },
      tabs,
      // Thành viên chỉ hiện tên (không email)
      members: members.sort((a, b) => Number(b.role === 'Owner') - Number(a.role === 'Owner')).map((m) => ({ name: m.display_name || m.users.full_name, role: roleDto(m.role as MemberRole) })),
    };
  }

  /** Số liệu một tab, đã lọc ở backend: tab bị tắt thì 404; không có ghi chú, đơn hàng, email. */
  async publicTab(token: string, tab: string) {
    const { ownerId, tabs } = await this.publicLink(token);
    if (!tabs.includes(tab as PlanTab)) return fail('SHARE_TAB_NOT_FOUND', 'Phần này không được chia sẻ.', 404);
    const access: WeddingAccess = { weddingId: '', ownerId, role: 'Viewer', tabs };
    if (tab === 'overview') {
      const w = await this.weddings.requireWedding(ownerId);
      return this.overview.get(ownerId, { ...access, weddingId: w.id });
    }
    if (tab === 'timeline') {
      const { items } = await this.timeline.get(ownerId);
      return { items: items.map(({ note: _note, ...i }) => ({ ...i, note: null })) };
    }
    if (tab === 'services') {
      const plan = await this.weddings.planItems(ownerId);
      // Giá chỉ hiện khi tab Ngân sách cũng được chia sẻ
      const showPrice = tabs.includes('budget');
      return {
        categorySlugs: plan.categorySlugs,
        items: plan.items.map((i) => ({ id: i.id, service: i.service, status: i.status, packageName: i.packageName, price: showPrice ? i.price : null })),
      };
    }
    if (tab === 'budget') {
      const { version: _v, ...b } = await this.budget.summary(ownerId);
      return b;
    }
    if (tab === 'guests') return this.guests.list(ownerId);
    return fail('SHARE_TAB_NOT_FOUND', 'Phần này không được chia sẻ.', 404);
  }
}
