import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from '../catalog/services.service';
import { WeddingsService } from '../weddings/weddings.service';
import { publish } from '../realtime/realtime.bus';
import { markNewMessageRead, notifyNewMessage, postMessage } from './chat-messages';
import { ChatRole, isUuid, todayVn, toLastMessage, toMessage } from './chat.mappers';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const MAX_TEXT = 2000;

export interface ChatUser {
  sub: string;
  role: ChatRole;
}

const lastMessageInclude = { messages: { orderBy: [{ sent_date: 'desc' as const }, { id: 'desc' as const }], take: 1, include: { orders: { select: { order_code: true, status: true } } } } };

/**
 * Hội thoại và tin nhắn cho cả cặp đôi và NCC (docs/api/chat.md). Mọi thao tác nhận ChatUser lấy từ JWT:
 * cặp đôi chỉ thấy hội thoại của mình (couple_id), NCC chỉ thấy hội thoại của mình (vendor_id).
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly weddings: WeddingsService,
  ) {}

  private async owned(user: ChatUser, id: string) {
    const where = user.role === 'Couple' ? { id, couple_id: user.sub } : { id, vendor_id: user.sub };
    const conv = isUuid(id) ? await this.prisma.conversations.findFirst({ where }) : null;
    return conv ?? fail('CONVERSATION_NOT_FOUND', 'Không tìm thấy hội thoại.', 404);
  }

  /** Số tin của bên kia mà người xem chưa đọc, theo từng hội thoại. */
  private async unreadByConversation(convs: { id: string; couple_id: string | null; vendor_id: string | null }[], role: ChatRole) {
    const counterparts = convs.flatMap((c) => { const id = role === 'Couple' ? c.vendor_id : c.couple_id; return id ? [id] : []; });
    const rows = await this.prisma.messages.groupBy({
      by: ['conversation_id'],
      where: { conversation_id: { in: convs.map((c) => c.id) }, sender_id: { in: counterparts }, is_read: false },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.conversation_id, r._count._all]));
  }

  list(user: ChatUser) {
    return user.role === 'Couple' ? this.coupleConversations(user.sub) : this.vendorConversations(user.sub);
  }

  async messages(user: ChatUser, id: string, after?: string) {
    const conv = await this.owned(user, id);
    const afterDate = after ? new Date(after) : null;
    const rows = await this.prisma.messages.findMany({
      where: { conversation_id: id, ...(afterDate && !Number.isNaN(afterDate.getTime()) ? { sent_date: { gt: afterDate } } : {}) },
      orderBy: [{ sent_date: 'asc' }, { id: 'asc' }],
      include: { orders: { select: { order_code: true, status: true } } },
    });
    return rows.map((m) => toMessage(m, conv.couple_id));
  }

  async send(user: ChatUser, id: string, text: string) {
    const conv = await this.owned(user, id);
    const content = (text ?? '').trim();
    if (!content) return fail('VALIDATION_ERROR', 'Nhập nội dung tin nhắn.', 400);
    if (content.length > MAX_TEXT) return fail('VALIDATION_ERROR', `Tin nhắn tối đa ${MAX_TEXT} ký tự.`, 400);
    const m = await postMessage(this.prisma, { conversationId: id, senderId: user.sub, content });
    const toCouple = user.role === 'Vendor';
    await notifyNewMessage(this.prisma, { userId: (toCouple ? conv.couple_id : conv.vendor_id)!, conversationId: id, from: await this.displayName(user), content });
    return toMessage(m, conv.couple_id);
  }

  /** Tổng số tin của bên kia mà người xem chưa đọc, ở mọi hội thoại (huy hiệu menu Tin nhắn). Bỏ qua tin hệ thống và tin của chính mình. */
  async unreadCount(user: ChatUser) {
    const mine = user.role === 'Couple' ? { couple_id: user.sub } : { vendor_id: user.sub };
    const count = await this.prisma.messages.count({ where: { is_read: false, sender_id: { not: user.sub }, conversations: mine } });
    return { count };
  }

  /** Người xem mở hội thoại: các tin của bên kia thành đã đọc, thông báo NewMessage của hội thoại cũng đã đọc. */
  async markRead(user: ChatUser, id: string) {
    const conv = await this.owned(user, id);
    const counterpart = user.role === 'Couple' ? conv.vendor_id : conv.couple_id;
    const r = await this.prisma.messages.updateMany({ where: { conversation_id: id, sender_id: counterpart, is_read: false }, data: { is_read: true, read_date: new Date() } });
    await markNewMessageRead(this.prisma, user.sub, id);
    // Báo cả hai bên: các tab khác của người đọc giảm số chưa đọc, bên kia biết tin đã được xem
    if (r.count) publish({ users: [conv.couple_id!, conv.vendor_id!], event: 'read', data: { conversationId: id } });
    return null;
  }

  /** Tên hiện trong thông báo: cặp đôi là họ tên, NCC là tên doanh nghiệp. */
  private async displayName(user: ChatUser) {
    if (user.role === 'Vendor') {
      const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: user.sub }, select: { business_name: true } });
      return v?.business_name ?? 'nhà cung cấp';
    }
    const u = await this.prisma.users.findUnique({ where: { id: user.sub }, select: { full_name: true } });
    return u?.full_name ?? 'khách hàng';
  }

  // ================= Cặp đôi =================

  private async coupleConversations(userId: string, only?: string) {
    const convs = await this.prisma.conversations.findMany({
      where: { couple_id: userId, ...(only ? { id: only } : {}) },
      orderBy: [{ last_message_date: 'desc' }, { created_date: 'desc' }],
      include: lastMessageInclude,
    });
    const vendors = await this.prisma.vendor_profiles.findMany({ where: { user_id: { in: convs.flatMap((c) => (c.vendor_id ? [c.vendor_id] : [])) } }, select: { id: true, user_id: true } });
    const vendorByUser = new Map(vendors.map((v) => [v.user_id, v]));
    const [summaries, statuses, unread, orders] = await Promise.all([
      this.services.summaries(vendors.map((v) => v.id)),
      this.weddings.planStatusMap(userId, vendors),
      this.unreadByConversation(convs, 'Couple'),
      // Đơn đã gửi mới nhất với từng NCC (bỏ bản nháp), cho nhãn trạng thái đơn trong danh sách hội thoại
      this.prisma.orders.findMany({
        where: { vendor_id: { in: vendors.map((v) => v.id) }, status: { not: 'Draft' }, weddings: { user_id: userId } },
        orderBy: { created_date: 'desc' },
        select: { id: true, order_code: true, status: true, deposit_due_date: true, vendor_id: true },
      }),
    ]);
    const sumById = new Map(summaries.map((s) => [s.id, s]));
    const latestOrderByVendor = new Map<string, (typeof orders)[number]>();
    for (const o of orders) if (o.vendor_id && !latestOrderByVendor.has(o.vendor_id)) latestOrderByVendor.set(o.vendor_id, o);

    return convs.flatMap((c) => {
      const v = vendorByUser.get(c.vendor_id!);
      const service = v && sumById.get(v.id);
      if (!v || !service) return []; // NCC đã bị ẩn
      const last = c.messages[0];
      return [
        {
          id: c.id,
          service,
          planStatus: statuses.get(v.id) ?? null,
          unreadCount: unread.get(c.id) ?? 0,
          lastMessage: last ? toLastMessage(last, c.couple_id) : null,
          latestOrder: latestOrderByVendor.get(v.id) ? { id: latestOrderByVendor.get(v.id)!.id, orderCode: latestOrderByVendor.get(v.id)!.order_code, status: latestOrderByVendor.get(v.id)!.status, depositDueDate: latestOrderByVendor.get(v.id)!.deposit_due_date?.toISOString() ?? null } : null,
        },
      ];
    });
  }

  /**
   * POST /conversations: mở (hoặc tạo) hội thoại với NCC của một dịch vụ, tự thêm dịch vụ vào kế hoạch.
   * Hạng mục đã có NCC khác chờ cọc / đã chốt (PLAN_CATEGORY_LOCKED): vẫn mở hội thoại để khách tư vấn tự do,
   * chỉ KHÔNG thêm NCC này vào kế hoạch (hội thoại trả planStatus = null). Nếu khách cọc đơn của NCC này thì
   * NCC được thêm vào kế hoạch lúc cọc, hạng mục có hai NCC.
   */
  async startForCouple(userId: string, serviceId: string, replace: boolean) {
    await this.weddings.addPlanItem(userId, serviceId, replace, true).catch((e: unknown) => {
      if (e instanceof HttpException && (e.getResponse() as { code?: string }).code === 'PLAN_CATEGORY_LOCKED') return null;
      throw e;
    });
    const vendor = await this.prisma.vendor_profiles.findUniqueOrThrow({ where: { id: serviceId }, include: { service_categories: { select: { name: true } } } });
    let conv = await this.prisma.conversations.findUnique({ where: { couple_id_vendor_id: { couple_id: userId, vendor_id: vendor.user_id! } } });
    if (!conv) {
      conv = await this.prisma.conversations.create({ data: { couple_id: userId, vendor_id: vendor.user_id, category_id: vendor.category_id } });
      await postMessage(this.prisma, {
        conversationId: conv.id,
        senderId: vendor.user_id,
        content: `Chào bạn! Mình là ${vendor.business_name}. Bạn cần tư vấn gói nào cho ${(vendor.service_categories?.name ?? 'dịch vụ').toLowerCase()}?`,
        isRead: true,
      });
    }
    return (await this.coupleConversations(userId, conv.id))[0];
  }

  // ================= Nhà cung cấp =================

  private async vendorConversations(userId: string) {
    const vendor = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true } });
    if (!vendor) return fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
    const convs = await this.prisma.conversations.findMany({
      where: { vendor_id: userId },
      orderBy: [{ last_message_date: 'desc' }, { created_date: 'desc' }],
      include: lastMessageInclude,
    });
    const coupleIds = convs.flatMap((c) => (c.couple_id ? [c.couple_id] : []));
    const [couples, weddings, orders, unread] = await Promise.all([
      this.prisma.users.findMany({ where: { id: { in: coupleIds } }, select: { id: true, full_name: true, phone_number: true } }),
      this.prisma.weddings.findMany({ where: { user_id: { in: coupleIds } }, select: { user_id: true, groom_name: true, bride_name: true, wedding_date: true } }),
      this.prisma.orders.findMany({
        where: { vendor_id: vendor.id, weddings: { user_id: { in: coupleIds } } },
        select: { id: true, order_code: true, status: true, event_date: true, weddings: { select: { user_id: true } }, order_revisions: { where: { status: 'Requested' }, select: { id: true } } },
        orderBy: { created_date: 'desc' },
      }),
      this.unreadByConversation(convs, 'Vendor'),
    ]);
    const coupleById = new Map(couples.map((u) => [u.id, u]));
    const weddingByUser = new Map(weddings.map((w) => [w.user_id, w]));
    const today = todayVn();

    return convs.map((c) => {
      const u = coupleById.get(c.couple_id!);
      const w = weddingByUser.get(c.couple_id!);
      const mine = orders.filter((o) => o.weddings!.user_id! === c.couple_id);
      const latestSent = mine.find((o) => o.status !== 'Draft');
      const last = c.messages[0];
      return {
        id: c.id,
        customer: { name: w && w.bride_name && !w.bride_name.startsWith('(') ? `${w.groom_name} & ${w.bride_name}` : (w?.groom_name ?? u?.full_name ?? ''), phone: u?.phone_number ?? '', weddingDate: w?.wedding_date ? w.wedding_date.toISOString().slice(0, 10) : null },
        unreadCount: unread.get(c.id) ?? 0,
        lastMessage: last ? toLastMessage(last, c.couple_id) : null,
        latestOrder: latestSent ? { id: latestSent.id, orderCode: latestSent.order_code, status: latestSent.status } : null,
        hasDraftOrder: mine.some((o) => o.status === 'Draft'),
        // Cần NCC xử lý: có đơn nháp, đơn cần chỉnh sửa, đơn đã cọc có yêu cầu chỉnh sửa của khách, hoặc đơn đã cọc đã qua ngày thực hiện (chờ đánh dấu hoàn thành)
        needsAction: mine.some(
          (o) =>
            o.status === 'Draft' ||
            o.status === 'NeedRevision' ||
            (o.status === 'Deposited' && (o.order_revisions.length > 0 || (!!o.event_date && o.event_date.toISOString().slice(0, 10) < today))),
        ),
        orderCodes: mine.map((o) => o.order_code),
      };
    });
  }
}
