import { Injectable, Logger } from '@nestjs/common';
import { runAfter } from '../../common/after-response';
import { GeminiService } from '../../integrations/ai/gemini.service';
import { PrismaService } from '../../prisma/prisma.service';
import { postMessage } from './chat-messages';

/** Chờ NCC tự trả lời trong khoảng này; quá mà NCC chưa trả lời (đang bận) thì AI mới chào */
const WAIT_VENDOR_MS = 20_000;
/** NCC vừa tự nhắn trong khoảng này thì coi là đang trực, không chào tự động */
const VENDOR_ACTIVE_MS = 15 * 60_000;
/** Mỗi hội thoại tối đa một lời chào tự động trong khoảng này: AI chỉ chào câu đầu, phần tư vấn là của NCC */
const AUTO_GAP_MS = 24 * 3600_000;
const AI_TIMEOUT_MS = 12_000;
const MAX_REPLY = 300;
/** Số tin gần nhất gửi kèm cho AI làm ngữ cảnh */
const HISTORY = 6;

const SYSTEM = [
  'Bạn là trợ lý chào khách tự động trong khung chat của một nhà cung cấp dịch vụ cưới (NCC) trên nền tảng Forever, dùng khi NCC đang bận chưa trả lời.',
  'Nhiệm vụ DUY NHẤT: chào khách một câu thân thiện, tự nhiên, linh hoạt theo lời khách vừa nhắn (không lặp một khuôn mẫu),',
  'cho khách biết NCC đã nhận tin và sẽ phản hồi sớm.',
  'TUYỆT ĐỐI KHÔNG tư vấn: không nêu gói, giá, lịch trống, khuyến mãi, không trả lời nội dung câu hỏi, không hỏi thêm chi tiết; việc tư vấn để NCC làm.',
  'Khách hỏi gì cụ thể thì chỉ ghi nhận ngắn gọn (ví dụ "về lịch ngày bạn hỏi") rồi nói NCC sẽ trả lời ngay khi rảnh.',
  'Không trả lời (reply = false) khi khách chỉ cảm ơn, đồng ý, tạm biệt, hoặc tin không cần phản hồi.',
  'Văn phong: tiếng Việt, xưng "mình", gọi khách là "bạn", 1 đến 2 câu, không markdown, tối đa 1 emoji.',
  'Trả về JSON đúng dạng: {"reply": boolean, "text": string}. reply = false thì text là chuỗi rỗng.',
].join(' ');

type Conv = { id: string; couple_id: string | null; vendor_id: string | null };

/**
 * Chào tự động (Gemini) khi NCC bận chưa trả lời: chỉ một câu chào đầu, không tư vấn. Tin gửi dưới tên NCC, đánh dấu is_auto để hai bên thấy
 * nhãn "Trả lời tự động". Bỏ qua khi thiếu khóa AI, NCC đang trực (vừa tự nhắn), đã chào tự động trong 24 giờ, hoặc NCC / khách nhắn tiếp
 * trong lúc chờ.
 */
@Injectable()
export class ChatAutoReplyService {
  private readonly log = new Logger(ChatAutoReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  /** Xét chào tin `messageId` của khách sau WAIT_VENDOR_MS (cho NCC kịp tự trả lời); không làm chậm việc gửi tin. */
  schedule(conv: Conv, messageId: string) {
    if (!this.gemini.configured || !conv.vendor_id) return;
    setTimeout(() => runAfter('chào tự động', () => this.reply(conv, messageId), (m) => this.log.warn(m)), WAIT_VENDOR_MS).unref?.();
  }

  private async reply(conv: Conv, messageId: string) {
    const vendorUser = conv.vendor_id!;
    const now = Date.now();
    // Câu chào mở đầu lúc tạo hội thoại cũng là tin tự động nhưng có trước tin của khách: chỉ đếm lời chào tự động sau tin đầu tiên của khách
    const firstCouple = await this.prisma.messages.findFirst({ where: { conversation_id: conv.id, sender_id: conv.couple_id }, orderBy: { sent_date: 'asc' }, select: { sent_date: true } });
    const since = Math.max(now - AUTO_GAP_MS, firstCouple?.sent_date?.getTime() ?? 0);
    const [vendorActive, recentAuto] = await Promise.all([
      this.prisma.messages.count({ where: { conversation_id: conv.id, sender_id: vendorUser, is_auto: { not: true }, sent_date: { gte: new Date(now - VENDOR_ACTIVE_MS) } } }),
      this.prisma.messages.count({ where: { conversation_id: conv.id, is_auto: true, sent_date: { gte: new Date(since) } } }),
    ]);
    if (vendorActive || recentAuto) return;

    const vendor = await this.prisma.vendor_profiles.findUnique({ where: { user_id: vendorUser }, select: { business_name: true, service_categories: { select: { name: true } } } });
    if (!vendor) return;
    const history = await this.prisma.messages.findMany({ where: { conversation_id: conv.id }, orderBy: [{ sent_date: 'desc' }, { id: 'desc' }], take: HISTORY, select: { id: true, sender_id: true, content: true } });
    if (history[0]?.id !== messageId) return; // NCC hoặc khách đã nhắn tiếp: tin sau sẽ được xét

    const who = (s: string | null) => (s === conv.couple_id ? 'Khách' : s === null ? 'Hệ thống' : 'NCC');
    const prompt = [
      `NCC: ${vendor.business_name ?? ''} · Lĩnh vực: ${vendor.service_categories?.name ?? ''}`,
      `Hội thoại gần nhất (cũ đến mới):\n${[...history].reverse().map((m) => `${who(m.sender_id)}: ${(m.content ?? '').slice(0, 300)}`).join('\n')}`,
    ].join('\n\n');

    const out = (await this.gemini.json(SYSTEM, prompt, AI_TIMEOUT_MS)) as { reply?: unknown; text?: unknown };
    const text = typeof out?.text === 'string' ? out.text.replace(/[*_`#]+/g, '').trim().slice(0, MAX_REPLY) : '';
    if (out?.reply !== true || !text) return;

    // Trong lúc chờ AI, NCC đã tự trả lời hoặc khách đã nhắn tiếp thì thôi
    const latest = await this.prisma.messages.findFirst({ where: { conversation_id: conv.id }, orderBy: [{ sent_date: 'desc' }, { id: 'desc' }], select: { id: true } });
    if (latest?.id !== messageId) return;
    await postMessage(this.prisma, { conversationId: conv.id, senderId: vendorUser, content: text, isAuto: true });
  }
}
