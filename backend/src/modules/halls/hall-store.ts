/*
 * Đọc lịch bận theo sảnh từ CSDL (orders.package_id + package_busy_dates), dùng chung cho HallsService và luồng đơn hàng
 * (chặn đặt trùng khi NCC gửi / sửa đơn, khi khách đặt cọc). Luật nằm ở hall-busy.ts.
 */
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { BUSY_ORDER_STATUSES, HALL_CATEGORY_SLUG, hallConflict, type BusyOrder, type BusySource, type ManualBusy } from './hall-busy';

type Db = PrismaService | Prisma.TransactionClient;

const at = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const ymdOf = (d: Date) => d.toISOString().slice(0, 10);

/** Danh mục này có lịch bận theo sảnh không (chỉ Trung tâm tổ chức sự kiện). */
export async function usesHalls(db: Db, categoryId: string | null | undefined): Promise<boolean> {
  if (!categoryId) return false;
  const cat = await db.service_categories.findUnique({ where: { id: categoryId }, select: { name: true } });
  return categorySlug(cat?.name ?? null) === HALL_CATEGORY_SLUG;
}

/** Đơn Đã cọc / Hoàn thành và các lần đánh dấu bận thủ công của các sảnh, giao với [from, to]. */
export async function loadBusy(db: Db, packageIds: readonly string[], from: string, to: string): Promise<{ orders: BusyOrder[]; manual: ManualBusy[] }> {
  if (!packageIds.length) return { orders: [], manual: [] };
  const [orders, manual] = await Promise.all([
    db.orders.findMany({
      where: { package_id: { in: [...packageIds] }, status: { in: BUSY_ORDER_STATUSES }, event_date: { gte: at(from), lte: at(to) } },
      select: { id: true, order_code: true, customer_name: true, package_id: true, event_date: true, status: true },
    }),
    db.package_busy_dates.findMany({
      where: { package_id: { in: [...packageIds] }, start_date: { lte: at(to) }, end_date: { gte: at(from) } },
      orderBy: [{ start_date: 'asc' }, { created_date: 'asc' }],
    }),
  ]);
  return {
    orders: orders.flatMap((o) =>
      o.package_id && o.event_date
        ? [{ orderId: o.id, orderCode: o.order_code ?? '', customerName: o.customer_name ?? '', packageId: o.package_id, date: ymdOf(o.event_date), status: o.status ?? '' }]
        : [],
    ),
    manual: manual.map((m) => ({ id: m.id, packageId: m.package_id, startDate: ymdOf(m.start_date), endDate: ymdOf(m.end_date), reason: m.reason })),
  };
}

/** Sảnh bận ngày `date` vì đâu (bỏ qua đơn `exceptOrderId`); null nếu còn trống. */
export async function findHallConflict(db: Db, packageId: string, date: string, exceptOrderId?: string): Promise<BusySource | null> {
  const { orders, manual } = await loadBusy(db, [packageId], date, date);
  return hallConflict(packageId, date, orders, manual, exceptOrderId);
}

/** Khóa (sảnh, ngày) trong transaction: hai khoản cọc cùng sảnh cùng ngày không chạy song song (chỉ mục ux_orders_package_busy là lớp chặn cuối). */
export async function lockHallDay(tx: Prisma.TransactionClient, packageId: string, date: string) {
  await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`hall:${packageId}:${date}`}))`;
}
