import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../integrations/mail/mail.service';
import { notify } from '../chat/chat-messages';
import { ymd, ymdVN } from '../orders/order-mapping';

/** Nhắc NCC mỗi ngày từ bấy nhiêu ngày trước hạn tới đúng ngày hạn (2: 2 ngày trước, 1 ngày trước, đúng ngày hạn). */
const DUE_SOON_DAYS = 2;
/** Sau hạn, nhắc NCC khi quá hạn bấy nhiêu ngày (rồi tới mốc LOCK_AFTER_DAYS). */
const OVERDUE_REMIND_DAYS = 3;
/** Theo điều khoản: quá hạn bấy nhiêu ngày thì báo NCC tài khoản có thể bị khóa, và Admin được khóa tài khoản NCC. */
const LOCK_AFTER_DAYS = 7;
const CHECK_EVERY_MS = 60 * 60 * 1000;

/** NCC: sắp đến hạn / đã quá hạn. Admin: có NCC quá hạn / quá hạn đủ ngày để khóa. */
export const DUE_SOON = 'CommissionDueSoon';
export const OVERDUE = 'CommissionOverdue';
export const LOCKABLE = 'CommissionLockable';

const dayNumber = (d: string) => Math.floor(new Date(`${d}T00:00:00Z`).getTime() / 86_400_000);
const vnDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export interface ReminderStatement {
  id: string;
  dueDate: string;
  period: string;
  amount: number;
  vendorUserId: string;
  vendorName: string;
}
export interface SentNotification {
  type: string;
  userId: string;
  /** Ngày gửi theo giờ Việt Nam */
  day: string;
}
export interface PlannedNotification {
  userId: string;
  type: string;
  title: string;
  content: string;
}

/**
 * Các thông báo cần gửi hôm nay cho một bảng kê chưa thanh toán (hàm thuần, để thử theo từng ngày).
 * - NCC: trước hạn 2 ngày, 1 ngày, đúng ngày hạn; sau hạn 3 ngày; và khi quá hạn 7 ngày chưa thanh toán (báo tài khoản có thể bị khóa).
 *   Hai mốc sau hạn kèm email.
 * - Admin: một lần khi bảng kê quá hạn, một lần khi quá hạn đủ 7 ngày (đủ điều kiện khóa). Khóa hay không do Admin quyết định.
 * Chống trùng dựa trên các thông báo đã gửi của bảng kê, nên chạy mỗi giờ hay khởi động lại cũng không gửi lặp;
 * backend tắt vài ngày thì lần chạy sau gửi đúng mốc hiện tại, không gửi bù các mốc đã lỡ.
 */
export function planReminders(s: ReminderStatement, today: string, sent: SentNotification[], adminIds: string[]): PlannedNotification[] {
  const late = dayNumber(today) - dayNumber(s.dueDate);
  const money = `${s.amount.toLocaleString('vi-VN')}đ`;
  const periodText = `kỳ ${s.period.slice(5, 7)}/${s.period.slice(0, 4)}`;
  const toVendor = sent.filter((n) => n.userId === s.vendorUserId);
  const toAdmin = (type: string) => sent.some((n) => n.type === type && adminIds.includes(n.userId));
  const out: PlannedNotification[] = [];

  if (late <= 0) {
    if (late >= -DUE_SOON_DAYS && !toVendor.some((n) => n.type === DUE_SOON && n.day === today)) {
      out.push({
        userId: s.vendorUserId,
        type: DUE_SOON,
        title: 'Sắp đến hạn thanh toán hoa hồng',
        content: `Bảng kê hoa hồng ${periodText} (${money}) đến hạn ngày ${vnDate(s.dueDate)}${late < 0 ? `, còn ${-late} ngày` : ', hạn là hôm nay'}. Vui lòng chuyển khoản cho Forever đúng hạn.`,
      });
    }
    return out;
  }

  // NCC: nhắc khi quá hạn 3 ngày, rồi khi quá hạn 7 ngày kèm cảnh báo có thể bị khóa. Mỗi mốc một lần; bỏ lỡ đúng ngày thì
  // gửi ở lần chạy sau, và nếu đã quá mốc sau thì chỉ gửi mốc sau (không gửi dồn hai thông báo).
  const milestone = late >= LOCK_AFTER_DAYS ? LOCK_AFTER_DAYS : late >= OVERDUE_REMIND_DAYS ? OVERDUE_REMIND_DAYS : 0;
  if (milestone && !toVendor.some((n) => n.type === OVERDUE && dayNumber(n.day) >= dayNumber(s.dueDate) + milestone)) {
    const lockable = milestone === LOCK_AFTER_DAYS;
    out.push({
      userId: s.vendorUserId,
      type: OVERDUE,
      title: lockable ? 'Hoa hồng quá hạn: tài khoản có thể bị khóa' : 'Hoa hồng đã quá hạn thanh toán',
      content: lockable
        ? `Bảng kê hoa hồng ${periodText} (${money}) đã quá hạn ${late} ngày (hạn ${vnDate(s.dueDate)}). Theo điều khoản, tài khoản quá hạn từ ${LOCK_AFTER_DAYS} ngày có thể bị khóa. Vui lòng thanh toán ngay.`
        : `Bảng kê hoa hồng ${periodText} (${money}) đã quá hạn ${late} ngày (hạn ${vnDate(s.dueDate)}). Vui lòng thanh toán sớm: theo điều khoản, quá hạn ${LOCK_AFTER_DAYS} ngày tài khoản có thể bị khóa.`,
    });
  }
  if (!toAdmin(OVERDUE)) {
    for (const id of adminIds) {
      out.push({
        userId: id,
        type: OVERDUE,
        title: `Quá hạn hoa hồng: ${s.vendorName}`,
        content: `${s.vendorName} chưa thanh toán hoa hồng ${periodText} (${money}), hạn ${vnDate(s.dueDate)}, đã quá hạn ${late} ngày.`,
      });
    }
  }
  if (late >= LOCK_AFTER_DAYS && !toAdmin(LOCKABLE)) {
    for (const id of adminIds) {
      out.push({
        userId: id,
        type: LOCKABLE,
        title: `Đủ điều kiện khóa: ${s.vendorName}`,
        content: `${s.vendorName} quá hạn hoa hồng ${periodText} (${money}) ${late} ngày. Theo điều khoản, có thể khóa tài khoản ở mục Người dùng.`,
      });
    }
  }
  return out;
}

