import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { publish } from '../realtime/realtime.bus';
import { CALENDAR_MAX_DAYS, calendarItems } from '../weddings/calendar-items';
import { canTick, orderProgress, ownerOf } from '../weddings/task-owner';
import { OrderJobsService } from './order-jobs.service';
import { UUID, fail, todayVn, ymdOf } from './order-rules';

/**
 * "Tiến độ đơn" phía NCC (docs/TIMELINE.md mục 8): NCC chỉ thấy các việc chi tiết GẮN VỚI ĐƠN của mình (không thấy việc cá nhân của khách),
 * tick được việc của NCC / hai bên, việc của khách chỉ xem. Dùng chung bảng timeline_tasks với timeline của khách nên khách thấy ngay.
 */
@Injectable()
export class OrderTasksService {
  constructor(private readonly prisma: PrismaService, private readonly jobs: OrderJobsService) {}

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true, business_name: true } });
    return v ?? fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
  }

  private async ownedOrder(userId: string, orderId: string) {
    const vendor = await this.vendorOf(userId);
    await this.jobs.sweep({ vendorId: vendor.id });
    const o = UUID.test(orderId)
      ? await this.prisma.orders.findFirst({ where: { id: orderId, vendor_id: vendor.id }, select: { id: true, order_code: true, status: true, event_date: true, weddings: { select: { user_id: true } } } })
      : null;
    return { vendor, order: o ?? fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404) };
  }

  private rowOf(t: { id: string; title: string | null; task_code: string | null; scheduled_date: Date | null; status: string | null; completed_date: Date | null }, today: string) {
    const owner = ownerOf(t.task_code);
    const due = t.scheduled_date ? ymdOf(t.scheduled_date) : '';
    const done = t.status === 'Done';
    return {
      id: t.id,
      title: t.title ?? '',
      dueDate: due,
      isDone: done,
      completedDate: t.completed_date ? t.completed_date.toISOString() : null,
      owner,
      /** NCC được tick việc này */
      canTick: canTick('VENDOR', owner),
      overdue: !done && !!due && due < today,
    };
  }

  /** Việc chi tiết của một đơn (đơn đã cọc có việc; đơn chưa cọc trả danh sách rỗng) và tóm tắt tiến độ. */
  async list(userId: string, orderId: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    const today = todayVn();
    const rows = await this.prisma.timeline_tasks.findMany({
      where: { order_id: order.id, task_type: 'Detail' },
      orderBy: [{ scheduled_date: 'asc' }, { display_order: 'asc' }],
      select: { id: true, title: true, task_code: true, scheduled_date: true, status: true, completed_date: true },
    });
    const items = rows.map((t) => this.rowOf(t, today));
    return { items, progress: orderProgress(items.map((i) => ({ due: i.dueDate, done: i.isDone, owner: i.owner, title: i.title })), today) };
  }

  /** Tiến độ của mọi đơn đang thực hiện (Deposited) của NCC: { [orderId]: progress }, để hiện nhãn "Trễ tiến độ" ở danh sách đơn. */
  async progress(userId: string) {
    const vendor = await this.vendorOf(userId);
    await this.jobs.sweep({ vendorId: vendor.id });
    const today = todayVn();
    const rows = await this.prisma.timeline_tasks.findMany({
      where: { task_type: 'Detail', orders: { is: { vendor_id: vendor.id, status: 'Deposited' } } },
      select: { order_id: true, task_code: true, title: true, scheduled_date: true, status: true },
    });
    const by = new Map<string, { due: string; done: boolean; owner: ReturnType<typeof ownerOf>; title: string }[]>();
    for (const r of rows) {
      if (!r.order_id || !r.scheduled_date) continue;
      const list = by.get(r.order_id) ?? [];
      list.push({ due: ymdOf(r.scheduled_date), done: r.status === 'Done', owner: ownerOf(r.task_code), title: r.title ?? '' });
      by.set(r.order_id, list);
    }
    return Object.fromEntries([...by].map(([id, tasks]) => [id, orderProgress(tasks, today)]));
  }

  /**
   * Bảng việc (kanban) của NCC: mọi việc chi tiết của các đơn đang thực hiện (Deposited) trong một lần gọi, kèm thông tin đơn để gom theo
   * khách / đơn. Kéo thả giữa cột Cần làm / Đã xong dùng setDone.
   */
  async board(userId: string) {
    const vendor = await this.vendorOf(userId);
    await this.jobs.sweep({ vendorId: vendor.id });
    const today = todayVn();
    const rows = await this.prisma.timeline_tasks.findMany({
      where: { task_type: 'Detail', orders: { is: { vendor_id: vendor.id, status: 'Deposited' } } },
      orderBy: [{ scheduled_date: 'asc' }, { display_order: 'asc' }],
      select: { id: true, title: true, task_code: true, scheduled_date: true, status: true, completed_date: true, orders: { select: { id: true, order_code: true, customer_name: true, event_date: true } } },
    });
    return {
      items: rows.flatMap((t) =>
        t.orders
          ? [{ ...this.rowOf(t, today), orderId: t.orders.id, orderCode: t.orders.order_code ?? '', customerName: t.orders.customer_name ?? '', eventDate: t.orders.event_date ? ymdOf(t.orders.event_date) : '' }]
          : [],
      ),
    };
  }

  /**
   * Lịch làm việc của NCC trong khoảng [from, to] (tối đa CALENDAR_MAX_DAYS ngày): ngày thực hiện của các đơn đang chờ cọc / đã cọc / hoàn thành
   * và việc chi tiết của đơn đã cọc. Gom thành danh sách theo ngày ở weddings/calendar-items.ts.
   */
  async calendar(userId: string, from: unknown, to: unknown) {
    const ok = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
    if (!ok(from) || !ok(to) || from > to) return fail('VALIDATION_ERROR', 'Chọn khoảng ngày hợp lệ (from, to dạng YYYY-MM-DD, from không sau to).', 400);
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > CALENDAR_MAX_DAYS) return fail('VALIDATION_ERROR', `Khoảng ngày tối đa ${CALENDAR_MAX_DAYS} ngày.`, 400);
    const vendor = await this.vendorOf(userId);
    await this.jobs.sweep({ vendorId: vendor.id });
    const gte = new Date(`${from}T00:00:00Z`);
    const lte = new Date(`${to}T00:00:00Z`);
    const orderSel = { id: true, order_code: true, status: true, event_date: true, customer_name: true } as const;
    const [orders, tasks] = await Promise.all([
      this.prisma.orders.findMany({ where: { vendor_id: vendor.id, status: { in: ['Pending', 'NeedRevision', 'Deposited', 'Completed'] }, event_date: { gte, lte } }, select: orderSel }),
      this.prisma.timeline_tasks.findMany({
        where: { task_type: 'Detail', scheduled_date: { gte, lte }, orders: { is: { vendor_id: vendor.id, status: 'Deposited' } } },
        select: { id: true, task_code: true, title: true, scheduled_date: true, status: true, orders: { select: orderSel } },
      }),
    ]);
    const asOrder = (o: (typeof orders)[number]) => ({ id: o.id, code: o.order_code ?? '', status: o.status ?? '', eventDate: o.event_date ? ymdOf(o.event_date) : '', customerName: o.customer_name ?? '' });
    return {
      items: calendarItems({
        orders: orders.map(asOrder),
        tasks: tasks.filter((t) => t.orders && t.scheduled_date).map((t) => ({ id: t.id, code: t.task_code, title: t.title ?? '', due: ymdOf(t.scheduled_date!), done: t.status === 'Done', order: asOrder(t.orders!) })),
        from,
        to,
        today: todayVn(),
      }),
    };
  }

  /** NCC đánh dấu xong / mở lại một việc của NCC (hoặc hai bên). Khách nhận thông báo khi việc xong. */
  async setDone(userId: string, orderId: string, taskId: string, isDone: unknown) {
    const { vendor, order } = await this.ownedOrder(userId, orderId);
    if (typeof isDone !== 'boolean') return fail('VALIDATION_ERROR', 'isDone phải là true hoặc false.', 400);
    if (order.status !== 'Deposited') return fail('ORDER_NOT_ACTIVE', 'Chỉ cập nhật tiến độ khi đơn đang ở trạng thái Đã đặt cọc.', 409);
    const task = UUID.test(taskId) ? await this.prisma.timeline_tasks.findFirst({ where: { id: taskId, order_id: order.id, task_type: 'Detail' } }) : null;
    if (!task) return fail('TIMELINE_ITEM_NOT_FOUND', 'Không tìm thấy việc của đơn này.', 404);
    if (!canTick('VENDOR', ownerOf(task.task_code))) return fail('TIMELINE_ITEM_READONLY', 'Việc này do khách thực hiện, nhà cung cấp chỉ xem.', 403);

    const was = task.status === 'Done';
    if (was !== isDone) {
      await this.prisma.timeline_tasks.update({ where: { id: task.id }, data: { status: isDone ? 'Done' : 'Todo', completed_date: isDone ? new Date() : null } });
      const coupleId = order.weddings?.user_id;
      // Timeline của khách và các phiên khác của NCC tải lại ngay, kể cả khi bỏ tick (bỏ tick không có thông báo)
      publish({ users: coupleId ? [coupleId, userId] : [userId], event: 'task', data: { orderId: order.id, taskId: task.id } });
      if (isDone && coupleId) {
        await notify(this.prisma, {
          userId: coupleId,
          type: 'TaskUpdated',
          title: 'Nhà cung cấp cập nhật tiến độ',
          content: `${vendor.business_name ?? 'Nhà cung cấp'} đã hoàn thành việc "${task.title ?? ''}" của đơn ${order.order_code ?? ''}.`,
          referenceType: 'TimelineTask',
          referenceId: task.id,
        }).catch(() => undefined);
      }
    }
    return this.list(userId, orderId);
  }
}
