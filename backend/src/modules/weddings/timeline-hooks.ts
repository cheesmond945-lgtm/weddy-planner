import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { syncOrderPackageTasks as syncOrderPackageTasksOf, type SyncDb } from './order-package-sync';
import { loadPackageMeta } from './package-task-meta';
import { cancelPlan, frameRows, isOrderTaskCode, replanOrderTasks, type ServiceRef } from './timeline-rows';
import { replanOnWeddingDateChange } from './timeline-schedule';
import { customerDateWarning, dateChangeIssue, vendorDateNotice } from './timeline-rules';
import { SERVICE_BY_CATEGORY_NAME, TIMELINE_TEMPLATES, templateOf, type ServiceKey } from './timeline-templates';

const ymdOf = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
/** Ngày theo giờ Việt Nam của một thời điểm, dạng "YYYY-MM-DD". */
export const vnYmd = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
/** Ngày hôm nay theo giờ Việt Nam, dạng UTC nửa đêm (khớp cột @db.Date). */
export const todayVNDate = () => new Date(`${vnYmd(new Date())}T00:00:00Z`);

export const toYmd = ymdOf;

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
 * Sinh việc chi tiết của một đơn đã cọc từ package_tasks của các gói gắn với đơn (xem order-package-sync.ts).
 * Trả vendorProcessMissing = true khi đơn không có việc nào của gói (NCC chưa khai quy trình).
 */
export const syncOrderPackageTasks = (prisma: PrismaService, orderId: string) => syncOrderPackageTasksOf(prisma as unknown as SyncDb, orderId);

/**
 * Khi NCC sửa ngày thực hiện của đơn đã cọc: hạn các việc gói (PKG) và thanh toán (PAY) chưa xong và CHƯA chốt ngày được tính lại theo E mới
 * (theo package_tasks của từng việc, kể cả việc đã xóa mềm). Việc đã xong, việc đã chốt giữ ngày; việc chốt trước E mà ngày chốt nằm sau E mới
 * thì trả vào needsRecheck. Việc chi tiết cũ (mã mẫu) không đụng tới.
 */
export async function onOrderEventDateChanged(prisma: PrismaService, orderId: string): Promise<{ updated: number; needsRecheck: string[] }> {
  const order = await prisma.orders.findUnique({ where: { id: orderId }, select: { event_date: true, payments: { select: { paid_date: true } } } });
  if (!order?.event_date) return { updated: 0, needsRecheck: [] };
  const mine = await prisma.timeline_tasks.findMany({
    where: { order_id: orderId, task_type: 'Detail', task_code: { not: null } },
    select: { id: true, task_code: true, status: true, scheduled_date: true, task_confirmations: { select: { task_id: true } } },
  });
  const tasks = mine.filter((t) => isOrderTaskCode(t.task_code) && t.scheduled_date);
  if (!tasks.length) return { updated: 0, needsRecheck: [] };
  const meta = await loadPackageMeta(prisma, tasks.map((t) => t.task_code));
  const today = vnYmd(new Date());
  const plan = replanOrderTasks({
    ctx: { today, event: ymdOf(order.event_date), deposit: order.payments?.paid_date ? vnYmd(order.payments.paid_date) : today },
    tasks: tasks.map((t) => ({ id: t.id, code: t.task_code!, status: t.status, confirmed: !!t.task_confirmations, date: ymdOf(t.scheduled_date) })),
    offsets: new Map([...meta].map(([id, m]) => [id, m.offsetDays])),
  });
  if (plan.updates.length) {
    await prisma.$transaction(plan.updates.map((u) => prisma.timeline_tasks.update({ where: { id: u.id }, data: { scheduled_date: new Date(`${u.date}T00:00:00Z`) } })));
  }
  return { updated: plan.updates.length, needsRecheck: plan.needsRecheck };
}

/**
 * Khi đơn được đặt cọc: Mốc chốt của dịch vụ xong, rồi sinh việc chi tiết của đơn từ gói (syncOrderPackageTasks).
 * Trả vendorProcessMissing = true khi đơn không có việc nào của gói (NCC chưa khai quy trình).
 */
export async function onOrderDeposited(prisma: PrismaService, order: { id: string; wedding_id: string; vendor_id: string; event_date: Date }) {
  const vendor = await prisma.vendor_profiles.findUnique({ where: { id: order.vendor_id }, select: { category_id: true } });
  if (!vendor?.category_id) return { created: 0, vendorProcessMissing: false };
  await prisma.timeline_tasks.updateMany({
    where: { wedding_id: order.wedding_id, category_id: vendor.category_id, task_type: 'Frame', task_code: { endsWith: '_BOOK' }, status: { not: 'Done' } },
    data: { status: 'Done', completed_date: new Date() },
  });
  return syncOrderPackageTasks(prisma, order.id);
}

