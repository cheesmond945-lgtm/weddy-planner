import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { autoComplete, expirePending } from './order-lifecycle';

/** Hai lần quét cùng một phạm vi cách nhau tối thiểu từng này giây (FE hỏi lại mỗi 2,5 đến 5 giây). */
const MIN_GAP_MS = 15_000;
const GLOBAL_EVERY_MS = 3_600_000;

/**
 * Việc theo thời gian của đơn hàng (docs/database.md mục 9.12): hết hạn cọc và tự hoàn thành.
 *
 * - sweep({ vendorId | coupleId }): quét RIÊNG đơn của người đang xem, gọi trước khi đọc danh sách/chi tiết/đếm đơn để đơn
 *   của chính họ hiện đúng trạng thái. Luôn bật. Không đụng đơn của người khác.
 * - Quét toàn hệ thống (mọi đơn) chỉ chạy khi đặt ORDER_JOBS_ENABLED=true: một lần lúc khởi động rồi mỗi giờ. Mặc định TẮT.
 */
@Injectable()
export class OrderJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('OrderJobs');
  private timer?: NodeJS.Timeout;
  private readonly last = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.ORDER_JOBS_ENABLED?.trim().toLowerCase() !== 'true') return;
    this.log.log('ORDER_JOBS_ENABLED=true: quét toàn hệ thống lúc khởi động và mỗi giờ');
    void this.runAll();
    this.timer = setInterval(() => void this.runAll(), GLOBAL_EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async run(where: Prisma.ordersWhereInput) {
    const expired = await expirePending(this.prisma, where);
    const completed = await autoComplete(this.prisma, where);
    return { expired, completed };
  }

  /** Toàn hệ thống (chỉ khi ORDER_JOBS_ENABLED=true). */
  async runAll() {
    try {
      const r = await this.run({});
      this.log.log(`Quét toàn hệ thống: ${r.expired} đơn hết hạn, ${r.completed} đơn tự hoàn thành`);
    } catch (e) {
      this.log.error(`Quét toàn hệ thống lỗi: ${(e as Error).message}`);
    }
  }

  /** Quét đơn của riêng một NCC (vendorId = VendorProfiles.Id) hoặc một khách (coupleId = Users.Id). Lỗi không làm hỏng việc đọc. */
  async sweep(scope: { vendorId: string } | { coupleId: string }) {
    const key = 'vendorId' in scope ? `v:${scope.vendorId}` : `c:${scope.coupleId}`;
    const now = Date.now();
    if (now - (this.last.get(key) ?? 0) < MIN_GAP_MS) return;
    this.last.set(key, now);
    const where: Prisma.ordersWhereInput = 'vendorId' in scope ? { vendor_id: scope.vendorId } : { weddings: { user_id: scope.coupleId } };
    try {
      await this.run(where);
    } catch (e) {
      this.log.error(`Quét ${key} lỗi: ${(e as Error).message}`);
    }
  }

  /** Bỏ giới hạn tần suất (dùng khi vừa thao tác xong và cần trạng thái mới ngay). */
  forget(scope: { vendorId: string } | { coupleId: string }) {
    this.last.delete('vendorId' in scope ? `v:${scope.vendorId}` : `c:${scope.coupleId}`);
  }
}
