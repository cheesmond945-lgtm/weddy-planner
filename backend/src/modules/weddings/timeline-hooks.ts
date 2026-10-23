import type { PrismaService } from '../../prisma/prisma.service';

const DAY = 86_400_000;
const ymdOf = (d: Date) => d.toISOString().slice(0, 10);
/** Ngày hôm nay theo giờ Việt Nam, dạng UTC nửa đêm (khớp cột @db.Date). */
export const todayVNDate = () => new Date(`${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)}T00:00:00Z`);

/** Rải n mốc đều giữa start và end (gồm cả hai đầu mút trong khoảng, không vượt end). */
function spread(start: Date, end: Date, n: number) {
  const span = Math.max(0, end.getTime() - start.getTime());
  return Array.from({ length: n }, (_, i) => new Date(start.getTime() + Math.floor((span * (i + 1)) / (n + 1) / DAY) * DAY));
}

/**
 * Khi đơn được đặt cọc: việc "Chốt ..." của hạng mục xong, mở các việc chi tiết (mẫu lấy từ các việc Detail của hạng mục
 * trong CSDL) gắn với đơn, hạn rải đều từ 2 ngày nữa tới trước ngày sự kiện.
 */
export async function onOrderDeposited(prisma: PrismaService, order: { id: string; wedding_id: string; vendor_id: string; event_date: Date }) {
  const vendor = await prisma.vendor_profiles.findUnique({ where: { id: order.vendor_id }, select: { category_id: true } });
  if (!vendor) return;
  const categoryId = vendor.category_id;
  const now = new Date();

  await prisma.timeline_tasks.updateMany({
    where: { wedding_id: order.wedding_id, category_id: categoryId, task_type: 'Frame', task_code: { endsWith: '_BOOK' }, status: 'Todo' },
    data: { status: 'Done', completed_date: now },
  });

  const templates = await prisma.timeline_tasks.findMany({ where: { category_id: categoryId, task_type: 'Detail', task_code: { not: null } }, orderBy: [{ display_order: 'asc' }], distinct: ['task_code'] });
  const existing = new Set((await prisma.timeline_tasks.findMany({ where: { wedding_id: order.wedding_id, task_code: { not: null } }, select: { task_code: true } })).map((t) => t.task_code));
  const todo = templates.filter((t) => !existing.has(t.task_code));
  if (!todo.length) return;

  const start = new Date(todayVNDate().getTime() + 2 * DAY);
  const last = new Date(order.event_date.getTime() - DAY);
  const end = last.getTime() > start.getTime() ? last : start;
  const dates = spread(start, end, todo.length);
  await prisma.timeline_tasks.createMany({
    data: todo.map((t, i) => ({
      wedding_id: order.wedding_id,
      category_id: categoryId,
      order_id: order.id,
      title: t.title,
      scheduled_date: dates[i],
      status: 'Todo',
      task_type: 'Detail',
      task_code: t.task_code,
      display_order: t.display_order,
    })),
  });
}

/** Khi lưu thông tin đám cưới: hạng mục mới chọn mà chưa có việc nào thì thêm các việc khung của hạng mục đó. */
export async function onWeddingCategories(prisma: PrismaService, weddingId: string, weddingDate: Date, categoryIds: string[]) {
  if (!categoryIds.length) return;
  const have = new Set((await prisma.timeline_tasks.findMany({ where: { wedding_id: weddingId, category_id: { in: categoryIds } }, select: { category_id: true } })).map((t) => t.category_id));
  const missing = categoryIds.filter((id) => !have.has(id));
  if (!missing.length) return;

  const templates = await prisma.timeline_tasks.findMany({ where: { category_id: { in: missing }, task_type: 'Frame', task_code: { not: null } }, orderBy: [{ display_order: 'asc' }], distinct: ['category_id', 'task_code'] });
  const existingCodes = new Set((await prisma.timeline_tasks.findMany({ where: { wedding_id: weddingId, task_code: { not: null } }, select: { task_code: true } })).map((t) => t.task_code));
  const start = new Date(todayVNDate().getTime() + 2 * DAY);
  const end = new Date(weddingDate.getTime() - DAY);

  for (const categoryId of missing) {
    const mine = templates.filter((t) => t.category_id === categoryId && !existingCodes.has(t.task_code));
    if (!mine.length) continue;
    // Các việc khung nằm trong nửa đầu thời gian chuẩn bị
    const half = new Date(start.getTime() + Math.max(0, end.getTime() - start.getTime()) / 2);
    const dates = spread(start, half.getTime() > start.getTime() ? half : start, mine.length);
    await prisma.timeline_tasks.createMany({
      data: mine.map((t, i) => ({
        wedding_id: weddingId,
        category_id: categoryId,
        title: t.title,
        scheduled_date: dates[i],
        status: 'Todo',
        task_type: 'Frame',
        task_code: t.task_code,
        display_order: t.display_order,
      })),
      skipDuplicates: true,
    });
  }
}

export const toYmd = ymdOf;
