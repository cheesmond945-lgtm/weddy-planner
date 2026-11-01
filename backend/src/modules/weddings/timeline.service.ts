import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { todayVNDate, toYmd } from './timeline-hooks';
import { WeddingsService } from './weddings.service';
import { dbFeatures, requireDbFeature } from '../../prisma/db-features';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

/** Phụ trách: API dùng chữ hoa, DB dùng PascalCase (timeline_tasks.assignee). */
const ASSIGNEE_DTO = { Bride: 'BRIDE', Groom: 'GROOM', Both: 'BOTH', Member: 'MEMBER' } as const;
const ASSIGNEE_DB: Record<string, 'Bride' | 'Groom' | 'Both' | 'Member'> = { BRIDE: 'Bride', GROOM: 'Groom', BOTH: 'Both', MEMBER: 'Member' };

export interface TimelineUpdateBody {
  title?: string;
  dueDate?: string;
  isDone?: boolean;
  /** BRIDE | GROOM | BOTH | MEMBER (kèm assigneeUserId) | null (bỏ giao) */
  assignee?: string | null;
  assigneeUserId?: string | null;
  /** Ghi chú tối đa 200 ký tự, chuỗi rỗng hoặc null để xóa */
  note?: string | null;
}

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

  /** Tên hiển thị của các thành viên (tên owner đặt khi mời, nếu không thì họ tên) và quan hệ. */
  private async people(weddingId: string) {
    const rows = await this.prisma.wedding_members.findMany({ where: { wedding_id: weddingId }, include: { users: { select: { full_name: true } } } });
    return new Map(rows.map((m) => [m.user_id, { name: m.display_name || m.users.full_name, relation: m.relation as 'Bride' | 'Groom' | 'Relative' | null, role: m.role }]));
  }

  async get(userId: string) {
    const w = await this.weddings.requireWedding(userId);
    const [tasks, cats, plan, orders, people] = await Promise.all([
      this.prisma.timeline_tasks.findMany({ where: { wedding_id: w.id }, orderBy: [{ scheduled_date: 'asc' }, { display_order: 'asc' }, { created_date: 'asc' }] }),
      this.prisma.service_categories.findMany(),
      this.weddings.planSnapshot(w.user_id, w.id),
      this.prisma.orders.findMany({ where: { wedding_id: w.id }, select: { id: true, vendor_profiles: { select: { business_name: true } } } }),
      this.people(w.id),
    ]);
    const person = (id: string | null) => (id ? { userId: id, name: people.get(id)?.name ?? 'Người đã rời kế hoạch' } : null);
    const catById = new Map(cats.map((c) => [c.id, { id: c.id, slug: categorySlug(c.name), name: c.name }]));
    const vendorByOrder = new Map(orders.map((o) => [o.id, o.vendor_profiles.business_name]));

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
        assignee: t.assignee ? { kind: ASSIGNEE_DTO[t.assignee as keyof typeof ASSIGNEE_DTO], userId: t.assignee_user_id, name: t.assignee_user_id ? (person(t.assignee_user_id)?.name ?? null) : null } : null,
        note: t.note ? { text: t.note, by: person(t.note_by), date: t.note_date?.toISOString() ?? null } : null,
        completedBy: t.status === 'Done' ? person(t.completed_by) : null,
      };
    });
    return { items };
  }

  private async task(userId: string, id: string) {
    const w = await this.weddings.requireWedding(userId);
    const t = UUID.test(id) ? await this.prisma.timeline_tasks.findFirst({ where: { id, wedding_id: w.id } }) : null;
    return { wedding: w, task: t ?? fail('TIMELINE_ITEM_NOT_FOUND', 'Không tìm thấy việc trong timeline.', 404) };
  }

  private checkDue(dueDate: unknown, weddingDate: Date) {
    if (!isDate(dueDate)) return fail('VALIDATION_ERROR', 'Chọn hạn hợp lệ.', 400);
    if (dueDate < toYmd(todayVNDate()) || dueDate >= toYmd(weddingDate)) {
      return fail('DUE_DATE_OUT_OF_RANGE', 'Hạn phải từ hôm nay đến trước ngày cưới.', 400);
    }
    return new Date(dueDate);
  }

  async addTask(userId: string, body: Pick<TimelineUpdateBody, 'title' | 'dueDate' | 'assignee' | 'assigneeUserId' | 'note'>) {
    const w = await this.weddings.requireWedding(userId);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 255) return fail('VALIDATION_ERROR', 'Nhập tên việc (tối đa 255 ký tự).', 400);
    const due = this.checkDue(body.dueDate, w.wedding_date);
    if ((body.assignee !== undefined && body.assignee !== null) || (typeof body.note === 'string' && body.note.trim())) requireDbFeature('timelineAssign');
    const assignee = body.assignee !== undefined ? await this.checkAssignee(w.id, body) : {};
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > 200) return fail('VALIDATION_ERROR', 'Ghi chú tối đa 200 ký tự.', 400);
    await this.prisma.timeline_tasks.create({
      data: { wedding_id: w.id, title, scheduled_date: due, status: 'Todo', task_type: 'Frame', display_order: 0, ...assignee, ...(note && { note, note_by: userId, note_date: new Date() }) },
    });
    return this.get(userId);
  }

  /** Kiểm tra người được giao. Thành viên là cô dâu hoặc chú rể thì lưu là Bride/Groom (P4). */
  private async checkAssignee(weddingId: string, body: TimelineUpdateBody) {
    if (body.assignee === null || body.assignee === '') return { assignee: null, assignee_user_id: null };
    const kind = ASSIGNEE_DB[String(body.assignee)];
    if (!kind) return fail('VALIDATION_ERROR', 'Người phụ trách không hợp lệ.', 400);
    if (kind !== 'Member') return { assignee: kind, assignee_user_id: null };
    const uid = String(body.assigneeUserId ?? '');
    const m = UUID.test(uid) ? (await this.people(weddingId)).get(uid) : undefined;
    if (!m || m.role === 'Owner') return fail('MEMBER_NOT_FOUND', 'Không tìm thấy thành viên để giao việc.', 404);
    if (m.relation === 'Bride' || m.relation === 'Groom') return { assignee: m.relation, assignee_user_id: null };
    return { assignee: 'Member', assignee_user_id: uid };
  }

  async update(userId: string, id: string, body: TimelineUpdateBody) {
    const { wedding, task } = await this.task(userId, id);
    const deadline = task.task_type === 'Frame' && !!task.task_code?.endsWith('_BOOK');
    const data: {
      title?: string;
      scheduled_date?: Date;
      status?: string;
      completed_date?: Date | null;
      completed_by?: string | null;
      assignee?: string | null;
      assignee_user_id?: string | null;
      note?: string | null;
      note_by?: string | null;
      note_date?: Date | null;
    } = {};

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
      if (dbFeatures.timelineAssign) data.completed_by = body.isDone ? userId : null;
    }
    if (body.assignee !== undefined || body.note !== undefined) requireDbFeature('timelineAssign');
    if (body.assignee !== undefined) Object.assign(data, await this.checkAssignee(wedding.id, body));
    if (body.note !== undefined) {
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (body.note !== null && typeof body.note !== 'string') return fail('VALIDATION_ERROR', 'Ghi chú không hợp lệ.', 400);
      if (note.length > 200) return fail('VALIDATION_ERROR', 'Ghi chú tối đa 200 ký tự.', 400);
      Object.assign(data, note ? { note, note_by: userId, note_date: new Date() } : { note: null, note_by: null, note_date: null });
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
