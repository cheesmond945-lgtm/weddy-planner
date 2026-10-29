import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { cancelPlan, depositDetailPlan, frameRows, type ServiceRef } from './timeline-rows';
import { replanOnWeddingDateChange } from './timeline-schedule';
import { SERVICE_BY_CATEGORY_NAME, TIMELINE_TEMPLATES, templateOf, type ServiceKey } from './timeline-templates';

const ymdOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
/** Ngày theo giờ Việt Nam của một thời điểm, dạng "YYYY-MM-DD". */
export const vnYmd = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
/** Ngày hôm nay theo giờ Việt Nam, dạng UTC nửa đêm (khớp cột @db.Date). */
export const todayVNDate = () => new Date(`${vnYmd(new Date())}T00:00:00Z`);

export const toYmd = ymdOf;

async function serviceOfCategory(prisma: PrismaService, categoryId: string): Promise<ServiceRef | null> {
  const cat = await prisma.service_categories.findUnique({ where: { id: categoryId }, select: { name: true } });
  const key = cat?.name ? SERVICE_BY_CATEGORY_NAME[cat.name] : undefined;
  return key ? { key, categoryId } : null;
}

/**
 * Khi lưu thông tin đám cưới: sinh timeline khung từ mẫu (timeline-templates.ts), hạn tính từ ngày cưới và hôm nay.
 * Chỉ thêm việc CHƯA có (theo task_code): việc đã sinh không bao giờ bị dời hay tính lại; hạng mục mới chọn thêm sau đó chỉ được thêm việc của nó.
 */
export async function onWeddingCategories(prisma: PrismaService, weddingId: string, weddingDate: Date, categoryIds: string[]) {
  const cats = categoryIds.length ? await prisma.service_categories.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }) : [];
  const services: ServiceRef[] = cats.flatMap((c) => (c.name && SERVICE_BY_CATEGORY_NAME[c.name] ? [{ key: SERVICE_BY_CATEGORY_NAME[c.name], categoryId: c.id }] : []));
  const rows = frameRows(TIMELINE_TEMPLATES, { weddingId, wedding: ymdOf(weddingDate), today: vnYmd(new Date()), services });
  const existing = new Set((await prisma.timeline_tasks.findMany({ where: { wedding_id: weddingId, task_code: { not: null } }, select: { task_code: true } })).map((t) => t.task_code));
  const todo = rows.filter((r) => !existing.has(r.task_code));
  if (!todo.length) return;
  await prisma.timeline_tasks.createMany({ data: todo, skipDuplicates: true });
}

/**
 * Sinh việc chi tiết của một đơn đã cọc (depositDetailPlan): thay việc chưa xong của đơn khác cùng hạng mục, chèn việc còn thiếu.
 * Chạy lại cho cùng một đơn thì không đổi gì. Trả số dòng đã xóa / đã tạo.
 */
