import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { todayVNDate, toYmd } from './timeline-hooks';
import { WeddingsService } from './weddings.service';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Timeline theo CSDL (timeline_tasks):
 * - Frame có task_code kết thúc _BOOK  -> CATEGORY_DEADLINE ("Chốt <hạng mục>", xong khi đã cọc)
 * - Frame còn lại: có hạng mục -> TASK mẫu (sửa hạn/đánh dấu xong); không có task_code -> việc do cặp đôi thêm (isCustom)
 * - Detail gắn đơn -> SERVICE_TASK; Detail chưa có đơn -> LOCKED (chỗ giữ)
 */
@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService, private readonly weddings: WeddingsService) {}

  async get(userId: string) {
    const w = await this.weddings.requireWedding(userId);
    const [tasks, cats, plan, orders] = await Promise.all([
      this.prisma.timeline_tasks.findMany({ where: { wedding_id: w.id }, orderBy: [{ scheduled_date: 'asc' }, { display_order: 'asc' }, { created_date: 'asc' }] }),
      this.prisma.service_categories.findMany(),
      this.weddings.planSnapshot(userId, w.id),
      this.prisma.orders.findMany({ where: { wedding_id: w.id }, select: { id: true, vendor_profiles: { select: { business_name: true } } } }),
    ]);
    const catById = new Map(cats.map((c) => [c.id, { id: c.id, slug: categorySlug(c.name), name: c.name }]));
    const vendorByOrder = new Map(orders.map((o) => [o.id, o.vendor_profiles?.business_name ?? '']));

    const items = tasks.map((t) => {
      const category = t.category_id ? (catById.get(t.category_id) ?? null) : null;
      const deadline = t.task_type === 'Frame' && !!t.task_code?.endsWith('_BOOK');
      const kind = t.task_type === 'Detail' ? (t.order_id ? 'SERVICE_TASK' : 'LOCKED') : deadline ? 'CATEGORY_DEADLINE' : 'TASK';
      const planned = deadline && category ? plan.get(category.slug) : undefined;
      return {
        id: t.id,
        kind,
        title: t.title,
        dueDate: kind === 'LOCKED' ? null : toYmd(t.scheduled_date),
        isDone: t.status === 'Done',
        isCustom: t.task_code === null,
        category,
        serviceName: kind === 'SERVICE_TASK' ? (vendorByOrder.get(t.order_id!) ?? null) : (planned?.serviceName ?? null),
        planStatus: planned?.status ?? null,
        serviceId: planned?.serviceId ?? null,
      };
    });
    return { items };
  }

  private async task(userId: string, id: string) {
    const w = await this.weddings.requireWedding(userId);
    const t = UUID.test(id) ? await this.prisma.timeline_tasks.findFirst({ where: { id, wedding_id: w.id } }) : null;
    return { wedding: w, task: t ?? fail('TIMELINE_ITEM_NOT_FOUND', 'Không tìm thấy việc trong timeline.', 404) };
  }

  private checkDue(dueDate: unknown, weddingDate: Date | null) {
    if (!isDate(dueDate)) return fail('VALIDATION_ERROR', 'Chọn hạn hợp lệ.', 400);
    if (!weddingDate || dueDate < toYmd(todayVNDate()) || dueDate >= toYmd(weddingDate)) {
      return fail('DUE_DATE_OUT_OF_RANGE', 'Hạn phải từ hôm nay đến trước ngày cưới.', 400);
    }
    return new Date(dueDate);
  }

  async addTask(userId: string, body: { title?: string; dueDate?: string }) {
    const w = await this.weddings.requireWedding(userId);
    const title = body.title?.trim() ?? '';
    if (!title || title.length > 255) return fail('VALIDATION_ERROR', 'Nhập tên việc (tối đa 255 ký tự).', 400);
    const due = this.checkDue(body.dueDate, w.wedding_date);
    await this.prisma.timeline_tasks.create({ data: { wedding_id: w.id, title, scheduled_date: due, status: 'Todo', task_type: 'Frame', display_order: 0 } });
    return this.get(userId);
  }

  async update(userId: string, id: string, body: { title?: string; dueDate?: string; isDone?: boolean }) {
    const { wedding, task } = await this.task(userId, id);
    const deadline = task.task_type === 'Frame' && !!task.task_code?.endsWith('_BOOK');
    const data: { title?: string; scheduled_date?: Date; status?: string; completed_date?: Date | null } = {};

    if (task.task_type === 'Detail' && !task.order_id) return fail('TIMELINE_ITEM_READONLY', 'Việc này mở ra sau khi đặt cọc dịch vụ.', 400);
    if (body.title !== undefined) {
      if (task.task_code !== null) return fail('TIMELINE_ITEM_READONLY', 'Không đổi được tên việc mặc định.', 400);
      const title = body.title.trim();
      if (!title || title.length > 255) return fail('VALIDATION_ERROR', 'Nhập tên việc (tối đa 255 ký tự).', 400);
      data.title = title;
    }
    if (body.dueDate !== undefined) data.scheduled_date = this.checkDue(body.dueDate, wedding.wedding_date);
    if (body.isDone !== undefined) {
      if (deadline) return fail('TIMELINE_ITEM_READONLY', 'Mốc "Chốt" tự hoàn thành khi đặt cọc dịch vụ.', 400);
      data.status = body.isDone ? 'Done' : 'Todo';
      data.completed_date = body.isDone ? new Date() : null;
    }
    if (Object.keys(data).length) await this.prisma.timeline_tasks.update({ where: { id }, data });
    return this.get(userId);
  }

  async remove(userId: string, id: string) {
    const { task } = await this.task(userId, id);
    if (task.task_code !== null) return fail('TASK_NOT_CUSTOM', 'Chỉ xóa được việc do bạn thêm.', 409);
    await this.prisma.timeline_tasks.delete({ where: { id } });
    return this.get(userId);
  }
}
