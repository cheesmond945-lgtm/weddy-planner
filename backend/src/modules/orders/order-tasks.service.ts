import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { publish } from '../realtime/realtime.bus';
import { CALENDAR_MAX_DAYS, calendarItems } from '../weddings/calendar-items';
import { loadPackageMeta, ownersFrom, type PackageTaskMeta } from '../weddings/package-task-meta';
import { dmyOf, orderProgress, ownerOf } from '../weddings/task-owner';
import { PKG_PREFIX, pkgTaskIdOf } from '../weddings/timeline-rows';
import { hm, instantOf, localOf, minutesFrom, plannedOf, slotRangeIssue } from '../weddings/wedding-day';
import { loadWeddingDay, slotDto, venueDto } from '../weddings/wedding-day-store';
import { OrderJobsService } from './order-jobs.service';
import { checkVendorTaskEdit, dateStatusOf, parseStatusBody, scheduleDateIssue, type RuleError } from './order-task-rules';
import { UUID, fail, todayVn, ymdOf } from './order-rules';

const throwRule = (e: RuleError): never => fail(e.code, e.message, e.status);

/** Tên các gói gắn với đơn (sảnh của đơn và gói của từng dòng), không trùng. */
const packageNamesOf = (o: { service_packages: { name: string | null } | null; order_items: { service_packages: { name: string | null } | null }[] }) =>
  [...new Set([o.service_packages?.name, ...o.order_items.map((i) => i.service_packages?.name)].flatMap((n) => (n ? [n] : [])))];

type TaskRow = {
  id: string;
  title: string | null;
  task_code: string | null;
  scheduled_date: Date | null;
  status: string | null;
  completed_date: Date | null;
  task_confirmations: { confirmed_date: Date; confirmed_at: Date } | null;
};

const taskSelect = { id: true, title: true, task_code: true, scheduled_date: true, status: true, completed_date: true, task_confirmations: { select: { confirmed_date: true, confirmed_at: true } } } as const;

