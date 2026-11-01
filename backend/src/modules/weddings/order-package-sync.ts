/*
 * Sinh việc chi tiết của đơn đã cọc từ package_tasks của các gói gắn với đơn. Chỉ phụ thuộc một giao diện CSDL tối thiểu (SyncDb)
 * nên test được bằng CSDL giả; timeline-hooks.ts truyền PrismaService vào.
 */
import { packagesOfOrder } from './package-task-meta.ts';
import { orderTaskRows, type PackageTaskRef } from './timeline-rows.ts';

const ymdOf = (d: Date) => d.toISOString().slice(0, 10);
const vnYmd = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

/** Phần của Prisma mà syncOrderPackageTasks dùng (khai báo kiểu method để PrismaService gán được). */
export interface SyncDb {
  orders: {
    findUnique(args: unknown): Promise<{
      id: string;
      wedding_id: string | null;
      event_date: Date | null;
      package_id: string | null;
      order_items: { package_id: string | null }[];
      vendor_profiles: { category_id: string | null; business_name: string | null } | null;
      payments: { paid_date: Date | null } | null;
    } | null>;
  };
  package_tasks: {
    findMany(args: unknown): Promise<{ id: string; package_id: string; title: string; note: string | null; owner: string; offset_days: number }[]>;
  };
  timeline_tasks: {
    findMany(args: unknown): Promise<{ task_code: string | null }[]>;
    createMany(args: { data: unknown[]; skipDuplicates?: boolean }): Promise<unknown>;
  };
}

/**
 * Mỗi việc trong gói (mọi gói của đơn gộp lại theo thứ tự gói của đơn) thành một dòng timeline_tasks task_code 'PKG:<id>', cộng việc thanh toán
 * 'PAY:<orderId>'. Việc của khách bắt đầu Waiting, còn lại Todo. Chạy lại cho cùng đơn thì không sinh trùng.
 * Đơn không gắn gói, hoặc gói chưa khai việc: chỉ sinh việc thanh toán, trả vendorProcessMissing = true.
 */
export async function syncOrderPackageTasks(db: SyncDb, orderId: string, now = new Date()): Promise<{ created: number; vendorProcessMissing: boolean }> {
  const order = await db.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      wedding_id: true,
      event_date: true,
      package_id: true,
      order_items: { select: { package_id: true } },
      vendor_profiles: { select: { category_id: true, business_name: true } },
      payments: { select: { paid_date: true } },
    },
  });
  if (!order?.wedding_id || !order.event_date) return { created: 0, vendorProcessMissing: false };

  const packageIds = packagesOfOrder(order);
  const found = packageIds.length ? await db.package_tasks.findMany({ where: { package_id: { in: packageIds }, deleted_at: null }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] }) : [];
  const tasks: PackageTaskRef[] = packageIds
    .flatMap((pid) => found.filter((t) => t.package_id === pid))
    .map((t) => ({ id: t.id, title: t.title, note: t.note, owner: t.owner as PackageTaskRef['owner'], offsetDays: t.offset_days }));

  const existing = new Set((await db.timeline_tasks.findMany({ where: { order_id: order.id, task_code: { not: null } }, select: { task_code: true } })).map((t) => t.task_code!));
  const today = vnYmd(now);
  const { rows, vendorProcessMissing } = orderTaskRows({
    weddingId: order.wedding_id,
    orderId: order.id,
    categoryId: order.vendor_profiles?.category_id ?? null,
    vendorName: order.vendor_profiles?.business_name ?? '',
    ctx: { today, event: ymdOf(order.event_date), deposit: order.payments?.paid_date ? vnYmd(order.payments.paid_date) : today },
    tasks,
    existingCodes: existing,
  });
  if (rows.length) await db.timeline_tasks.createMany({ data: rows, skipDuplicates: true });
  return { created: rows.length, vendorProcessMissing };
}
