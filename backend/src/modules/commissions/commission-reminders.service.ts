import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { ymd, ymdVN } from '../orders/order-mapping';

/** Nhắc NCC trước hạn thanh toán bao nhiêu ngày. */
const REMIND_DAYS = 3;
const CHECK_EVERY_MS = 60 * 60 * 1000;
const TYPE = 'CommissionDueSoon';

const dayNumber = (d: string) => Math.floor(new Date(`${d}T00:00:00Z`).getTime() / 86_400_000);
const vnDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * Thông báo tự động nhắc NCC thanh toán hoa hồng khi còn tối đa 3 ngày tới hạn (và chưa quá hạn).
 * Kiểm tra mỗi giờ; mỗi bảng kê chỉ nhắc một lần (kiểm tra bằng thông báo CommissionDueSoon đã có của bảng kê đó),
 * nên khởi động lại hay chạy nhiều lần cũng không gửi trùng.
 */
@Injectable()
export class CommissionRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(CommissionRemindersService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    setTimeout(() => void this.run(), 15_000).unref();
    this.timer = setInterval(() => void this.run(), CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Gửi nhắc cho các bảng kê chưa thanh toán, có hoa hồng, hạn trong 0 đến 3 ngày tới. Trả về số thông báo đã gửi. */
  async run() {
    try {
      const today = ymdVN(new Date());
      const limit = new Date(Date.UTC(0, 0, 0));
      limit.setTime((dayNumber(today) + REMIND_DAYS) * 86_400_000);
      const rows = await this.prisma.commission_statements.findMany({
        where: { status: 'Unpaid', total_amount: { gt: 0 }, due_date: { gte: new Date(`${today}T00:00:00Z`), lte: limit } },
        include: { vendor_profiles: { select: { user_id: true, business_name: true } } },
      });
      if (!rows.length) return 0;
      const done = new Set(
        (await this.prisma.notifications.findMany({ where: { type: TYPE, reference_id: { in: rows.map((r) => r.id) } }, select: { reference_id: true } })).map((n) => n.reference_id),
      );
      let sent = 0;
      for (const r of rows) {
        if (done.has(r.id)) continue;
        const due = ymd(r.due_date);
        const left = dayNumber(due) - dayNumber(today);
        const period = ymd(r.period_month).slice(0, 7);
        await notify(this.prisma, {
          userId: r.vendor_profiles.user_id,
          type: TYPE,
          title: 'Sắp đến hạn thanh toán hoa hồng',
          content: `Bảng kê hoa hồng kỳ ${period.slice(5)}/${period.slice(0, 4)} (${Number(r.total_amount).toLocaleString('vi-VN')}đ) đến hạn ngày ${vnDate(due)}${left > 0 ? `, còn ${left} ngày` : ', hạn là hôm nay'}. Vui lòng chuyển khoản cho WebPlan đúng hạn.`,
          referenceType: 'CommissionStatement',
          referenceId: r.id,
        });
        sent++;
      }
      if (sent) this.log.log(`Đã gửi ${sent} thông báo nhắc hạn thanh toán hoa hồng.`);
      return sent;
    } catch (e) {
      this.log.error(`Không gửi được thông báo nhắc hạn: ${(e as Error).message}`);
      return 0;
    }
  }
}
