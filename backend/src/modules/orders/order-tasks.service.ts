import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { runAfter } from '../../common/after-response';
import { PrismaService } from '../../prisma/prisma.service';
import { notify } from '../chat/chat-messages';
import { publish } from '../realtime/realtime.bus';
import { CALENDAR_MAX_DAYS, calendarItems } from '../weddings/calendar-items';
import { MAX_TASKS_PER_PACKAGE, MIN_OFFSET } from '../vendors/package-tasks';
import { isBeforeEvent, loadPackageMeta, ownersFrom, packagesOfOrder, type PackageTaskMeta } from '../weddings/package-task-meta';
import { dmyOf, orderProgress, ownerOf } from '../weddings/task-owner';
import { initialStatus, isCustomOrderTaskCode, ordCode, ordCodeWithOwner, PKG_PREFIX, pkgTaskIdOf, taskTitle } from '../weddings/timeline-rows';
import { DelayedNotices } from './delayed-notice';
import { OrderJobsService } from './order-jobs.service';
import { notifyRestCleared, notifyRestReceived } from './order-lifecycle';
import { applyRestReceived, clearRestGate, isRestPayCode, recordsRestPayment, type RestDb } from './rest-payment';
import { checkVendorTaskEdit, dateStatusOf, editOrderTaskIssue, isYmd, parseNewOrderTask, parseOrderTaskPatch, parseStatusBody, removeOrderTaskIssue, scheduleDateIssue, type RuleError } from './order-task-rules';
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
  private readonly logger = new Logger(OrderTasksService.name);
  /** Thông báo "đã hẹn ngày" gửi trễ để NCC kịp Hoàn tác (delayed-notice.ts) */
  private readonly scheduleNotices = new DelayedNotices();
  /** Ngày của việc trước loạt đổi đang chờ báo (đổi liên tiếp trong lúc chờ thì thông báo vẫn ghi "từ" ngày ban đầu) */
  private readonly scheduleFrom = new Map<string, string>();

  constructor(private readonly prisma: PrismaService, private readonly jobs: OrderJobsService) {}

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true, business_name: true } });
    return v ?? fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
  }

  private async ownedOrder(userId: string, orderId: string) {
    const vendor = await this.vendorOf(userId);
    await this.jobs.sweep({ vendorId: vendor.id });
    const o = UUID.test(orderId)
      ? await this.prisma.orders.findFirst({ where: { id: orderId, vendor_id: vendor.id }, select: { id: true, order_code: true, status: true, event_date: true, wedding_id: true, package_id: true, order_items: { select: { package_id: true } }, total_amount: true, deposit_amount: true, vendor_profiles: { select: { category_id: true } }, weddings: { select: { user_id: true } } } })
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
    const before = isBeforeEvent(t.task_code, ctx.meta);
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
      /** Việc của gói có mốc trước ngày thực hiện: ngày chốt / đổi phải trước ngày thực hiện */
      beforeEvent: before,
      /** Việc riêng NCC thêm cho đúng đơn này ('ORD:'), không thuộc gói */
      isCustomOrderTask: isCustomOrderTaskCode(t.task_code),
      /** Việc "Thanh toán phần còn lại" (PAY:): Done = NCC đã nhận đủ tiền mặt (ghi nhận đợt 2) */
      isRestPayment: isRestPayCode(t.task_code),
      overdue: !done && !!due && due < ctx.today && !isRestPayCode(t.task_code),
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
    return { items, eventDate: event, hasPackage: packagesOfOrder(order).length > 0, restAmount: Number(order.total_amount) - Number(order.deposit_amount), progress: orderProgress(items.map((i) => ({ due: i.dueDate, done: i.isDone, owner: i.owner, title: i.title, status: i.status })), today) };
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
    const by = new Map<string, { due: string; done: boolean; owner: ReturnType<typeof ownerOf>; title: string; status: string | null; restPayment: boolean }[]>();
    for (const r of rows) {
      if (!r.order_id || !r.scheduled_date) continue;
      const list = by.get(r.order_id) ?? [];
      list.push({ due: ymdOf(r.scheduled_date), done: r.status === 'Done', owner: ownerOf(r.task_code, owners), title: r.title ?? '', status: r.status, restPayment: isRestPayCode(r.task_code) });
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
        orders: { select: { id: true, order_code: true, customer_name: true, event_date: true, total_amount: true, deposit_amount: true, service_packages: { select: { name: true } }, order_items: { select: { service_packages: { select: { name: true } } } } } },
      },
    });
    const meta = await loadPackageMeta(this.prisma, rows.map((t) => t.task_code));
    return {
      items: rows.flatMap((t) =>
        t.orders
          ? [{ ...this.rowOf(t, { today, event: t.orders.event_date ? ymdOf(t.orders.event_date) : '', meta }), orderId: t.orders.id, orderCode: t.orders.order_code ?? '', customerName: t.orders.customer_name ?? '', eventDate: t.orders.event_date ? ymdOf(t.orders.event_date) : '', packageNames: packageNamesOf(t.orders), restAmount: Number(t.orders.total_amount) - Number(t.orders.deposit_amount) }]
          : [],
      ),
    };
  }

  /**
   * Lịch làm việc của NCC trong khoảng [from, to] (tối đa CALENDAR_MAX_DAYS ngày): ngày thực hiện của các đơn đã cọc / hoàn thành
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
    const meta = await loadPackageMeta(this.prisma, tasks.map((t) => t.task_code));
    const owners = ownersFrom(meta);
    const beforeOf = (code: string | null) => isBeforeEvent(code, meta);
    const asOrder = (o: (typeof orders)[number]) => ({ id: o.id, code: o.order_code ?? '', status: o.status ?? '', eventDate: o.event_date ? ymdOf(o.event_date) : '', customerName: o.customer_name ?? '' });
    return {
      items: calendarItems({
        orders: orders.map(asOrder),
        tasks: tasks
          .filter((t) => t.orders && t.scheduled_date)
          .map((t) => ({ id: t.id, code: t.task_code, title: t.title ?? '', due: ymdOf(t.scheduled_date!), done: t.status === 'Done', status: t.status, confirmed: !!t.task_confirmations, owner: ownerOf(t.task_code, owners), beforeEvent: beforeOf(t.task_code), order: asOrder(t.orders!) })),
        from,
        to,
        today: todayVn(),
      }),
    };
  }

  /**
   * Đơn và việc cho các API GHI (đổi trạng thái, chốt / đổi ngày): hai truy vấn song song (đơn của NCC, việc kèm xác nhận ngày) và một truy vấn
   * chủ việc khi là việc của gói. Không quét hết hạn / tự hoàn thành và không đọc lại cả danh sách việc: chỉ trả đúng việc vừa đổi.
   * Đơn phải đang Deposited (409), việc phải thuộc đơn (404).
   */
  private async editableTask(userId: string, orderId: string, taskId: string) {
    const [order, task] = await Promise.all([
      UUID.test(orderId)
        ? this.prisma.orders.findFirst({
            where: { id: orderId, vendor_profiles: { user_id: userId } },
            select: {
              id: true,
              order_code: true,
              status: true,
              event_date: true,
              wedding_id: true,
              total_amount: true,
              deposit_amount: true,
              vendor_profiles: { select: { business_name: true, category_id: true } },
              weddings: { select: { user_id: true } },
            },
          })
        : null,
      UUID.test(taskId) && UUID.test(orderId)
        ? this.prisma.timeline_tasks.findFirst({ where: { id: taskId, order_id: orderId, task_type: 'Detail' }, include: { task_confirmations: { select: { confirmed_date: true, confirmed_at: true } } } })
        : null,
    ]);
    if (!order) return fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
    const issue = checkVendorTaskEdit({ orderStatus: order.status, taskOfOrder: !!task });
    if (issue) throwRule(issue);
    const meta = await loadPackageMeta(this.prisma, [task!.task_code]);
    const ctx = { today: todayVn(), event: order.event_date ? ymdOf(order.event_date) : '', meta };
    return { order, vendorName: order.vendor_profiles?.business_name ?? 'Nhà cung cấp', task: task!, ctx, owner: ownerOf(task!.task_code, ownersFrom(meta)) };
  }

  /** Đơn của NCC cho API thêm việc: phải Deposited (409), có khách và ngày thực hiện. */
  private async activeOrder(userId: string, orderId: string) {
    const order = UUID.test(orderId)
      ? await this.prisma.orders.findFirst({
          where: { id: orderId, vendor_profiles: { user_id: userId } },
          select: { id: true, order_code: true, status: true, event_date: true, wedding_id: true, package_id: true, order_items: { select: { package_id: true } }, vendor_profiles: { select: { business_name: true, category_id: true } }, weddings: { select: { user_id: true } } },
        })
      : null;
    if (!order) return fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
    const issue = checkVendorTaskEdit({ orderStatus: order.status, taskOfOrder: true });
    if (issue) throwRule(issue);
    if (!order.wedding_id || !order.event_date) return fail('ORDER_NOT_ACTIVE', 'Đơn chưa có đám cưới hoặc ngày thực hiện.', 409);
    return { order: { ...order, wedding_id: order.wedding_id, event_date: order.event_date }, vendorName: order.vendor_profiles?.business_name ?? 'Nhà cung cấp', ctx: { today: todayVn(), event: ymdOf(order.event_date), meta: new Map<string, PackageTaskMeta>() } };
  }

  /**
   * NCC thêm một việc RIÊNG cho đơn đã cọc ('ORD:<C|V|B>:...'), đã chốt ngày luôn (ngày từ hôm nay đến E + 120). Không đụng gói và các đơn khác.
   * addToPackage = true và đơn có gói: thêm luôn một việc vào gói (offset = ngày - E), chỉ áp cho các đơn SAU. Trả { item, addedToPackage } ngay;
   * thông báo cho khách chạy sau response.
   */
  async addTask(userId: string, orderId: string, body: Record<string, unknown> | null | undefined) {
    const { order, vendorName, ctx } = await this.activeOrder(userId, orderId);
    const input = parseNewOrderTask(body, { today: ctx.today, event: ctx.event });
    if ('code' in input) return throwRule(input);

    const day = new Date(`${input.date}T00:00:00Z`);
    const now = new Date();
    const packageId = input.addToPackage ? packagesOfOrder(order)[0] : undefined;
    let pkg: { offset: number; sort: number } | null = null;
    if (packageId) {
      const offset = Math.round((Date.parse(input.date) - Date.parse(ctx.event)) / 86_400_000);
      if (offset < MIN_OFFSET) return fail('VALIDATION_ERROR', 'Ngày quá xa ngày thực hiện để đưa vào quy trình của gói.', 400);
      const [count, last] = await Promise.all([
        this.prisma.package_tasks.count({ where: { package_id: packageId, deleted_at: null } }),
        this.prisma.package_tasks.findFirst({ where: { package_id: packageId }, orderBy: { sort_order: 'desc' }, select: { sort_order: true } }),
      ]);
      if (count >= MAX_TASKS_PER_PACKAGE) return fail('PACKAGE_TASKS_FULL', `Gói đã có tối đa ${MAX_TASKS_PER_PACKAGE} công việc.`, 409);
      pkg = { offset, sort: (last?.sort_order ?? 0) + 1 };
    }

    const create = this.prisma.timeline_tasks.create({
      data: {
        wedding_id: order.wedding_id,
        category_id: order.vendor_profiles?.category_id ?? null,
        order_id: order.id,
        title: taskTitle(input.title, input.note),
        scheduled_date: day,
        status: initialStatus(input.owner),
        task_type: 'Detail',
        task_code: ordCode(input.owner, order.id, randomBytes(4).toString('hex')),
        display_order: 500,
        task_confirmations: { create: { confirmed_date: day, confirmed_by: userId, confirmed_at: now } },
      },
      include: { task_confirmations: { select: { confirmed_date: true, confirmed_at: true } } },
    });
    const [created] = pkg
      ? await this.prisma.$transaction([create, this.prisma.package_tasks.create({ data: { package_id: packageId!, sort_order: pkg.sort, title: input.title, note: input.note, owner: input.owner, offset_days: pkg.offset } })])
      : await this.prisma.$transaction([create]);

    const coupleId = order.weddings?.user_id ?? null;
    this.later('thông báo thêm việc', async () => {
      this.publishTask(userId, order, created.id);
      if (coupleId) {
        await notify(this.prisma, { userId: coupleId, type: 'TaskUpdated', title: 'Nhà cung cấp thêm việc', content: `${vendorName} đã thêm việc "${input.title}" (${dmyOf(input.date).slice(0, 5)}) cho đơn ${order.order_code ?? ''}.`, referenceType: 'TimelineTask', referenceId: created.id });
      }
    });
    return { item: this.rowOf(created, ctx), addedToPackage: !!pkg };
  }

  /** PATCH một việc: có status / isDone thì đổi trạng thái; chỉ có title / note / owner thì sửa việc riêng ('ORD:'). */
  patchTask(userId: string, orderId: string, taskId: string, body: Record<string, unknown> | null | undefined) {
    const b = body ?? {};
    const isEdit = b.status === undefined && b.isDone === undefined && ('title' in b || 'note' in b || 'owner' in b);
    return isEdit ? this.updateTask(userId, orderId, taskId, b) : this.setStatus(userId, orderId, taskId, b);
  }

  /** Sửa tên / ghi chú / chủ của việc riêng 'ORD:' chưa xong. Đổi chủ thì đổi chữ cái trong mã và đặt lại trạng thái đầu (khách làm: Waiting, còn lại Todo). */
  async updateTask(userId: string, orderId: string, taskId: string, body: Record<string, unknown>) {
    const { order, task, ctx } = await this.editableTask(userId, orderId, taskId);
    const blocked = editOrderTaskIssue(task);
    if (blocked) return throwRule(blocked);
    const patch = parseOrderTaskPatch(body);
    if ('code' in patch) return throwRule(patch);

    const data: { title?: string; task_code?: string; status?: string } = {};
    if (patch.title !== undefined || patch.note !== undefined) data.title = taskTitle(patch.title ?? task.title ?? '', patch.note ?? null);
    if (patch.owner && patch.owner !== ownerOf(task.task_code)) {
      data.task_code = ordCodeWithOwner(task.task_code!, patch.owner);
      data.status = initialStatus(patch.owner);
    }
    const row = await this.prisma.timeline_tasks.update({ where: { id: task.id }, data, include: { task_confirmations: { select: { confirmed_date: true, confirmed_at: true } } } });
    this.later('realtime sửa việc', async () => void this.publishTask(userId, order, task.id));
    return { item: this.rowOf(row, ctx) };
  }

  /**
   * "Bỏ việc khỏi đơn": xóa dòng timeline_tasks của việc 'PKG:' hoặc 'ORD:' chưa xong. Không đụng package_tasks (gói và đơn khác giữ nguyên)
   * và không bỏ được việc thanh toán 'PAY:'. Trả { id } ngay; thông báo cho khách chạy sau response.
   */
  async removeTask(userId: string, orderId: string, taskId: string) {
    const { order, vendorName, task } = await this.editableTask(userId, orderId, taskId);
    const blocked = removeOrderTaskIssue(task);
    if (blocked) return throwRule(blocked);
    await this.prisma.timeline_tasks.delete({ where: { id: task.id } });
    this.scheduleNotices.cancel(task.id); // việc đã bỏ thì không còn gì để báo "đã hẹn ngày"
    this.scheduleFrom.delete(task.id);
    const coupleId = order.weddings?.user_id ?? null;
    this.later('thông báo bỏ việc', async () => {
      this.publishTask(userId, order, task.id);
      if (coupleId) {
        await notify(this.prisma, { userId: coupleId, type: 'TaskUpdated', title: 'Nhà cung cấp bỏ một việc', content: `${vendorName} đã bỏ việc "${task.title ?? ''}" khỏi đơn ${order.order_code ?? ''}.`, referenceType: 'Order', referenceId: order.id });
      }
    });
    return { id: task.id };
  }

  /** Việc phụ SAU khi đã trả response: báo realtime cho khách và các phiên khác của NCC (lỗi chỉ ghi log). */
  private later(label: string, fn: () => Promise<unknown>) {
    runAfter(label, fn, (m) => this.logger.warn(m));
  }

  private publishTask(userId: string, order: { id: string; weddings: { user_id: string | null } | null }, taskId: string) {
    const coupleId = order.weddings?.user_id;
    publish({ users: coupleId ? [coupleId, userId] : [userId], event: 'task', data: { orderId: order.id, taskId } });
    return coupleId;
  }

  /**
   * NCC đổi trạng thái một việc chi tiết của đơn: Todo | Waiting | Done, cho MỌI việc (kể cả việc của khách, thanh toán, việc chi tiết cũ).
   * Body { status } (hoặc { isDone } cho FE cũ). Done thì ghi completed_date, ngược lại xóa. Trả NGAY việc đã cập nhật ({ item });
   * thông báo cho khách và realtime chạy sau response. Việc thanh toán phần còn lại sang Done = ghi nhận đã nhận tiền mặt (cùng hàm, có thông báo).
   */
  async setStatus(userId: string, orderId: string, taskId: string, body: { status?: unknown; isDone?: unknown } | null | undefined) {
    const { order, vendorName, task, ctx, owner } = await this.editableTask(userId, orderId, taskId);
    const next = parseStatusBody(body, owner);
    if (typeof next !== 'string') return throwRule(next);

    const now = new Date();
    const coupleId = order.weddings?.user_id ?? null;
    let row: TaskRow = task;

    // Kéo việc thanh toán đợt 2 ra khỏi Done = bỏ ghi nhận tiền mặt: cùng luật với nút "Bỏ ghi nhận" (đã có hóa đơn cuối thì 409)
    const unrecording = isRestPayCode(task.task_code) && task.status === 'Done' && next !== 'Done';
    if (unrecording) {
      const final = await this.prisma.invoices.findFirst({ where: { order_id: order.id, type: 'FinalInvoice' }, select: { invoice_code: true } });
      const blocked = clearRestGate(final?.invoice_code ?? null);
      if (blocked) return throwRule(blocked);
    }

    if (recordsRestPayment(task.task_code, next) && order.event_date) {
      const changed = await applyRestReceived(this.prisma as unknown as RestDb, { id: order.id, wedding_id: order.wedding_id, category_id: order.vendor_profiles?.category_id ?? null, event_date: order.event_date, vendorName }, now);
      row = { ...task, status: 'Done', completed_date: task.status === 'Done' ? task.completed_date : now };
      if (changed && coupleId) {
        this.later('thông báo nhận tiền mặt', () =>
          notifyRestReceived(this.prisma, { orderId: order.id, taskId: task.id, orderCode: order.order_code, coupleUserId: coupleId, vendorUserId: userId, vendorName, amount: Number(order.total_amount) - Number(order.deposit_amount) }),
        );
      }
    } else if ((task.status ?? 'Todo') !== next) {
      row = await this.prisma.timeline_tasks.update({
        where: { id: task.id },
        data: { status: next, completed_date: next === 'Done' ? now : null },
        include: { task_confirmations: { select: { confirmed_date: true, confirmed_at: true } } },
      });
      const was = task.status;
      this.later('thông báo đổi trạng thái', async () => {
        this.publishTask(userId, order, task.id);
        if (!coupleId) return;
        if (unrecording) {
          await notifyRestCleared(this.prisma, { orderId: order.id, taskId: task.id, orderCode: order.order_code, coupleUserId: coupleId, vendorUserId: userId, vendorName, amount: Number(order.total_amount) - Number(order.deposit_amount) });
          return;
        }
        // Chuyển sang "chờ khách": báo khách; cùng việc chỉ báo một lần mỗi 24 giờ (chống spam khi kéo thả qua lại)
        if (next === 'Waiting' && was !== 'Waiting') {
          const recent = await this.prisma.notifications.count({ where: { user_id: coupleId, type: 'TaskWaiting', reference_type: 'TimelineTask', reference_id: task.id, created_date: { gte: new Date(Date.now() - 24 * 3600_000) } } });
          if (!recent) {
            await notify(this.prisma, { userId: coupleId, type: 'TaskWaiting', title: 'Bạn cần làm một việc', content: `Bạn cần làm: ${task.title ?? ''} (đơn ${order.order_code ?? ''}, ${vendorName}).`, referenceType: 'TimelineTask', referenceId: task.id });
          }
        }
        if (next === 'Done' && was !== 'Done') {
          await notify(this.prisma, { userId: coupleId, type: 'TaskUpdated', title: 'Nhà cung cấp cập nhật tiến độ', content: `${vendorName} đã hoàn thành việc "${task.title ?? ''}" của đơn ${order.order_code ?? ''}.`, referenceType: 'TimelineTask', referenceId: task.id });
        }
      });
    }
    return { item: this.rowOf(row, ctx) };
  }

  /**
   * NCC xác nhận ngày (không gửi date: xác nhận ngày hiện tại) hoặc đổi ngày (có date: cập nhật scheduled_date) của một việc, ghi vào task_confirmations
   * trong cùng transaction. Ngày từ hôm nay đến ngày thực hiện + 120. Trả NGAY việc đã cập nhật.
   * Thông báo cho khách gửi TRỄ SCHEDULE_NOTICE_DELAY_MS (delayed-notice.ts): trong lúc chờ mà NCC hoàn tác thì thông báo bị hủy.
   * `opts.undo` (Hoàn tác): trả về ngày cũ, cho phép ngày đã qua; `opts.confirmed = false` trả luôn về trạng thái chưa xác nhận (xóa xác nhận).
   * Hoàn tác khi thông báo còn đang chờ thì hủy thông báo đó và không báo gì cho khách.
   */
  async confirmSchedule(userId: string, orderId: string, taskId: string, date?: unknown, opts: { undo?: boolean; confirmed?: boolean } = {}) {
    const { order, vendorName, task, ctx } = await this.editableTask(userId, orderId, taskId);
    const target = date === undefined || date === null ? (task.scheduled_date ? ymdOf(task.scheduled_date) : '') : date;
    const beforeEvent = isBeforeEvent(task.task_code, ctx.meta);
    const issue = opts.undo ? (isYmd(target) ? null : scheduleDateIssue(target, { today: ctx.today, event: ctx.event, beforeEvent })) : scheduleDateIssue(target, { today: ctx.today, event: ctx.event, beforeEvent });
    if (issue) return throwRule(issue);

    const day = new Date(`${target as string}T00:00:00Z`);
    const now = new Date();
    const keepUnconfirmed = opts.undo === true && opts.confirmed === false;
    await this.prisma.$transaction([
      this.prisma.timeline_tasks.update({ where: { id: task.id }, data: { scheduled_date: day } }),
      keepUnconfirmed
        ? this.prisma.task_confirmations.deleteMany({ where: { task_id: task.id } })
        : this.prisma.task_confirmations.upsert({
            where: { task_id: task.id },
            create: { task_id: task.id, confirmed_date: day, confirmed_by: userId, confirmed_at: now },
            update: { confirmed_date: day, confirmed_by: userId, confirmed_at: now },
          }),
    ]);
    const coupleId = order.weddings?.user_id ?? null;
    this.later('realtime chốt lịch', async () => void this.publishTask(userId, order, task.id));
    // Hoàn tác khi thông báo còn chờ: hủy, khách không biết gì về lần đổi nhầm. Ngược lại hẹn gửi trễ (đổi tiếp trong lúc chờ thì chỉ gửi bản cuối).
    const cancelled = opts.undo === true && this.scheduleNotices.cancel(task.id);
    if (cancelled) this.scheduleFrom.delete(task.id);
    if (!cancelled && coupleId) {
      const from = this.scheduleFrom.get(task.id) ?? (task.scheduled_date ? ymdOf(task.scheduled_date) : '');
      this.scheduleFrom.set(task.id, from);
      const to = target as string;
      // Ngày khác ngày ban đầu: báo "đổi ngày" (chỉ để đọc, FE không dẫn trang); cùng ngày: báo "đã hẹn ngày" như cũ
      const send = () => {
        this.scheduleFrom.delete(task.id);
        return from && from !== to
          ? notify(this.prisma, { userId: coupleId, type: 'TaskDateChanged', title: 'Nhà cung cấp đổi ngày việc', content: `${vendorName} đã đổi ngày việc "${task.title ?? ''}" từ ${dmyOf(from)} sang ${dmyOf(to)} (đơn ${order.order_code ?? ''}).`, referenceType: 'TimelineTask', referenceId: task.id })
          : notify(this.prisma, { userId: coupleId, type: 'TaskScheduled', title: 'Nhà cung cấp đã hẹn ngày', content: `${vendorName} đã hẹn ngày cho việc "${task.title ?? ''}": ${dmyOf(to)}.`, referenceType: 'TimelineTask', referenceId: task.id });
      };
      this.scheduleNotices.schedule(task.id, send, (e) => this.logger.warn(`thông báo hẹn ngày lỗi: ${e instanceof Error ? e.message : String(e)}`));
    }
    return { item: this.rowOf({ ...task, scheduled_date: day, task_confirmations: keepUnconfirmed ? null : { confirmed_date: day, confirmed_at: now } }, ctx) };
  }

  /** "Bỏ chốt": xóa dòng task_confirmations, giữ nguyên ngày. Trả NGAY việc đã cập nhật. */
  async unconfirmSchedule(userId: string, orderId: string, taskId: string) {
    const { order, task, ctx } = await this.editableTask(userId, orderId, taskId);
    await this.prisma.task_confirmations.deleteMany({ where: { task_id: task.id } });
    this.later('realtime bỏ chốt', async () => void this.publishTask(userId, order, task.id));
    return { item: this.rowOf({ ...task, task_confirmations: null }, ctx) };
  }
}