/** Thông báo tự động nhắc hạn và quá hạn thanh toán hoa hồng (xem planReminders). Kiểm tra mỗi giờ. */
@Injectable()
export class CommissionRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(CommissionRemindersService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly mail: MailService) {}

  /** Gửi email nhắc quá hạn cho NCC; lỗi email không ảnh hưởng thông báo trên website. */
  private async emailVendor(userId: string, name: string, title: string, content: string) {
    try {
      const u = await this.prisma.users.findUnique({ where: { id: userId }, select: { email: true } });
      if (u?.email) await this.mail.sendCommissionOverdue(u.email, name, title, content);
    } catch (e) {
      this.log.error(`Không gửi được email nhắc quá hạn: ${(e as Error).message}`);
    }
  }

  onModuleInit() {
    setTimeout(() => void this.run(), 15_000).unref();
    this.timer = setInterval(() => void this.run(), CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Gửi nhắc cho các bảng kê chưa thanh toán, có hoa hồng, đã tới gần hạn hoặc quá hạn. Trả về số thông báo đã gửi. */
  async run(now = new Date()) {
    try {
      const today = ymdVN(now);
      const limit = new Date((dayNumber(today) + DUE_SOON_DAYS) * 86_400_000);
      // Qua ngày hạn mà chưa nộp thì lưu trạng thái Overdue vào CSDL (không chỉ là nhãn tính khi hiển thị)
      const { count: markedOverdue } = await this.prisma.commission_statements.updateMany({
        where: { status: 'Unpaid', total_amount: { gt: 0 }, due_date: { lt: new Date(`${today}T00:00:00Z`) } },
        data: { status: 'Overdue' },
      });
      if (markedOverdue) this.log.log(`Đã chuyển ${markedOverdue} bảng kê hoa hồng sang trạng thái quá hạn.`);
      const rows = await this.prisma.commission_statements.findMany({
        where: { status: { in: ['Unpaid', 'Overdue'] }, total_amount: { gt: 0 }, due_date: { lte: limit } },
        include: { vendor_profiles: { select: { user_id: true, business_name: true } } },
      });
      if (!rows.length) return 0;
      const [admins, history] = await Promise.all([
        this.prisma.users.findMany({ where: { role: 'Admin', status: 'Active' }, select: { id: true } }),
        this.prisma.notifications.findMany({
          where: { reference_type: 'CommissionStatement', reference_id: { in: rows.map((r) => r.id) }, type: { in: [DUE_SOON, OVERDUE, LOCKABLE] } },
          select: { type: true, user_id: true, reference_id: true, created_date: true },
        }),
      ]);
      const adminIds = admins.map((a) => a.id);
      let sent = 0;
      for (const r of rows) {
        const vendorUserId = r.vendor_profiles?.user_id;
        if (!vendorUserId || !r.due_date || !r.period_month) continue;
        const plan = planReminders(
          { id: r.id, dueDate: ymd(r.due_date), period: ymd(r.period_month), amount: Number(r.total_amount), vendorUserId, vendorName: r.vendor_profiles?.business_name || 'Nhà cung cấp' },
          today,
          history.filter((n) => n.reference_id === r.id && n.type && n.user_id && n.created_date).map((n) => ({ type: n.type!, userId: n.user_id!, day: ymdVN(n.created_date!) })),
          adminIds,
        );
        for (const n of plan) {
          await notify(this.prisma, { ...n, referenceType: 'CommissionStatement', referenceId: r.id });
          // Quá hạn: ngoài thông báo trên website còn gửi email cho NCC (chống trùng theo thông báo ở trên nên chỉ gửi một lần mỗi mốc)
          if (n.type === OVERDUE && n.userId === vendorUserId) await this.emailVendor(vendorUserId, r.vendor_profiles?.business_name || 'Nhà cung cấp', n.title, n.content);
        }
        sent += plan.length;
      }
      if (sent) this.log.log(`Đã gửi ${sent} thông báo nhắc hạn / quá hạn thanh toán hoa hồng.`);
      return sent;
    } catch (e) {
      this.log.error(`Không gửi được thông báo nhắc hạn: ${(e as Error).message}`);
      return 0;
    }
  }
}
