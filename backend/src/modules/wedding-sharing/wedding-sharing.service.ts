import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireDbFeature } from '../../prisma/db-features';
import { ymd } from '../orders/order-mapping';
import { BudgetService } from '../weddings/budget.service';
import { OverviewService } from '../weddings/overview.service';
import { TimelineService } from '../weddings/timeline.service';
import { WeddingsService } from '../weddings/weddings.service';
import type { PlanTab } from './plan-tabs';
import { DEFAULT_SHARE_TABS, hashToken, isTokenShape, linkToken, normalizeTabs } from './sharing-rules';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

/** Khóa bí mật sinh mã link (SHARE_TOKEN_SECRET, không có thì dùng JWT_SECRET). */
function secret() {
  const s = process.env.SHARE_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!s) throw new HttpException({ code: 'CONFIG_ERROR', message: 'Thiếu SHARE_TOKEN_SECRET hoặc JWT_SECRET.' }, 500);
  return s;
}

/**
 * Chia sẻ kế hoạch (P7, docs/api/sharing.md): link xem công khai chỉ đọc, người xem không cần đăng nhập.
 * Mã link = HMAC(khóa bí mật, id dòng); DB chỉ lưu SHA-256 của mã.
 */
@Injectable()
export class WeddingSharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weddings: WeddingsService,
    private readonly overview: OverviewService,
    private readonly timeline: TimelineService,
    private readonly budget: BudgetService,
  ) {}

  // ---------- Quản lý link (cặp đôi) ----------

  private shareDto(link: { id: string; is_enabled: boolean; tabs: string[]; updated_date: Date } | null) {
    if (!link) return { enabled: false, tabs: DEFAULT_SHARE_TABS, token: null, path: null, updatedDate: null };
    const token = linkToken(secret(), link.id);
    return { enabled: link.is_enabled, tabs: link.tabs as PlanTab[], token, path: `/xem/${token}`, updatedDate: link.updated_date.toISOString() };
  }

  async getShareLink(userId: string) {
    requireDbFeature('sharing');
    const w = await this.weddings.requireWedding(userId);
    return this.shareDto(await this.prisma.wedding_share_links.findUnique({ where: { wedding_id: w.id } }));
  }

  private async createLink(weddingId: string, data: { is_enabled: boolean; tabs: PlanTab[] }) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.wedding_share_links.create({ data: { wedding_id: weddingId, token_hash: hashToken(`pending:${crypto.randomUUID()}`), ...data } });
      return tx.wedding_share_links.update({ where: { id: r.id }, data: { token_hash: hashToken(linkToken(secret(), r.id)) } });
    });
  }

  /** Bật/tắt và chọn tab. Chưa có link thì tạo. */
  async putShareLink(userId: string, body: { enabled?: unknown; tabs?: unknown }) {
    requireDbFeature('sharing');
    const w = await this.weddings.requireWedding(userId);
    const errors: Record<string, string> = {};
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') errors.enabled = 'Giá trị bật/tắt không hợp lệ.';
    const tabs = body.tabs === undefined ? undefined : normalizeTabs(body.tabs);
    if (tabs === null) errors.tabs = 'Chọn ít nhất 1 phần được xem.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin link chia sẻ chưa hợp lệ.', 400, errors);
    const current = await this.prisma.wedding_share_links.findUnique({ where: { wedding_id: w.id } });
    if (!current) {
      return this.shareDto(await this.createLink(w.id, { is_enabled: (body.enabled as boolean | undefined) ?? true, tabs: tabs ?? DEFAULT_SHARE_TABS }));
    }
    const link = await this.prisma.wedding_share_links.update({
      where: { id: current.id },
      data: { ...(body.enabled !== undefined && { is_enabled: body.enabled as boolean }), ...(tabs && { tabs }), updated_date: new Date() },
    });
    return this.shareDto(link);
  }

  /** Tạo link mới, link cũ hết hiệu lực ngay (giữ trạng thái bật/tắt và tab). */
  async regenerateShareLink(userId: string) {
    requireDbFeature('sharing');
    const w = await this.weddings.requireWedding(userId);
    const current = await this.prisma.wedding_share_links.findUnique({ where: { wedding_id: w.id } });
    if (current) await this.prisma.wedding_share_links.delete({ where: { id: current.id } });
    return this.shareDto(await this.createLink(w.id, { is_enabled: current?.is_enabled ?? true, tabs: (current?.tabs as PlanTab[]) ?? DEFAULT_SHARE_TABS }));
  }

  // ---------- Xem công khai (không cần đăng nhập) ----------

  /** Link đang bật, kèm tài khoản cặp đôi và các tab được xem. Không có, tắt hoặc đã tạo lại: 404. */
  private async publicLink(token: string) {
    requireDbFeature('sharing');
    const link = isTokenShape(token)
      ? await this.prisma.wedding_share_links.findUnique({ where: { token_hash: hashToken(token) }, include: { weddings: true } })
      : null;
    // Cột weddings.user_id cho phép null trong DB: đám cưới không có chủ coi như không có link
    if (!link || !link.is_enabled || !link.weddings.user_id) return fail('SHARE_LINK_NOT_FOUND', 'Link xem kế hoạch không tồn tại hoặc đã tắt.', 404);
    return { link, ownerId: link.weddings.user_id, tabs: link.tabs as PlanTab[] };
  }

  async publicPlan(token: string) {
    const { link, tabs } = await this.publicLink(token);
    const w = link.weddings;
    return { wedding: { groomName: w.groom_name, brideName: w.bride_name, date: ymd(w.wedding_date) }, tabs };
  }

  /** Số liệu một tab, đã lọc ở backend: tab bị tắt thì 404; không có ghi chú, đơn hàng, email. */
  async publicTab(token: string, tab: string) {
    const { ownerId, tabs } = await this.publicLink(token);
    if (!tabs.includes(tab as PlanTab)) return fail('SHARE_TAB_NOT_FOUND', 'Phần này không được chia sẻ.', 404);
    if (tab === 'overview') return this.overview.get(ownerId, tabs);
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
    return fail('SHARE_TAB_NOT_FOUND', 'Phần này không được chia sẻ.', 404);
  }
}
