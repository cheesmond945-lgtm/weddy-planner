import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { publish } from '../realtime/realtime.bus';
import { planWeddingDateChange, todayVNDate, toYmd, vnYmd } from './timeline-hooks';
import { dayOf, levelOf, planDetails, planFrame } from './timeline-schedule';
import { dueBounds, dueRangeIssue, sequenceIssue } from './timeline-rules';
import { canTick, ownerOf } from './task-owner';
import { SERVICE_BY_CATEGORY_NAME, TIMELINE_TEMPLATES, suggestOf, templateOf, type ServiceKey } from './timeline-templates';
import { WeddingsService } from './weddings.service';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Timeline theo CSDL (timeline_tasks) và mẫu (timeline-templates.ts); loại việc suy ra từ task_code qua mẫu (task_code rỗng = khách tự thêm):
 * - SELF -> TASK; CHOOSE -> CHOOSE (nút "Gợi ý {dịch vụ}"); BOOK (mã *_BOOK) -> CATEGORY_DEADLINE ("Chốt <hạng mục>", xong khi đã cọc)
 * - DETAIL / EVENT / PAYMENT gắn đơn -> SERVICE_TASK (needsMeeting = có nút "Hẹn với NCC")
 * - Việc chi tiết (SERVICE_TASK) nằm trong nhóm của Mốc chốt cùng hạng mục; Mốc chốt chưa chốt mang detailCount (số việc sẽ mở)
 * `urgent` (Cần làm gấp) tính lại khi đọc bằng đúng đầu vào lúc sinh; không lưu.
 */
/** Số việc chi tiết (Chi tiết, Ngày thực hiện, Thanh toán) của một hạng mục trong mẫu. */
const detailCountOf = (key: ServiceKey | undefined) => (key ? TIMELINE_TEMPLATES.filter((t) => t.service === key && t.kind !== 'SELF' && t.kind !== 'CHOOSE' && t.kind !== 'BOOK').length : 0);