/**
 * Khi NCC hủy đơn đã cọc: gỡ các việc chi tiết CHƯA xong của đơn khỏi timeline của khách (việc đã xong giữ lại). Còn đơn khác cùng hạng mục
 * đã cọc / hoàn thành thì Mốc chốt vẫn xong; không còn thì mở lại việc "Chốt ..." (đã xong lúc cọc) để khách tìm và chốt NCC khác.
 */
export async function onOrderCancelled(prisma: PrismaService, order: { id: string; wedding_id: string; vendor_id: string }) {
  const vendor = await prisma.vendor_profiles.findUnique({ where: { id: order.vendor_id }, select: { category_id: true } });
  const details = await prisma.timeline_tasks.findMany({ where: { order_id: order.id, task_type: 'Detail' }, select: { id: true, status: true } });
  const others = vendor
    ? await prisma.orders.findMany({
        where: { wedding_id: order.wedding_id, id: { not: order.id }, status: { in: ['Deposited', 'Completed'] }, vendor_profiles: { category_id: vendor.category_id } },
        select: { id: true, status: true },
      })
    : [];
  const plan = cancelPlan({ details, others: others.map((o) => ({ id: o.id, status: o.status ?? '' })) });
  if (plan.deleteIds.length) await prisma.timeline_tasks.deleteMany({ where: { id: { in: plan.deleteIds } } });
  if (!vendor) return;
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
  /** Đơn có ngày thực hiện lệch ngày cưới mới: đã cọc khác ngày, hoặc sau ngày cưới mới (chưa cọc thì kèm blocksDeposit) */
  warnings: { orderCode: string; vendorName: string; serviceId: string; eventDate: string; message: string; kind: 'DIFFERENT' | 'AFTER_WEDDING'; blocksDeposit: boolean }[];
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
  const existing = tasks.filter((t) => t.task_code && templateOf(t.task_code)).map((t) => ({ code: t.task_code!, date: ymdOf(t.scheduled_date), done: t.status === 'Done' }));

  const changes = replanOnWeddingDateChange(TIMELINE_TEMPLATES, { wedding: newWedding, today, tasks: existing, services });
  const byCode = new Map(tasks.map((t) => [t.task_code, t]));
  const warnings = orders.flatMap((o) => {
    const eventDate = ymdOf(o.event_date);
    const view = { orderCode: o.order_code ?? '', status: o.status, eventDate, vendorName: o.vendor_profiles?.business_name ?? '' };
    const issue = dateChangeIssue(view, newWedding);
    if (!issue) return [];
    return [{ orderCode: view.orderCode, vendorName: view.vendorName, serviceId: o.vendor_profiles?.id ?? '', eventDate, kind: issue.kind, blocksDeposit: issue.blocksDeposit, message: customerDateWarning(view, issue, newWedding) }];
  });
  return {
    changes: changes.map((c) => ({ id: byCode.get(c.code)!.id, title: byCode.get(c.code)!.title ?? '', oldDate: c.from, newDate: c.to })),
    updates: changes.map((c) => ({ id: byCode.get(c.code)!.id, date: new Date(`${c.to}T00:00:00Z`) })),
    warnings,
  };
}

/**
 * Sau khi khách lưu ngày cưới mới: báo các NCC có đơn đang giữ ngày thực hiện sau ngày cưới mới (đã cọc, hoặc chưa cọc nhưng đang chờ / chỉnh sửa)
 * để họ cập nhật đơn. Chỉ báo trường hợp AFTER_WEDDING (cần hành động); lỗi ghi thông báo không làm hỏng việc đổi ngày cưới.
 */
export async function notifyVendorsOfWeddingDate(prisma: PrismaService, weddingId: string, newWedding: string) {
  const orders = await prisma.orders.findMany({
    where: { wedding_id: weddingId, status: { in: ['Deposited', 'Pending', 'NeedRevision'] } },
    select: { id: true, order_code: true, status: true, event_date: true, vendor_profiles: { select: { user_id: true, business_name: true } } },
  });
  for (const o of orders) {
    const view = { orderCode: o.order_code ?? '', status: o.status, eventDate: ymdOf(o.event_date), vendorName: o.vendor_profiles?.business_name ?? '' };
    if (dateChangeIssue(view, newWedding)?.kind !== 'AFTER_WEDDING' || !o.vendor_profiles?.user_id) continue;
    await notify(prisma, {
      userId: o.vendor_profiles.user_id,
      type: 'WeddingDateChanged',
      title: 'Khách đã đổi ngày cưới',
      content: vendorDateNotice(view, newWedding),
      referenceType: 'Order',
      referenceId: o.id,
    }).catch(() => undefined);
  }
}
