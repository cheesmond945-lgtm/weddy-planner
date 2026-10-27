import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { ymd, ymdVN } from './order-mapping';
import { AUTO_COMPLETE_DAYS, OrdersService } from './orders.service';

const CHECK_EVERY_MS = 60 * 60 * 1000;
/** Nhắc NCC trước khi hệ thống tự hoàn thành bấy nhiêu ngày (một lần mỗi đơn). */
const WARN_BEFORE_DAYS = 2;
export const AUTO_COMPLETE_SOON = 'OrderAutoCompleteSoon';

const vnDate = (d: string) => d.split('-').reverse().join('/');
const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/**
 * NCC quên xác nhận thu đủ sau ngày cưới: nhắc trước WARN_BEFORE_DAYS ngày, tới AUTO_COMPLETE_DAYS ngày sau ngày sự kiện
 * thì tự hoàn thành đơn và tính hoa hồng (OrdersService.autoCompleteOverdue). Kiểm tra mỗi giờ; chống trùng nhờ trạng thái đơn
 * và thông báo đã gửi, nên khởi động lại backend cũng không làm hai lần.
 */
@Injectable()
export class OrderAutoCompleteService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OrderAutoCompleteService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  onModuleInit() {
    setTimeout(() => void this.run(), 20_000).unref();
    this.timer = setInterval(() => void this.run(), CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    try {
      const warned = await this.warnSoon(now);
      const done = await this.orders.autoCompleteOverdue(now);
      if (warned || done) this.log.log(`Đơn quên xác nhận thu đủ: nhắc ${warned} đơn, tự hoàn thành ${done} đơn.`);
    } catch (e) {
      this.log.error(`Không tự hoàn thành được đơn: ${(e as Error).message}`);
    }
  }

  /** Đơn đã cọc, ngày sự kiện cách hôm nay từ (AUTO_COMPLETE_DAYS - WARN_BEFORE_DAYS) ngày: báo NCC ngày hệ thống sẽ tự hoàn thành. */
  private async warnSoon(now: Date) {
    const today = ymdVN(now);
    const from = new Date(`${addDays(today, -AUTO_COMPLETE_DAYS + 1)}T00:00:00Z`);
    const to = new Date(`${addDays(today, -(AUTO_COMPLETE_DAYS - WARN_BEFORE_DAYS))}T00:00:00Z`);
    const rows = await this.prisma.orders.findMany({
      where: { status: 'Deposited', event_date: { gte: from, lte: to } },
      select: { id: true, order_code: true, customer_name: true, event_date: true, vendor_profiles: { select: { user_id: true } } },
    });
    if (!rows.length) return 0;
    const sent = await this.prisma.notifications.findMany({ where: { type: AUTO_COMPLETE_SOON, reference_id: { in: rows.map((r) => r.id) } }, select: { reference_id: true } });
    let n = 0;
    for (const o of rows) {
      const userId = o.vendor_profiles?.user_id;
      if (!userId || sent.some((s) => s.reference_id === o.id)) continue;
      const event = ymd(o.event_date);
      await notify(this.prisma, {
        userId,
        type: AUTO_COMPLETE_SOON,
        title: 'Đơn chưa xác nhận thu đủ',
        content: `Đơn ${o.order_code} (${o.customer_name}) đã qua ngày sự kiện ${vnDate(event)} nhưng chưa xác nhận thu đủ. Hệ thống sẽ tự hoàn thành đơn và tính hoa hồng vào ngày ${vnDate(addDays(event, AUTO_COMPLETE_DAYS))}.`,
        referenceType: 'Order',
        referenceId: o.id,
      });
      n++;
    }
    return n;
  }
}