const frameUrgent = (w: { wedding_date: Date | null; created_date: Date | null }, keys: ServiceKey[]) => {
  const out = new Set<string>();
  if (!w.wedding_date) return out;
  try {
    for (const t of planFrame(TIMELINE_TEMPLATES, { wedding: toYmd(w.wedding_date), today: vnYmd(w.created_date ?? new Date()), services: keys }).tasks) if (t.urgent) out.add(t.code);
  } catch {
    // ngày cưới không sau ngày tạo: không có cờ gấp
  }
  return out;
};

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService, private readonly weddings: WeddingsService) {}

  async get(userId: string) {
    const w = await this.weddings.requireWedding(userId);
    const [tasks, cats, plan, orders] = await Promise.all([
      this.prisma.timeline_tasks.findMany({ where: { wedding_id: w.id }, orderBy: [{ scheduled_date: 'asc' }, { display_order: 'asc' }, { created_date: 'asc' }] }),
      this.prisma.service_categories.findMany(),
      this.weddings.planSnapshot(userId, w.id),
      this.prisma.orders.findMany({
        where: { wedding_id: w.id },
        select: { id: true, order_code: true, status: true, event_date: true, cancelled_date: true, payments: { select: { paid_date: true } }, vendor_profiles: { select: { id: true, business_name: true, category_id: true } } },
      }),
    ]);
    const catById = new Map(cats.map((c) => [c.id, { id: c.id, slug: categorySlug(c.name), name: c.name ?? '' }]));
    const keyOfCat = (id: string | null) => {
      const name = cats.find((c) => c.id === id)?.name;
      return name ? SERVICE_BY_CATEGORY_NAME[name] : undefined;
    };
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const cancelledOrderOf = (categoryId: string | null) => {
      const o = orders
        .filter((x) => x.status === 'Cancelled' && x.cancelled_date && x.payments?.paid_date && x.vendor_profiles?.category_id === categoryId)
        .sort((a, b) => b.cancelled_date!.getTime() - a.cancelled_date!.getTime())[0];
      return o ? { orderCode: o.order_code ?? '', vendorName: o.vendor_profiles?.business_name ?? '', date: vnYmd(o.cancelled_date!) } : null;
    };
    const today = vnYmd(new Date());

    // Cờ gấp: khung tính lại với I = ngày tạo; chi tiết tính lại với D, E của đơn như lúc sinh
    const keys = [...new Set(tasks.map((t) => keyOfCat(t.category_id)).filter((k): k is ServiceKey => !!k))];
    const urgent = frameUrgent(w, keys);
    const albumTask = tasks.find((t) => t.task_code === 'PHOTO_ALBUM_SHOOT');
    for (const orderId of new Set(tasks.map((t) => t.order_id).filter((x): x is string => !!x))) {
      const o = orderById.get(orderId);
      const key = keyOfCat(tasks.find((t) => t.order_id === orderId)?.category_id ?? null);
      if (!o || !key || !w.wedding_date) continue;
      const deposit = o.payments?.paid_date ? vnYmd(o.payments.paid_date) : today;
      const ctx = { today: deposit, wedding: toYmd(w.wedding_date), event: toYmd(o.event_date ?? w.wedding_date), deposit, albumDate: albumTask?.scheduled_date ? toYmd(albumTask.scheduled_date) : undefined };
      for (const t of planDetails(TIMELINE_TEMPLATES, key, ctx).tasks) if (t.urgent) urgent.add(t.code);
    }

    const items = tasks.map((t) => {
      const category = t.category_id ? (catById.get(t.category_id) ?? null) : null;
      const tpl = templateOf(t.task_code);
      const legacyBook = t.task_type === 'Frame' && !!t.task_code?.endsWith('_BOOK');
      const kind =
        t.task_code === null || tpl?.kind === 'SELF'
          ? 'TASK'
          : tpl?.kind === 'CHOOSE'
            ? 'CHOOSE'
            : tpl?.kind === 'BOOK' || legacyBook
              ? 'CATEGORY_DEADLINE'
              : t.order_id
                ? 'SERVICE_TASK'
                : 'TASK';
      const planned = category && (kind === 'CATEGORY_DEADLINE' || kind === 'CHOOSE') ? plan.get(category.slug) : undefined;
      const order = t.order_id ? orderById.get(t.order_id) : undefined;
      const done = t.status === 'Done';
      return {
        id: t.id,
        kind,
        title: t.title,
        dueDate: toYmd(t.scheduled_date),
        isDone: done,
        isCustom: t.task_code === null,
        category,
        serviceName: kind === 'SERVICE_TASK' ? (order?.vendor_profiles?.business_name ?? null) : (planned?.serviceName ?? null),
        planStatus: planned?.status ?? null,
        // SERVICE_TASK: dịch vụ của đơn (để "Hẹn với NCC"); CHOOSE / CATEGORY_DEADLINE: dịch vụ đang trong kế hoạch của hạng mục
        serviceId: kind === 'SERVICE_TASK' ? (order?.vendor_profiles?.id ?? null) : (planned?.serviceId ?? null),
        urgent: !done && !!t.task_code && urgent.has(t.task_code),
        // Việc neo theo ngày chụp album S mà khách chưa chốt ngày hẹn: ngày chỉ là tạm tính
        tentative: !done && tpl?.anchor === 'S',
        needsMeeting: !!tpl?.needsMeeting && !!t.order_id,
        appointmentDate: null as string | null, // cột appointment_date chờ chạy SQL (prisma/sql/2026-10-29-timeline-appointment-date.sql)
        /** SERVICE_TASK: ai làm việc này (CUSTOMER / VENDOR / BOTH); khách chỉ tick được CUSTOMER và BOTH */
        owner: kind === 'SERVICE_TASK' ? ownerOf(t.task_code) : null,
        /** SERVICE_TASK: mã đơn đang giữ việc */
        orderCode: kind === 'SERVICE_TASK' ? (order?.order_code ?? null) : null,
        /** SERVICE_TASK: ngày thực hiện của đơn đang giữ việc, và cờ lệch (sau ngày cưới: đơn cũ trước khi có luật, hoặc khách đổi ngày cưới) */
        orderEventDate: kind === 'SERVICE_TASK' && order?.event_date ? toYmd(order.event_date) : null,
        dateConflict: kind === 'SERVICE_TASK' && !!order?.event_date && !!w.wedding_date && toYmd(order.event_date) > toYmd(w.wedding_date),
        /** CATEGORY_DEADLINE chưa chốt: số việc chi tiết sẽ mở sau khi đặt cọc ("N việc chi tiết mở sau khi bạn đặt cọc") */
        detailCount: kind === 'CATEGORY_DEADLINE' && !done ? detailCountOf(keyOfCat(t.category_id)) : 0,
        /** CATEGORY_DEADLINE đang Todo: đơn ĐÃ CỌC rồi bị hủy gần nhất cùng hạng mục ("Đơn … với … đã hủy ngày …"); cọc đơn mới thì Mốc chốt xong và dòng này mất */
        cancelledOrder: kind === 'CATEGORY_DEADLINE' && !done ? cancelledOrderOf(t.category_id) : null,
      };
    }).map((i, idx) => ({ ...i, suggest: suggestOf(templateOf(tasks[idx].task_code), { done: i.isDone, hasCancelledOrder: !!i.cancelledOrder }) }));

    const daysLeft = w.wedding_date ? dayOf(toYmd(w.wedding_date)) - dayOf(today) : null;
    return { items, level: daysLeft !== null && daysLeft > 0 ? levelOf(daysLeft) : null, daysLeft };
  }

  /** Xem trước khi đổi ngày cưới: các việc sẽ đổi hạn (cũ → mới) và cảnh báo đơn lệch ngày. Không ghi gì. */
  async regeneratePreview(userId: string, weddingDate: unknown) {
    const w = await this.weddings.requireWedding(userId);
    if (!isDate(weddingDate)) return fail('VALIDATION_ERROR', 'Chọn ngày tổ chức hợp lệ.', 400);
    if (weddingDate <= vnYmd(new Date())) return fail('VALIDATION_ERROR', 'Ngày tổ chức phải sau hôm nay.', 400);
    const plan = await planWeddingDateChange(this.prisma, w.id, weddingDate);
    const daysLeft = dayOf(weddingDate) - dayOf(vnYmd(new Date()));
    const changes = plan.changes.sort((a, b) => a.newDate.localeCompare(b.newDate));
    return { count: changes.length, changes, warnings: plan.warnings, level: levelOf(daysLeft), daysLeft };
  }

  private async task(userId: string, id: string) {
    const w = await this.weddings.requireWedding(userId);
    const t = UUID.test(id) ? await this.prisma.timeline_tasks.findFirst({ where: { id, wedding_id: w.id } }) : null;
    return { wedding: w, task: t ?? fail('TIMELINE_ITEM_NOT_FOUND', 'Không tìm thấy việc trong timeline.', 404) };
  }

  /**
   * Hạn khách đặt phải nằm trong khoảng của loại việc (timeline-rules.ts dueBounds): việc tự thêm, khung, chi tiết trước sự kiện từ hôm nay đến ngày cưới
   * (đúng ngày cưới được), việc neo ngày thực hiện đến E, việc sau sự kiện từ mốc của nó, "Ngày thực hiện" cố định theo đơn.
   * `task` có: kiểm thêm thứ tự Chọn NCC / Mốc chốt cùng hạng mục.
   */
  private async checkDue(dueDate: unknown, weddingDate: Date | null, task?: { id: string; task_code: string | null; order_id: string | null; category_id: string | null; wedding_id: string | null }) {
    if (!isDate(dueDate)) return fail('VALIDATION_ERROR', 'Chọn hạn hợp lệ.', 400);
    if (!weddingDate) return fail('DUE_DATE_OUT_OF_RANGE', 'Hãy thiết lập ngày cưới trước.', 400);
    const order = task?.order_id ? await this.prisma.orders.findUnique({ where: { id: task.order_id }, select: { event_date: true } }) : null;
    const bounds = dueBounds(task?.task_code ?? null, { today: toYmd(todayVNDate()), wedding: toYmd(weddingDate), event: order?.event_date ? toYmd(order.event_date) : null });
    const issue = dueRangeIssue(dueDate, bounds);
    if (issue) return fail(bounds.fixed ? 'TIMELINE_ITEM_READONLY' : 'DUE_DATE_OUT_OF_RANGE', issue, 400);
    if (task?.category_id) {
      const siblings = await this.prisma.timeline_tasks.findMany({
        where: { wedding_id: task.wedding_id!, category_id: task.category_id, id: { not: task.id }, task_code: { not: null } },
        select: { task_code: true, scheduled_date: true, status: true },
      });
      const seq = sequenceIssue(task.task_code, dueDate, siblings.map((x) => ({ code: x.task_code, due: toYmd(x.scheduled_date), done: x.status === 'Done' })));
      if (seq) return fail('DUE_DATE_ORDER', seq, 400);
    }
    return new Date(dueDate);
  }

  async addTask(userId: string, body: { title?: string; dueDate?: string }) {
    const w = await this.weddings.requireWedding(userId);
    const title = body.title?.trim() ?? '';
    if (!title || title.length > 255) return fail('VALIDATION_ERROR', 'Nhập tên việc (tối đa 255 ký tự).', 400);
    const due = await this.checkDue(body.dueDate, w.wedding_date);
    await this.prisma.timeline_tasks.create({ data: { wedding_id: w.id, title, scheduled_date: due, status: 'Todo', task_type: 'Frame', display_order: 0 } });
    return this.get(userId);
  }

  async update(userId: string, id: string, body: { title?: string; dueDate?: string; isDone?: boolean }) {
    const { wedding, task } = await this.task(userId, id);
    const deadline = task.task_type === 'Frame' && !!task.task_code?.endsWith('_BOOK');
    const data: { title?: string; scheduled_date?: Date; status?: string; completed_date?: Date | null } = {};

    if (task.task_type === 'Detail' && !task.order_id) return fail('TIMELINE_ITEM_READONLY', 'Việc này mở ra sau khi đặt cọc dịch vụ.', 400);
    if (task.order_id && !canTick('COUPLE', ownerOf(task.task_code))) return fail('TIMELINE_ITEM_READONLY', 'Việc này do nhà cung cấp thực hiện và cập nhật. Bạn chỉ xem được tiến độ.', 403);
    if (body.title !== undefined) {
      if (task.task_code !== null) return fail('TIMELINE_ITEM_READONLY', 'Không đổi được tên việc mặc định.', 400);
      const title = body.title.trim();
      if (!title || title.length > 255) return fail('VALIDATION_ERROR', 'Nhập tên việc (tối đa 255 ký tự).', 400);
      data.title = title;
    }
    if (body.dueDate !== undefined) data.scheduled_date = await this.checkDue(body.dueDate, wedding.wedding_date, task);
    if (body.isDone !== undefined) {
      if (deadline) return fail('TIMELINE_ITEM_READONLY', 'Mốc "Chốt" tự hoàn thành khi đặt cọc dịch vụ.', 400);
      data.status = body.isDone ? 'Done' : 'Todo';
      data.completed_date = body.isDone ? new Date() : null;
    }
    if (Object.keys(data).length) await this.prisma.timeline_tasks.update({ where: { id }, data });
    if (task.order_id && (data.status !== undefined || data.scheduled_date !== undefined)) await this.publishTaskChange(userId, task.order_id, id);
    return this.get(userId);
  }

  /**
   * Việc gắn đơn vừa đổi trạng thái / hạn: báo NCC của đơn (và các phiên khác của khách) qua realtime để Lịch làm việc, Tiến độ đơn tải lại ngay.
   * Không tạo thông báo; lỗi tra cứu không làm hỏng việc đã lưu.
   */
  private async publishTaskChange(userId: string, orderId: string, taskId: string) {
    const o = await this.prisma.orders.findUnique({ where: { id: orderId }, select: { vendor_profiles: { select: { user_id: true } } } }).catch(() => null);
    const vendorUser = o?.vendor_profiles?.user_id;
    publish({ users: vendorUser ? [vendorUser, userId] : [userId], event: 'task', data: { orderId, taskId } });
  }

  async remove(userId: string, id: string) {
    const { task } = await this.task(userId, id);
    if (task.task_code !== null) return fail('TASK_NOT_CUSTOM', 'Chỉ xóa được việc do bạn thêm.', 409);
    await this.prisma.timeline_tasks.delete({ where: { id } });
    return this.get(userId);
  }
}
