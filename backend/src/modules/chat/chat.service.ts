import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from '../catalog/services.service';
import { WeddingsService } from '../weddings/weddings.service';
import { paymentStatusOf, serviceStatusOf } from '../orders/order-mapping';
import { postMessage } from './chat-messages';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

type MessageRow = Awaited<ReturnType<typeof postMessage>>;

/** Bỏ id rỗng (cột khóa ngoại cho phép null). */
const present = (ids: (string | null)[]) => ids.filter((x): x is string => !!x);

const senderOf = (m: { sender_id: string | null }, coupleId: string | null) => (m.sender_id === null ? 'SYSTEM' : m.sender_id === coupleId ? 'COUPLE' : 'VENDOR');

/** Tin phía cặp đôi: chỉ có TEXT và ORDER; các tin hệ thống (biên nhận, hủy...) hiện như tin chữ. */
function coupleMessage(m: MessageRow, coupleId: string | null) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    sender: senderOf(m, coupleId),
    type: m.type === 'Order' ? 'ORDER' : 'TEXT',
    text: m.content ?? '',
    orderId: m.order_id,
    createdAt: m.sent_date?.toISOString() ?? '',
  };
}

/** Tin phía NCC: thêm các loại tin sự kiện của đơn, nhận ra từ loại tin và đầu câu của nội dung. */
function vendorMessage(m: MessageRow, coupleId: string | null) {
  const sender = senderOf(m, coupleId);
  const content = m.content ?? '';
  let type = 'TEXT';
  let text = content;
  let changes: string[] | null = null;
  if (m.type === 'Order') type = 'ORDER';
  else if (m.type === 'DepositReceipt' || m.type === 'FinalInvoice') type = 'PAYMENT_RECORDED';
  else if (m.order_id && sender === 'COUPLE' && content.startsWith('Yêu cầu chỉnh sửa đơn')) {
    type = 'ORDER_REVISION_REQUESTED';
    text = content.split('\n').slice(1).join('\n');
  } else if (m.order_id && sender === 'SYSTEM' && content.startsWith('Đã hủy đơn')) {
    type = 'ORDER_CANCELLED';
    text = content.includes('Lý do: ') ? content.split('Lý do: ').slice(1).join('Lý do: ') : '';
  } else if (m.order_id && sender === 'SYSTEM' && content.startsWith('Đã cập nhật và gửi lại')) {
    type = 'ORDER_RESENT';
    changes = content.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
    text = '';
  }
  return {
    id: m.id,
    conversationId: m.conversation_id,
    sender,
    type,
    text,
    orderId: m.order_id,
    orderVersion: m.order_id && ['ORDER', 'ORDER_RESENT', 'ORDER_REVISION_REQUESTED'].includes(type) ? 1 : null,
    adjustmentId: null,
    changes,
    createdAt: m.sent_date?.toISOString() ?? '',
  };
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly weddings: WeddingsService,
  ) {}

  // ================= Cặp đôi =================

  private async ownedByCouple(userId: string, id: string) {
    const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const conv = ok ? await this.prisma.conversations.findFirst({ where: { id, couple_id: userId } }) : null;
    return conv ?? fail('CONVERSATION_NOT_FOUND', 'Không tìm thấy hội thoại.', 404);
  }

  private async coupleConversations(userId: string, only?: string) {
    const convs = await this.prisma.conversations.findMany({ where: { couple_id: userId, ...(only ? { id: only } : {}) }, orderBy: [{ last_message_date: 'desc' }, { created_date: 'desc' }] });
    const vendors = await this.prisma.vendor_profiles.findMany({ where: { user_id: { in: present(convs.map((c) => c.vendor_id)) } }, select: { id: true, user_id: true } });
    const vendorByUser = new Map(vendors.map((v) => [v.user_id, v]));
    const [summaries, statuses, lasts] = await Promise.all([
      this.services.summaries(vendors.map((v) => v.id)),
      this.weddings.planStatusMap(userId, vendors),
      this.prisma.messages.findMany({ where: { conversation_id: { in: convs.map((c) => c.id) } }, orderBy: { sent_date: 'desc' } }),
    ]);
    const sumById = new Map(summaries.map((s) => [s.id, s]));
    const lastByConv = new Map<string, (typeof lasts)[number]>();
    for (const m of lasts) if (m.conversation_id && !lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);

    return convs.flatMap((c) => {
      const v = vendorByUser.get(c.vendor_id);
      const service = v && sumById.get(v.id);
      if (!v || !service) return []; // NCC đã bị ẩn
      const last = lastByConv.get(c.id);
      return [
        {
          id: c.id,
          service,
          planStatus: statuses.get(v.id) ?? null,
          lastMessage: last ? { type: last.type === 'Order' ? 'ORDER' : 'TEXT', text: last.content ?? '', createdAt: last.sent_date?.toISOString() ?? '' } : null,
        },
      ];
    });
  }

  listForCouple(userId: string) {
    return this.coupleConversations(userId);
  }

  async startForCouple(userId: string, serviceId: string, replace: boolean) {
    await this.weddings.addPlanItem(userId, serviceId, replace, true);
    const vendor = await this.prisma.vendor_profiles.findUniqueOrThrow({ where: { id: serviceId }, include: { service_categories: { select: { name: true } } } });
    if (!vendor.user_id) return fail('SERVICE_NOT_FOUND', 'Nhà cung cấp chưa có tài khoản.', 404);
    let conv = await this.prisma.conversations.findUnique({ where: { couple_id_vendor_id: { couple_id: userId, vendor_id: vendor.user_id } } });
    if (!conv) {
      conv = await this.prisma.conversations.create({ data: { couple_id: userId, vendor_id: vendor.user_id, category_id: vendor.category_id } });
      await postMessage(this.prisma, {
        conversationId: conv.id,
        senderId: vendor.user_id,
        content: `Chào bạn! Mình là ${vendor.business_name}. Bạn cần tư vấn gói nào cho ${vendor.service_categories?.name?.toLowerCase() ?? 'dịch vụ'}?`,
        isRead: true,
      });
    }
    return (await this.coupleConversations(userId, conv.id))[0];
  }

  async messagesForCouple(userId: string, id: string) {
    const conv = await this.ownedByCouple(userId, id);
    const rows = await this.prisma.messages.findMany({ where: { conversation_id: id }, orderBy: [{ sent_date: 'asc' }, { id: 'asc' }], include: { orders: { select: { order_code: true } } } });
    return rows.map((m) => coupleMessage(m, conv.couple_id));
  }

  async sendForCouple(userId: string, id: string, text: string) {
    const conv = await this.ownedByCouple(userId, id);
    const content = (text ?? '').trim();
    if (!content) return fail('VALIDATION_ERROR', 'Nhập nội dung tin nhắn.', 400);
    const m = await postMessage(this.prisma, { conversationId: id, senderId: userId, content });
    return coupleMessage(m, conv.couple_id);
  }

  // ================= Nhà cung cấp =================

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true } });
    return v ?? fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
  }

  private async ownedByVendor(userId: string, id: string) {
    const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const conv = ok ? await this.prisma.conversations.findFirst({ where: { id, vendor_id: userId } }) : null;
    return conv ?? fail('CONVERSATION_NOT_FOUND', 'Không tìm thấy hội thoại.', 404);
  }

  async listForVendor(userId: string) {
    const vendor = await this.vendorOf(userId);
    const convs = await this.prisma.conversations.findMany({ where: { vendor_id: userId }, orderBy: [{ last_message_date: 'desc' }, { created_date: 'desc' }] });
    const coupleIds = present(convs.map((c) => c.couple_id));
    const [couples, weddings, orders, msgs] = await Promise.all([
      this.prisma.users.findMany({ where: { id: { in: coupleIds } }, select: { id: true, full_name: true, phone_number: true } }),
      this.prisma.weddings.findMany({ where: { user_id: { in: coupleIds } }, select: { id: true, user_id: true, groom_name: true, bride_name: true } }),
      this.prisma.orders.findMany({ where: { vendor_id: vendor.id, weddings: { user_id: { in: coupleIds } } }, include: { weddings: { select: { user_id: true } } }, orderBy: { created_date: 'desc' } }),
      this.prisma.messages.findMany({ where: { conversation_id: { in: convs.map((c) => c.id) } }, orderBy: { sent_date: 'desc' }, include: { orders: { select: { order_code: true } } } }),
    ]);
    const coupleById = new Map(couples.map((u) => [u.id, u]));
    const weddingByUser = new Map(weddings.map((w) => [w.user_id, w]));

    return convs.map((c) => {
      const u = c.couple_id ? coupleById.get(c.couple_id) : undefined;
      const w = weddingByUser.get(c.couple_id);
      const mine = orders.filter((o) => o.weddings?.user_id === c.couple_id);
      const mineMsgs = msgs.filter((m) => m.conversation_id === c.id);
      const last = mineMsgs[0];
      const latestSent = mine.find((o) => o.status !== 'Draft');
      const lastMapped = last ? vendorMessage(last, c.couple_id) : null;
      return {
        id: c.id,
        customer: { name: w && w.bride_name && !w.bride_name.startsWith('(') ? `${w.groom_name} & ${w.bride_name}` : (w?.groom_name ?? u?.full_name ?? ''), phone: u?.phone_number ?? '' },
        interestPackage: null,
        unreadCount: mineMsgs.filter((m) => m.sender_id === c.couple_id && !m.is_read).length,
        lastMessage: lastMapped
          ? { sender: lastMapped.sender, type: lastMapped.type, text: lastMapped.text, orderVersion: lastMapped.orderVersion, orderCode: last?.orders?.order_code ?? null, createdAt: lastMapped.createdAt }
          : null,
        latestOrder: latestSent ? { id: latestSent.id, code: latestSent.order_code, status: serviceStatusOf(latestSent.status), paymentStatus: paymentStatusOf(latestSent.status) } : null,
        hasDraftOrder: mine.some((o) => o.status === 'Draft'),
        needsAction: mine.some((o) => o.status === 'Draft' || o.status === 'NeedRevision'),
        orderCodes: mine.map((o) => o.order_code),
      };
    });
  }

  async messagesForVendor(userId: string, id: string) {
    const conv = await this.ownedByVendor(userId, id);
    const rows = await this.prisma.messages.findMany({ where: { conversation_id: id }, orderBy: [{ sent_date: 'asc' }, { id: 'asc' }], include: { orders: { select: { order_code: true } } } });
    return rows.map((m) => vendorMessage(m, conv.couple_id));
  }

  async sendForVendor(userId: string, id: string, text: string) {
    const conv = await this.ownedByVendor(userId, id);
    const content = (text ?? '').trim();
    if (!content) return fail('VALIDATION_ERROR', 'Nhập nội dung tin nhắn.', 400);
    const m = await postMessage(this.prisma, { conversationId: id, senderId: userId, content, isRead: false });
    return vendorMessage(m, conv.couple_id);
  }

  async markReadForVendor(userId: string, id: string) {
    const conv = await this.ownedByVendor(userId, id);
    await this.prisma.messages.updateMany({ where: { conversation_id: id, sender_id: conv.couple_id, is_read: false }, data: { is_read: true, read_date: new Date() } });
    return null;
  }
}