export async function syncOrderDetails(prisma: PrismaService, orderId: string): Promise<{ deleted: number; created: number }> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { id: true, wedding_id: true, event_date: true, vendor_profiles: { select: { category_id: true } }, payments: { select: { paid_date: true } } },
  });
  if (!order?.wedding_id || !order.event_date || !order.vendor_profiles?.category_id) return { deleted: 0, created: 0 };
  const service = await serviceOfCategory(prisma, order.vendor_profiles.category_id);
  const wedding = await prisma.weddings.findUnique({ where: { id: order.wedding_id }, select: { wedding_date: true } });
  if (!service || !wedding?.wedding_date) return { deleted: 0, created: 0 };

  const tasks = await prisma.timeline_tasks.findMany({ where: { wedding_id: order.wedding_id, task_code: { not: null } }, select: { id: true, task_code: true, status: true, order_id: true, scheduled_date: true } });
  // Ngày chụp album S: đã có (dịch vụ chụp ảnh cọc trước) thì dùng đúng ngày đó; chưa có thì tính tạm
  const album = tasks.find((t) => t.task_code === 'PHOTO_ALBUM_SHOOT')?.scheduled_date;
  const today = vnYmd(new Date());
  const deposit = order.payments?.paid_date ? vnYmd(order.payments.paid_date) : today;
  const plan = depositDetailPlan(TIMELINE_TEMPLATES, {
    weddingId: order.wedding_id,
    orderId: order.id,
    service,
    ctx: { today, wedding: ymdOf(wedding.wedding_date), event: ymdOf(order.event_date), deposit, albumDate: album ? ymdOf(album) : undefined },
    existing: tasks.map((t) => ({ id: t.id, code: t.task_code!, status: t.status, orderId: t.order_id })),
  });
  if (!plan.deleteIds.length && !plan.rows.length) return { deleted: 0, created: 0 };
  await prisma.$transaction(async (tx) => {
    if (plan.deleteIds.length) await tx.timeline_tasks.deleteMany({ where: { id: { in: plan.deleteIds } } });
    if (plan.rows.length) await tx.timeline_tasks.createMany({ data: plan.rows });
  });
  return { deleted: plan.deleteIds.length, created: plan.rows.length };
}

/**
 * Khi đơn được đặt cọc: Mốc chốt của dịch vụ xong, mở các việc chi tiết của dịch vụ đó gắn với đơn (syncOrderDetails), hạn tính từ D
 * (ngày cọc thật) và E (ngày thực hiện của đơn). Dịch vụ cọc trước giữ nguyên ngày, dịch vụ cọc sau chỉ sinh thêm việc của nó.
 */
export async function onOrderDeposited(prisma: PrismaService, order: { id: string; wedding_id: string; vendor_id: string; event_date: Date }) {
  const vendor = await prisma.vendor_profiles.findUnique({ where: { id: order.vendor_id }, select: { category_id: true } });
  if (!vendor?.category_id) return;
  await prisma.timeline_tasks.updateMany({
    where: { wedding_id: order.wedding_id, category_id: vendor.category_id, task_type: 'Frame', task_code: { endsWith: '_BOOK' }, status: 'Todo' },
    data: { status: 'Done', completed_date: new Date() },
  });
  await syncOrderDetails(prisma, order.id);
}

/**
 * Khi NCC hủy đơn đã cọc: xóa các việc chi tiết gắn với đơn khỏi timeline của khách. Còn đơn khác cùng hạng mục đã cọc thì đơn đó
 * (cọc mới nhất) nhận lại việc chi tiết; không còn thì mở lại việc "Chốt ..." (đã xong lúc cọc) để khách tìm và chốt NCC khác.
 */
export async function onOrderCancelled(prisma: PrismaService, order: { id: string; wedding_id: string; vendor_id: string }) {
  const vendor = await prisma.vendor_profiles.findUnique({ where: { id: order.vendor_id }, select: { category_id: true } });
  const details = await prisma.timeline_tasks.findMany({ where: { order_id: order.id, task_type: 'Detail' }, select: { id: true } });
  const others = vendor
    ? await prisma.orders.findMany({
        where: { wedding_id: order.wedding_id, id: { not: order.id }, status: { in: ['Deposited', 'Completed'] }, vendor_profiles: { category_id: vendor.category_id } },
        select: { id: true, status: true, payments: { select: { paid_date: true } } },
      })
    : [];
  const plan = cancelPlan({ orderId: order.id, details, others: others.map((o) => ({ id: o.id, status: o.status ?? '', paidAt: o.payments?.paid_date?.getTime() ?? 0 })) });
  if (plan.deleteIds.length) await prisma.timeline_tasks.deleteMany({ where: { id: { in: plan.deleteIds } } });
  if (!vendor) return;
  if (plan.handOverTo) await syncOrderDetails(prisma, plan.handOverTo);
  if (plan.reopenBook) {
    await prisma.timeline_tasks.updateMany({
      where: { wedding_id: order.wedding_id, category_id: vendor.category_id, task_type: 'Frame', task_code: { endsWith: '_BOOK' }, status: 'Done' },
      data: { status: 'Todo', completed_date: null },
    });
  }
}

