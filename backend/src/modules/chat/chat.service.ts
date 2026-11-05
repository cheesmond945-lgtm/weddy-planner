import { HttpException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CHAT_BUCKET, StorageService } from '../../integrations/storage/storage.service';
import { decodeFileName, safeBaseName } from '../vendors/vendor-files';
import { attachmentLabel, extOfMime, kindOfMime, MAX_ATTACHMENT_BYTES, normalizeMime, parseDuration } from './chat-attachments';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from '../catalog/services.service';
import { WeddingsService } from '../weddings/weddings.service';
import { publish } from '../realtime/realtime.bus';
import { ChatAutoReplyService } from './chat-auto-reply.service';
import { markNewMessageRead, messageInclude, postMessage } from './chat-messages';
import { ChatRole, isUuid, REACTIONS, todayVn, toLastMessage, toMessage } from './chat.mappers';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const MAX_TEXT = 2000;

export interface ChatUser {
  sub: string;
  role: ChatRole;
}

const lastMessageInclude = { messages: { orderBy: [{ sent_date: 'desc' as const }, { id: 'desc' as const }], take: 1, include: messageInclude } };

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
    private readonly autoReply: ChatAutoReplyService,
    private readonly storage: StorageService,
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
      include: messageInclude,
    });
    const urls = await this.storage.signedChatUrls(rows.flatMap((m) => (m.attachment_path ? [m.attachment_path] : [])));
    return rows.map((m) => toMessage(m, conv.couple_id, user.sub, urls));
  }

  /** Kiểm tin được trả lời thuộc đúng hội thoại; trả id hoặc null khi không trả lời tin nào. */
  private async replyTarget(conversationId: string, replyToId: unknown) {
    if (replyToId === undefined || replyToId === null || replyToId === '') return null;
    const ok = typeof replyToId === 'string' && isUuid(replyToId) && (await this.prisma.messages.count({ where: { id: replyToId, conversation_id: conversationId } }));
    return ok ? (replyToId as string) : fail('MESSAGE_NOT_FOUND', 'Không tìm thấy tin nhắn được trả lời.', 404);
  }

  /**
   * Gửi ảnh / tệp / ghi âm (như Messenger): tệp lưu ở bucket riêng tư chat-files theo hội thoại, tin Image | File | Audio. Kiểu tệp theo danh
   * sách cho phép (chat-attachments.ts), tối đa 25MB. `durationSec`: độ dài ghi âm. Không kích hoạt chào tự động (chỉ xét tin chữ).
   */
  async sendAttachment(user: ChatUser, id: string, file: Express.Multer.File | undefined, body: { replyToId?: unknown; durationSec?: unknown }) {
    const conv = await this.owned(user, id);
    if (!file?.buffer?.length) return fail('VALIDATION_ERROR', 'Chọn tệp để gửi.', 400);
    if (file.size > MAX_ATTACHMENT_BYTES) return fail('FILE_TOO_LARGE', 'Tệp tối đa 25MB.', 413);
    const name = decodeFileName(file.originalname || 'tep');
    const mime = normalizeMime(file.mimetype, name);
    if (!mime) return fail('UNSUPPORTED_FILE', 'Chỉ gửi được ảnh, ghi âm, video, PDF, Word, Excel, PowerPoint, TXT hoặc ZIP.', 415);
    const replyTo = await this.replyTarget(id, body?.replyToId);
    const kind = kindOfMime(mime);
    const path = `${id}/${randomUUID()}_${safeBaseName(name)}.${extOfMime(mime, name)}`;
    await this.storage.upload(CHAT_BUCKET, path, file.buffer, mime);
    const content = attachmentLabel(kind, name);
    const m = await postMessage(this.prisma, {
      conversationId: id,
      senderId: user.sub,
      type: kind,
      content,
      replyToId: replyTo,
      attachment: { path, name, mime, size: file.size, duration: kind === 'Audio' ? parseDuration(body?.durationSec) : null },
    }).catch(async (e: unknown) => {
      // Ghi tin lỗi thì xóa tệp vừa upload, không để tệp mồ côi trên Storage
      await this.storage.remove(CHAT_BUCKET, [path]);
      throw e;
    });
    // Tin nhắn không vào chuông thông báo: người nhận thấy số tin chưa đọc ở mục Tin nhắn (realtime đã báo trong postMessage)
    return toMessage(m, conv.couple_id, user.sub, await this.storage.signedChatUrls([path]));
  }

  /** Gửi tin; `replyToId` (tùy chọn) là tin được trả lời, phải cùng hội thoại. Khách gửi thì xét trả lời tự động (chạy sau response). */
  async send(user: ChatUser, id: string, text: string, replyToId?: unknown) {
    const conv = await this.owned(user, id);
    const content = (text ?? '').trim();
    if (!content) return fail('VALIDATION_ERROR', 'Nhập nội dung tin nhắn.', 400);
    if (content.length > MAX_TEXT) return fail('VALIDATION_ERROR', `Tin nhắn tối đa ${MAX_TEXT} ký tự.`, 400);
    const replyTo = await this.replyTarget(id, replyToId);
    const m = await postMessage(this.prisma, { conversationId: id, senderId: user.sub, content, replyToId: replyTo });
    // Tin nhắn không vào chuông thông báo: người nhận thấy số tin chưa đọc ở mục Tin nhắn (realtime đã báo trong postMessage)
    if (user.role === 'Couple') this.autoReply.schedule(conv, m.id);
    return toMessage(m, conv.couple_id, user.sub);
  }

  /**
   * Thu hồi tin với mọi người (như Messenger): chỉ người gửi, chỉ tin chữ / ảnh / tệp / ghi âm. Xóa tệp trên Storage và cảm xúc, giữ dòng tin
   * (recalled_date) để hai bên thấy "đã thu hồi một tin nhắn". Báo realtime để bên kia thấy ngay.
   */
  async recall(user: ChatUser, id: string, messageId: string) {
    const conv = await this.owned(user, id);
    const m = isUuid(messageId) ? await this.prisma.messages.findFirst({ where: { id: messageId, conversation_id: id } }) : null;
    if (!m) return fail('MESSAGE_NOT_FOUND', 'Không tìm thấy tin nhắn.', 404);
    if (m.sender_id !== user.sub) return fail('FORBIDDEN', 'Chỉ thu hồi được tin của chính bạn.', 403);
    if (!['Text', 'Image', 'File', 'Audio'].includes(m.type ?? '')) return fail('MESSAGE_NOT_RECALLABLE', 'Không thu hồi được tin đơn hàng hoặc hóa đơn.', 409);
    if (!m.recalled_date) {
      if (m.attachment_path) await this.storage.remove(CHAT_BUCKET, [m.attachment_path]);
      await this.prisma.$transaction([
        this.prisma.message_reactions.deleteMany({ where: { message_id: m.id } }),
        this.prisma.messages.update({
          where: { id: m.id },
          data: { recalled_date: new Date(), attachment_path: null, attachment_name: null, attachment_mime: null, attachment_size: null, attachment_duration: null },
        }),
      ]);
      publish({ users: [conv.couple_id!, conv.vendor_id!], event: 'message', data: { conversationId: id, orderId: null, type: 'Recall' } });
    }
    const row = await this.prisma.messages.findUniqueOrThrow({ where: { id: m.id }, include: messageInclude });
    return toMessage(row, conv.couple_id, user.sub);
  }

  /** Thả (hoặc thay) cảm xúc vào một tin của hội thoại; `emoji` rỗng là gỡ cảm xúc của mình. Báo realtime để bên kia thấy ngay. */
  async react(user: ChatUser, id: string, messageId: string, emoji: unknown) {
    const conv = await this.owned(user, id);
    const exists = isUuid(messageId) && (await this.prisma.messages.count({ where: { id: messageId, conversation_id: id } }));
    if (!exists) return fail('MESSAGE_NOT_FOUND', 'Không tìm thấy tin nhắn.', 404);
    if (await this.prisma.messages.count({ where: { id: messageId, recalled_date: { not: null } } })) return fail('MESSAGE_RECALLED', 'Tin nhắn đã được thu hồi.', 409);
    if (emoji === null || emoji === undefined || emoji === '') {
      await this.prisma.message_reactions.deleteMany({ where: { message_id: messageId, user_id: user.sub } });
    } else {
      if (typeof emoji !== 'string' || !(REACTIONS as readonly string[]).includes(emoji)) return fail('VALIDATION_ERROR', 'Cảm xúc không hợp lệ.', 400);
      await this.prisma.message_reactions.upsert({
        where: { message_id_user_id: { message_id: messageId, user_id: user.sub } },
        create: { message_id: messageId, user_id: user.sub, emoji },
        update: { emoji, created_date: new Date() },
      });
    }
    publish({ users: [conv.couple_id!, conv.vendor_id!], event: 'message', data: { conversationId: id, orderId: null, type: 'Reaction' } });
    const row = await this.prisma.messages.findUniqueOrThrow({ where: { id: messageId }, include: messageInclude });
    return toMessage(row, conv.couple_id, user.sub, await this.storage.signedChatUrls(row.attachment_path ? [row.attachment_path] : []));
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
      this.services.summaries(vendors.map((v) => v.id), userId),
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
      if (!v || !service) return []; // NCC không còn hiển thị và không có đơn nào với cặp đôi này
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
   * POST /conversations: mở (hoặc tạo) hội thoại với NCC của một dịch vụ. Không đụng tới kế hoạch: khách tự thêm NCC bằng
   * "Thêm vào kế hoạch" (lúc đó mới hỏi thay / báo hạng mục đã chốt); khách cọc đơn của NCC thì NCC vào kế hoạch lúc cọc.
   * `replace` giữ cho client cũ, không còn dùng.
   */
  async startForCouple(userId: string, serviceId: string, replace: boolean) {
    // Nhắn tin chỉ mở hội thoại, KHÔNG thêm NCC vào kế hoạch (khách tự bấm "Thêm vào kế hoạch"; cọc đơn thì NCC vào kế hoạch lúc cọc)
    void replace;
    if (!/^[0-9a-f-]{36}$/i.test(serviceId) || !(await this.services.isVisible(serviceId))) return fail('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ.', 404);
    const vendor = await this.prisma.vendor_profiles.findUniqueOrThrow({ where: { id: serviceId }, include: { service_categories: { select: { name: true } } } });
    let conv = await this.prisma.conversations.findUnique({ where: { couple_id_vendor_id: { couple_id: userId, vendor_id: vendor.user_id! } } });
    if (!conv) {
      conv = await this.prisma.conversations.create({ data: { couple_id: userId, vendor_id: vendor.user_id, category_id: vendor.category_id } });
      await postMessage(this.prisma, {
        conversationId: conv.id,
        senderId: vendor.user_id,
        content: `Chào bạn! Mình là ${vendor.business_name}. Bạn cần tư vấn gói nào cho ${(vendor.service_categories?.name ?? 'dịch vụ').toLowerCase()}?`,
        isRead: true,
        // Câu chào do hệ thống tự gửi: không tính là NCC đang trực (chat-auto-reply.service.ts)
        isAuto: true,
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
