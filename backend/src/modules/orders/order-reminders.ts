import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { DUE_SOON_DAYS, OVERDUE_MAX_DAYS, dmyOf, ownerOf, reminderStage, remindersFor, taskDigest } from '../weddings/task-owner';
import { addDaysYmd, startOfDayVn, todayVn, ymdOf } from './order-rules';

/*
 * Nhắc hạn việc chi tiết của đơn đã cọc (docs/TIMELINE.md mục 8.2). Idempotent: mỗi (người nhận, việc, loại nhắc, hạn) chỉ một thông báo,
 * nên chạy lặp hoặc chạy song song không gửi trùng. Đổi hạn việc thì được nhắc lại theo hạn mới.
 */

const MAX_TASKS = 300;

/** Quét việc Todo của đơn Deposited trong `scope` (đơn của một NCC / một khách / toàn hệ thống), tạo thông báo còn thiếu. Trả số thông báo mới. */
export async function remindTaskDeadlines(prisma: PrismaService, scope: Prisma.ordersWhereInput = {}, today = todayVn()): Promise<number> {
  const from = new Date(`${addDaysYmd(today, -OVERDUE_MAX_DAYS)}T00:00:00Z`);
  const to = new Date(`${addDaysYmd(today, DUE_SOON_DAYS)}T00:00:00Z`);
  const tasks = await prisma.timeline_tasks.findMany({
    where: { status: 'Todo', task_type: 'Detail', order_id: { not: null }, scheduled_date: { gte: from, lte: to }, orders: { is: { ...scope, status: 'Deposited' } } },
    select: {
      id: true,
      title: true,
      task_code: true,
      scheduled_date: true,
      orders: { select: { order_code: true, weddings: { select: { user_id: true } }, vendor_profiles: { select: { user_id: true, business_name: true } } } },
    },
    orderBy: { scheduled_date: 'asc' },
    take: MAX_TASKS,
  });

  let created = 0;
  for (const t of tasks) {
    const o = t.orders;
    if (!o || !t.scheduled_date) continue;
    const due = ymdOf(t.scheduled_date);
    const stage = reminderStage(due, today);
    if (!stage) continue;
    const reminders = remindersFor({ title: t.title ?? '', orderCode: o.order_code ?? '', vendorName: o.vendor_profiles?.business_name ?? '', due, owner: ownerOf(t.task_code) }, stage);
    for (const r of reminders) {
      const userId = r.to === 'COUPLE' ? o.weddings?.user_id : o.vendor_profiles?.user_id;
      if (!userId) continue;
      try {
        const dup = await prisma.notifications.count({ where: { user_id: userId, type: r.type, reference_type: 'TimelineTask', reference_id: t.id, content: { contains: dmyOf(due) } } });
        if (dup) continue;
        await notify(prisma, { userId, type: r.type, title: r.title, content: r.content, referenceType: 'TimelineTask', referenceId: t.id });
        created++;
      } catch {
        /* thông báo chỉ là phụ: lỗi một việc không làm hỏng các việc còn lại */
      }
    }
  }
  return created;
}

/**
 * Tổng hợp mỗi ngày cho khách về việc KHÔNG gắn đơn (việc khung, việc tự thêm): sắp đến hạn và quá hạn gom vào MỘT thông báo `TaskDigest`
 * mỗi khách mỗi ngày (giờ VN). `coupleId` (Users.Id) giới hạn cho một khách; bỏ trống là mọi khách (job nền). Trả số thông báo mới.
 */
export async function remindFrameTasks(prisma: PrismaService, coupleId?: string, today = todayVn()): Promise<number> {
  const from = new Date(`${addDaysYmd(today, -OVERDUE_MAX_DAYS)}T00:00:00Z`);
  const to = new Date(`${addDaysYmd(today, DUE_SOON_DAYS)}T00:00:00Z`);
  const rows = await prisma.timeline_tasks.findMany({
    where: {
      status: 'Todo',
      order_id: null,
      OR: [{ task_type: 'Frame' }, { task_code: null }],
      scheduled_date: { gte: from, lte: to },
      weddings: { is: coupleId ? { user_id: coupleId } : {} },
    },
    select: { title: true, scheduled_date: true, wedding_id: true, weddings: { select: { user_id: true } } },
    orderBy: { scheduled_date: 'asc' },
    take: MAX_TASKS,
  });
  const byUser = new Map<string, { weddingId: string; tasks: { title: string; due: string }[] }>();
  for (const r of rows) {
    const userId = r.weddings?.user_id;
    if (!userId || !r.scheduled_date || !r.wedding_id) continue;
    const entry = byUser.get(userId) ?? { weddingId: r.wedding_id, tasks: [] };
    entry.tasks.push({ title: r.title ?? '', due: ymdOf(r.scheduled_date) });
    byUser.set(userId, entry);
  }

  let created = 0;
  const since = startOfDayVn(today);
  for (const [userId, { weddingId, tasks }] of byUser) {
    const digest = taskDigest(tasks, today);
    if (!digest) continue;
    try {
      if (await prisma.notifications.count({ where: { user_id: userId, type: 'TaskDigest', created_date: { gte: since } } })) continue;
      await notify(prisma, { userId, type: 'TaskDigest', title: digest.title, content: digest.content, referenceType: 'Wedding', referenceId: weddingId });
      created++;
    } catch {
      /* thông báo chỉ là phụ */
    }
  }
  return created;
}