type Db = PrismaService | Prisma.TransactionClient;

export interface DateChangePlan {
  /** Việc đổi hạn, để xem trước */
  changes: { id: string; title: string; oldDate: string; newDate: string }[];
  /** Dòng cần UPDATE khi xác nhận */
  updates: { id: string; date: Date }[];
  /** Đơn đã cọc có ngày thực hiện khác ngày cưới mới */
  warnings: { orderCode: string; vendorName: string; serviceId: string; eventDate: string; message: string }[];
}

/**
 * Khi khách đổi ngày cưới: tính các việc sẽ đổi hạn (replanOnWeddingDateChange) và cảnh báo đơn lệch ngày. Chỉ đọc;
 * nơi gọi tự UPDATE `updates` (xem trước thì không, lưu ngày cưới thì trong cùng transaction).
 */
export async function planWeddingDateChange(db: Db, weddingId: string, newWedding: string): Promise<DateChangePlan> {
  const [tasks, cats, orders] = await Promise.all([
    db.timeline_tasks.findMany({ where: { wedding_id: weddingId }, select: { id: true, title: true, task_code: true, scheduled_date: true, status: true, order_id: true, category_id: true } }),
    db.service_categories.findMany({ select: { id: true, name: true } }),
    db.orders.findMany({
      where: { wedding_id: weddingId },
      select: { id: true, order_code: true, status: true, event_date: true, payments: { select: { paid_date: true } }, vendor_profiles: { select: { id: true, business_name: true, category_id: true } } },
    }),
  ]);
  const keyOf = (categoryId: string | null) => {
    const name = cats.find((c) => c.id === categoryId)?.name;
    return name ? SERVICE_BY_CATEGORY_NAME[name] : undefined;
  };
  const today = vnYmd(new Date());
  const services = [...new Set(tasks.map((t) => keyOf(t.category_id)).filter((k): k is ServiceKey => !!k))];
  const owners = new Set(tasks.map((t) => t.order_id).filter((x): x is string => !!x));
  const deposited = orders.flatMap((o) => {
    const service = keyOf(o.vendor_profiles?.category_id ?? null);
    if (!service || !owners.has(o.id) || !o.event_date) return [];
    return [{ service, deposit: o.payments?.paid_date ? vnYmd(o.payments.paid_date) : today, event: ymdOf(o.event_date) }];
  });
  const existing = tasks.filter((t) => t.task_code && templateOf(t.task_code)).map((t) => ({ code: t.task_code!, date: ymdOf(t.scheduled_date), done: t.status === 'Done' }));

  const changes = replanOnWeddingDateChange(TIMELINE_TEMPLATES, { wedding: newWedding, today, tasks: existing, services, orders: deposited });
  const byCode = new Map(tasks.map((t) => [t.task_code, t]));
  const warnings = orders
    .filter((o) => o.status === 'Deposited' && o.event_date && ymdOf(o.event_date) !== newWedding)
    .map((o) => {
      const e = ymdOf(o.event_date);
      const vendorName = o.vendor_profiles?.business_name ?? '';
      const [y, m, d] = e.split('-');
      return { orderCode: o.order_code ?? '', vendorName, serviceId: o.vendor_profiles?.id ?? '', eventDate: e, message: `Đơn ${o.order_code} của ${vendorName} thực hiện ngày ${d}/${m}/${y}, khác ngày cưới mới. Nhắn NCC để cập nhật đơn.` };
    });
  return {
    changes: changes.map((c) => ({ id: byCode.get(c.code)!.id, title: byCode.get(c.code)!.title ?? '', oldDate: c.from, newDate: c.to })),
    updates: changes.map((c) => ({ id: byCode.get(c.code)!.id, date: new Date(`${c.to}T00:00:00Z`) })),
    warnings,
  };
}