/**
 * "Tiến độ đơn" phía NCC (docs/TIMELINE.md, "Hướng mới 11/2026"): NCC chỉ thấy các việc chi tiết GẮN VỚI ĐƠN của mình (không thấy việc cá nhân của khách)
 * và TỰ CHỦ chúng: đổi trạng thái Todo / Waiting / Done, đổi hoặc chốt ngày cho mọi việc, kể cả việc của khách. Khách chỉ xem.
 * Dùng chung bảng timeline_tasks với timeline của khách nên khách thấy ngay.
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
      ? await this.prisma.orders.findFirst({ where: { id: orderId, vendor_id: vendor.id }, select: { id: true, order_code: true, status: true, event_date: true, wedding_id: true, weddings: { select: { user_id: true } } } })
      : null;
    return { vendor, order: o ?? fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404) };
  }

  /**
   * Dòng trả cho FE: status (Todo | Waiting | Done), owner (chủ việc, chỉ để hiển thị), isPackageTask, dateStatus (PLANNED | CONFIRMED), confirmedAt.
   * canTick luôn true: NCC đổi được trạng thái mọi việc của đơn mình. needsRecheck: việc đã chốt trước ngày thực hiện mà ngày chốt nằm sau ngày thực hiện hiện tại.
   */
  private rowOf(t: TaskRow, ctx: { today: string; event: string; meta: ReadonlyMap<string, PackageTaskMeta> }) {
    const owner = ownerOf(t.task_code, ownersFrom(ctx.meta));
    const due = t.scheduled_date ? ymdOf(t.scheduled_date) : '';
    const done = t.status === 'Done';
    const pid = pkgTaskIdOf(t.task_code);
    const before = pid ? (ctx.meta.get(pid)?.offsetDays ?? 0) < 0 : false;
    return {
      id: t.id,
      title: t.title ?? '',
      dueDate: due,
      isDone: done,
      status: (t.status === 'Waiting' ? 'Waiting' : done ? 'Done' : 'Todo') as 'Todo' | 'Waiting' | 'Done',
      completedDate: t.completed_date ? t.completed_date.toISOString() : null,
      owner,
      /** NCC đổi được trạng thái việc này (mọi việc chi tiết của đơn mình) */
      canTick: true,
      isPackageTask: !!t.task_code?.startsWith(PKG_PREFIX),
      overdue: !done && !!due && due < ctx.today,
      ...dateStatusOf(t.task_confirmations?.confirmed_date, t.task_confirmations?.confirmed_at, { due, event: ctx.event, isPackageBefore: before }),
    };
  }

  /** Việc chi tiết của một đơn (đơn đã cọc có việc; đơn chưa cọc trả danh sách rỗng) và tóm tắt tiến độ. */
  async list(userId: string, orderId: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    const today = todayVn();
    const rows = await this.prisma.timeline_tasks.findMany({
      where: { order_id: order.id, task_type: 'Detail' },
      orderBy: [{ scheduled_date: 'asc' }, { display_order: 'asc' }],
      select: taskSelect,
    });
    const meta = await loadPackageMeta(this.prisma, rows.map((t) => t.task_code));
    const event = order.event_date ? ymdOf(order.event_date) : '';
    const items = rows.map((t) => this.rowOf(t, { today, event, meta }));
    return { items, eventDate: event, progress: orderProgress(items.map((i) => ({ due: i.dueDate, done: i.isDone, owner: i.owner, title: i.title, status: i.status })), today) };
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
    const owners = ownersFrom(await loadPackageMeta(this.prisma, rows.map((t) => t.task_code)));
    const by = new Map<string, { due: string; done: boolean; owner: ReturnType<typeof ownerOf>; title: string; status: string | null }[]>();
    for (const r of rows) {
      if (!r.order_id || !r.scheduled_date) continue;
      const list = by.get(r.order_id) ?? [];
      list.push({ due: ymdOf(r.scheduled_date), done: r.status === 'Done', owner: ownerOf(r.task_code, owners), title: r.title ?? '', status: r.status });
      by.set(r.order_id, list);
    }
    return Object.fromEntries([...by].map(([id, tasks]) => [id, orderProgress(tasks, today)]));
  }

  /**
   * Bảng việc (kanban) của NCC: mọi việc chi tiết của các đơn đang thực hiện (Deposited) trong một lần gọi, kèm thông tin đơn để gom theo
   * khách / đơn. Cột theo status (Todo / Waiting / Done); kéo thả đổi status bằng setStatus.
   */
  async board(userId: string) {
    const vendor = await this.vendorOf(userId);
    await this.jobs.sweep({ vendorId: vendor.id });
    const today = todayVn();
    const rows = await this.prisma.timeline_tasks.findMany({
      where: { task_type: 'Detail', orders: { is: { vendor_id: vendor.id, status: 'Deposited' } } },
      orderBy: [{ scheduled_date: 'asc' }, { display_order: 'asc' }],
      select: {
        ...taskSelect,
        orders: { select: { id: true, order_code: true, customer_name: true, event_date: true, service_packages: { select: { name: true } }, order_items: { select: { service_packages: { select: { name: true } } } } } },
      },
    });
    const meta = await loadPackageMeta(this.prisma, rows.map((t) => t.task_code));
    return {
      items: rows.flatMap((t) =>
        t.orders
          ? [{ ...this.rowOf(t, { today, event: t.orders.event_date ? ymdOf(t.orders.event_date) : '', meta }), orderId: t.orders.id, orderCode: t.orders.order_code ?? '', customerName: t.orders.customer_name ?? '', eventDate: t.orders.event_date ? ymdOf(t.orders.event_date) : '', packageNames: packageNamesOf(t.orders) }]
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
        select: { id: true, task_code: true, title: true, scheduled_date: true, status: true, task_confirmations: { select: { task_id: true } }, orders: { select: orderSel } },
      }),
    ]);
    const owners = ownersFrom(await loadPackageMeta(this.prisma, tasks.map((t) => t.task_code)));
    const asOrder = (o: (typeof orders)[number]) => ({ id: o.id, code: o.order_code ?? '', status: o.status ?? '', eventDate: o.event_date ? ymdOf(o.event_date) : '', customerName: o.customer_name ?? '' });
    return {
      items: calendarItems({
        orders: orders.map(asOrder),
        tasks: tasks
          .filter((t) => t.orders && t.scheduled_date)
          .map((t) => ({ id: t.id, code: t.task_code, title: t.title ?? '', due: ymdOf(t.scheduled_date!), done: t.status === 'Done', status: t.status, confirmed: !!t.task_confirmations, owner: ownerOf(t.task_code, owners), order: asOrder(t.orders!) })),
        from,
        to,
        today: todayVn(),
      }),
    };
  }

  /** Việc chi tiết thuộc đơn (404 nếu không phải); đơn phải đang Deposited (409). Trả việc kèm chủ việc. */
  private async editableTask(userId: string, orderId: string, taskId: string) {
    const { vendor, order } = await this.ownedOrder(userId, orderId);
    const task = UUID.test(taskId) ? await this.prisma.timeline_tasks.findFirst({ where: { id: taskId, order_id: order.id, task_type: 'Detail' } }) : null;
    const issue = checkVendorTaskEdit({ orderStatus: order.status, taskOfOrder: !!task });
    if (issue) throwRule(issue);
    const meta = await loadPackageMeta(this.prisma, [task!.task_code]);
    return { vendor, order, task: task!, owner: ownerOf(task!.task_code, ownersFrom(meta)) };
  }

  private notifyChange(userId: string, order: { id: string; weddings: { user_id: string | null } | null }, taskId: string) {
    const coupleId = order.weddings?.user_id;
    // Timeline của khách và các phiên khác của NCC tải lại ngay
    publish({ users: coupleId ? [coupleId, userId] : [userId], event: 'task', data: { orderId: order.id, taskId } });
    return coupleId;
  }

  /**
   * NCC đổi trạng thái một việc chi tiết của đơn: Todo | Waiting | Done, cho MỌI việc (kể cả việc của khách, thanh toán, việc chi tiết cũ).
   * Body { status } (hoặc { isDone } cho FE cũ: true là Done, false là trạng thái mặc định theo chủ việc). Done thì ghi completed_date, ngược lại xóa.
   * Khách nhận thông báo khi việc xong.
   */
  async setStatus(userId: string, orderId: string, taskId: string, body: { status?: unknown; isDone?: unknown } | null | undefined) {
    const { vendor, order, task, owner } = await this.editableTask(userId, orderId, taskId);
    const next = parseStatusBody(body, owner);
    if (typeof next !== 'string') return throwRule(next);

    if ((task.status ?? 'Todo') !== next) {
      await this.prisma.timeline_tasks.update({ where: { id: task.id }, data: { status: next, completed_date: next === 'Done' ? new Date() : null } });
      const coupleId = this.notifyChange(userId, order, task.id);
      // Chuyển sang "chờ khách": báo khách ngay; cùng việc chỉ báo một lần mỗi 24 giờ (chống spam khi kéo thả qua lại)
      if (next === 'Waiting' && task.status !== 'Waiting' && coupleId) {
        const recent = await this.prisma.notifications.count({ where: { user_id: coupleId, type: 'TaskWaiting', reference_type: 'TimelineTask', reference_id: task.id, created_date: { gte: new Date(Date.now() - 24 * 3600_000) } } }).catch(() => 0);
        if (!recent) {
          await notify(this.prisma, {
            userId: coupleId,
            type: 'TaskWaiting',
            title: 'Nhà cung cấp đang chờ bạn',
            content: `${vendor.business_name ?? 'Nhà cung cấp'} đang chờ bạn: ${task.title ?? ''} (đơn ${order.order_code ?? ''}).`,
            referenceType: 'TimelineTask',
            referenceId: task.id,
          }).catch(() => undefined);
        }
      }
      if (next === 'Done' && task.status !== 'Done' && coupleId) {
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

  /** Tương thích tên cũ (PATCH { isDone }). */
  setDone(userId: string, orderId: string, taskId: string, isDone: unknown) {
    return this.setStatus(userId, orderId, taskId, { isDone });
  }

  /**
   * NCC chốt ngày (không gửi date: chốt ngày hiện tại) hoặc đổi ngày (có date: cập nhật scheduled_date) của một việc, ghi vào task_confirmations
   * trong cùng transaction. Ngày từ hôm nay đến ngày thực hiện + 120. Khách nhận thông báo "đã chốt lịch" và timeline tải lại.
   */
  async confirmSchedule(userId: string, orderId: string, taskId: string, date?: unknown) {
    const { vendor, order, task } = await this.editableTask(userId, orderId, taskId);
    const event = order.event_date ? ymdOf(order.event_date) : '';
    const target = date === undefined || date === null ? (task.scheduled_date ? ymdOf(task.scheduled_date) : '') : date;
    const issue = scheduleDateIssue(target, { today: todayVn(), event });
    if (issue) return throwRule(issue);

    const day = new Date(`${target as string}T00:00:00Z`);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.timeline_tasks.update({ where: { id: task.id }, data: { scheduled_date: day } }),
      this.prisma.task_confirmations.upsert({
        where: { task_id: task.id },
        create: { task_id: task.id, confirmed_date: day, confirmed_by: userId, confirmed_at: now },
        update: { confirmed_date: day, confirmed_by: userId, confirmed_at: now },
      }),
    ]);
    const coupleId = this.notifyChange(userId, order, task.id);
    if (coupleId) {
      await notify(this.prisma, {
        userId: coupleId,
        type: 'TaskScheduled',
        title: 'Nhà cung cấp đã chốt lịch',
        content: `${vendor.business_name ?? 'Nhà cung cấp'} đã chốt lịch "${task.title ?? ''}": ${dmyOf(target as string)}.`,
        referenceType: 'TimelineTask',
        referenceId: task.id,
      }).catch(() => undefined);
    }
    return this.list(userId, orderId);
  }

  /** "Bỏ chốt": xóa dòng task_confirmations, giữ nguyên ngày. */
  async unconfirmSchedule(userId: string, orderId: string, taskId: string) {
    const { order, task } = await this.editableTask(userId, orderId, taskId);
    await this.prisma.task_confirmations.deleteMany({ where: { task_id: task.id } });
    this.notifyChange(userId, order, task.id);
    return this.list(userId, orderId);
  }

  // ---------- Giờ có mặt ngày cưới (docs/LICH_TRINH_NGAY_CUOI.md) ----------

  /**
   * Lịch trình ngày cưới nhìn từ một đơn: chỉ đơn Đã cọc / Hoàn thành làm ĐÚNG ngày cưới (applicable = false kèm lý do nếu không).
   * Trả khung của đơn (đã chốt hoặc dự kiến), khung dự kiến theo gói (để điền sẵn khi chốt), giờ sảnh mở, và khung của các NCC khác
   * (chỉ lĩnh vực và giờ, không lộ tên NCC khác).
   */
  private async daySlotOf(order: { id: string; status: string | null; event_date: Date | null; wedding_id: string | null }) {
    if (order.status !== 'Deposited' && order.status !== 'Completed') return { applicable: false as const, reason: 'NOT_ACTIVE', message: 'Giờ có mặt ngày cưới có sau khi khách đặt cọc.' };
    const day = order.wedding_id ? await loadWeddingDay(this.prisma, order.wedding_id) : null;
    if (!day) return { applicable: false as const, reason: 'NO_WEDDING_DATE', message: 'Khách chưa có ngày cưới.' };
    const event = order.event_date ? ymdOf(order.event_date) : '';
    if (event !== day.date) {
      return { applicable: false as const, reason: 'NOT_WEDDING_DAY', message: `Đơn thực hiện ngày ${dmyOf(event)}, không phải ngày cưới ${dmyOf(day.date)}, nên không nằm trong lịch trình ngày cưới.` };
    }
    const slot = day.plan.slots.find((s) => s.orderId === order.id)!;
    const input = day.orders.find((o) => o.orderId === order.id)!;
    const planned = day.plan.mainTime === null ? null : plannedOf(input, day.plan.mainTime);
    return {
      applicable: true as const,
      date: day.date,
      mainTime: day.plan.mainTime === null ? null : hm(day.plan.mainTime),
      slot: slotDto(day.date, slot),
      planned: planned && { start: localOf(day.date, planned.start), end: localOf(day.date, planned.end), source: planned.source },
      venue: venueDto(day.plan),
      others: day.plan.slots
        .filter((s) => s.orderId !== order.id)
        .map((s) => ({ categoryName: s.categoryName, isVenue: s.isVenue, start: s.start === null ? null : localOf(day.date, s.start), end: s.end === null ? null : localOf(day.date, s.end), confirmed: s.source === 'CONFIRMED' })),
      canEdit: order.status === 'Deposited',
    };
  }

  async daySlot(userId: string, orderId: string) {
    const { order } = await this.ownedOrder(userId, orderId);
    return this.daySlotOf(order);
  }

  /** Đơn đang thực hiện, làm đúng ngày cưới: trả ngày cưới (409 nếu không). */
  private async editableDay(userId: string, orderId: string) {
    const { vendor, order } = await this.ownedOrder(userId, orderId);
    if (order.status !== 'Deposited') return fail('ORDER_NOT_ACTIVE', 'Chỉ chốt giờ cho đơn đang thực hiện (đã cọc).', 409);
    const info = await this.daySlotOf(order);
    if (!info.applicable) return fail('NOT_WEDDING_DAY', info.message, 409);
    return { vendor, order, date: info.date };
  }

  /** NCC chốt giờ có mặt / xong việc ({ start, end } giờ VN "YYYY-MM-DDTHH:mm", từ hôm trước đến hết ngày cưới). Khách được báo. */
  async confirmDaySlot(userId: string, orderId: string, body: { start?: unknown; end?: unknown }) {
    const { vendor, order, date } = await this.editableDay(userId, orderId);
    const start = minutesFrom(date, body.start);
    const end = minutesFrom(date, body.end);
    const issue = slotRangeIssue(start, end);
    if (issue) return fail('VALIDATION_ERROR', issue, 400);
    await this.prisma.orders.update({ where: { id: order.id }, data: { dayof_start_at: instantOf(date, start!), dayof_end_at: instantOf(date, end!), dayof_confirmed_at: new Date() } });
    const coupleId = this.notifyChange(userId, order, order.id);
    if (coupleId) {
      await notify(this.prisma, {
        userId: coupleId,
        type: 'DaySlotConfirmed',
        title: 'Nhà cung cấp đã chốt giờ có mặt',
        content: `${vendor.business_name ?? 'Nhà cung cấp'} có mặt ${hm(start!)}${start! < 0 ? ' (tối hôm trước)' : ''} đến ${hm(end!)} ngày cưới ${dmyOf(date)} (đơn ${order.order_code ?? ''}).`,
        referenceType: 'Order',
        referenceId: order.id,
      }).catch(() => undefined);
    }
    return this.daySlotOf(order);
  }

  /** Bỏ chốt giờ có mặt: về giờ dự kiến theo giờ chính và gói. */
  async clearDaySlot(userId: string, orderId: string) {
    const { order } = await this.editableDay(userId, orderId);
    await this.prisma.orders.update({ where: { id: order.id }, data: { dayof_start_at: null, dayof_end_at: null, dayof_confirmed_at: null } });
    this.notifyChange(userId, order, order.id);
    return this.daySlotOf(order);
  }
}

