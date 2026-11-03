/*
 * Luật đổi trạng thái / ngày của việc chi tiết gắn đơn (docs/TIMELINE.md, "Hướng mới 11/2026"). Hàm thuần: không đụng CSDL, không đọc đồng hồ.
 * NCC tự chủ việc chi tiết của đơn mình (mọi việc, kể cả việc của khách); khách chỉ xem.
 */
import { initialStatus, isCustomOrderTaskCode, PAY_PREFIX, PKG_PREFIX, type TaskStatus } from '../weddings/timeline-rows.ts';
import type { TaskOwner } from '../weddings/task-owner.ts';

export const TASK_STATUSES: readonly TaskStatus[] = ['Todo', 'Waiting', 'Done'];
/** Ngày NCC chốt / đổi lại tối đa sau ngày thực hiện của đơn */
export const SCHEDULE_MAX_AFTER_EVENT = 120;

export interface RuleError {
  code: string;
  message: string;
  status: number;
}

const dayOf = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000);
export const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Trạng thái mới từ body { status } hoặc { isDone } (tương thích FE cũ: isDone true là Done, false là trạng thái mặc định theo chủ việc:
 * việc của khách thì Waiting, còn lại Todo). Có cả hai thì `status` thắng.
 */
export function parseStatusBody(body: { status?: unknown; isDone?: unknown } | null | undefined, owner: TaskOwner): TaskStatus | RuleError {
  const bad = { code: 'VALIDATION_ERROR', message: 'status phải là Todo, Waiting hoặc Done.', status: 400 };
  if (body?.status !== undefined) return (TASK_STATUSES as readonly unknown[]).includes(body.status) ? (body.status as TaskStatus) : bad;
  if (typeof body?.isDone === 'boolean') return body.isDone ? 'Done' : initialStatus(owner);
  return bad;
}

export interface TaskCheck {
  /** Trạng thái của đơn */
  orderStatus: string | null;
  /** Việc có tồn tại, thuộc đúng đơn và là việc chi tiết */
  taskOfOrder: boolean;
}

/** Điều kiện chung khi NCC đổi trạng thái / ngày của một việc: đơn Deposited (409 ORDER_NOT_ACTIVE), việc thuộc đơn (404). Không kiểm owner. */
export function checkVendorTaskEdit(c: TaskCheck): RuleError | null {
  if (c.orderStatus !== 'Deposited') return { code: 'ORDER_NOT_ACTIVE', message: 'Chỉ cập nhật tiến độ khi đơn đang ở trạng thái Đã đặt cọc.', status: 409 };
  if (!c.taskOfOrder) return { code: 'TIMELINE_ITEM_NOT_FOUND', message: 'Không tìm thấy việc của đơn này.', status: 404 };
  return null;
}

/** Ngày chốt / đổi: từ hôm nay đến E + 120. null nếu hợp lệ. */
export function scheduleDateIssue(date: unknown, ctx: { today: string; event: string }): RuleError | null {
  if (!isYmd(date)) return { code: 'VALIDATION_ERROR', message: 'Chọn ngày hợp lệ (YYYY-MM-DD).', status: 400 };
  const dmy = (s: string) => s.split('-').reverse().join('/');
  if (date < ctx.today) return { code: 'DUE_DATE_OUT_OF_RANGE', message: 'Ngày không được trước hôm nay.', status: 400 };
  if (dayOf(date) > dayOf(ctx.event) + SCHEDULE_MAX_AFTER_EVENT) return { code: 'DUE_DATE_OUT_OF_RANGE', message: `Ngày không được quá ${SCHEDULE_MAX_AFTER_EVENT} ngày sau ngày thực hiện (${dmy(ctx.event)}).`, status: 400 };
  return null;
}

/** Khách không tick, đổi hạn, đổi tên, xóa việc gắn đơn: mọi việc có order_id là chỉ xem. */
export const customerReadonlyIssue = (task: { order_id: string | null }): RuleError | null =>
  task.order_id ? { code: 'TIMELINE_ITEM_READONLY', message: 'Việc này do nhà cung cấp quản lý. Bạn chỉ xem được tiến độ.', status: 403 } : null;

/** Dòng trả về cho FE: ngày đã chốt chưa. needsRecheck: ngày chốt của việc trước ngày thực hiện lại nằm sau ngày thực hiện hiện tại của đơn. */
export function dateStatusOf(confirmedDate: Date | null | undefined, confirmedAt: Date | null | undefined, ctx: { due: string; event: string; isPackageBefore?: boolean }) {
  return {
    dateStatus: confirmedDate ? ('CONFIRMED' as const) : ('PLANNED' as const),
    confirmedAt: confirmedAt ? confirmedAt.toISOString() : null,
    needsRecheck: !!confirmedDate && !!ctx.event && !!ctx.isPackageBefore && ctx.due > ctx.event,
  };
}

// ---------- Việc riêng của đơn (NCC thêm / sửa / bỏ việc cho TỪNG đơn đã cọc) ----------

const OWNERS: readonly TaskOwner[] = ['CUSTOMER', 'VENDOR', 'BOTH'];
export const ORDER_TASK_TITLE_MAX = 200;
export const ORDER_TASK_NOTE_MAX = 500;

const invalid = (message: string): RuleError => ({ code: 'VALIDATION_ERROR', message, status: 400 });

function textOf(v: unknown, max: number, label: string, required: boolean): string | null | RuleError {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return required ? invalid(`${label} không được để trống.`) : null;
  if (typeof v !== 'string') return invalid(`${label} không hợp lệ.`);
  return v.trim().length > max ? invalid(`${label} tối đa ${max} ký tự.`) : v.trim();
}

export interface NewOrderTask {
  title: string;
  note: string | null;
  owner: TaskOwner;
  date: string;
  addToPackage: boolean;
}

/** Body POST /vendors/me/orders/:id/tasks: { title, note?, owner, date, addToPackage? }. Ngày từ hôm nay đến E + 120. */
export function parseNewOrderTask(body: Record<string, unknown> | null | undefined, ctx: { today: string; event: string }): NewOrderTask | RuleError {
  const b = body ?? {};
  const title = textOf(b.title, ORDER_TASK_TITLE_MAX, 'Tên việc', true);
  if (typeof title !== 'string') return title ?? invalid('Tên việc không được để trống.');
  const note = textOf(b.note, ORDER_TASK_NOTE_MAX, 'Ghi chú', false);
  if (note !== null && typeof note !== 'string') return note;
  if (!OWNERS.includes(b.owner as TaskOwner)) return invalid('Chọn ai phụ trách: CUSTOMER, VENDOR hoặc BOTH.');
  const issue = scheduleDateIssue(b.date, ctx);
  if (issue) return issue;
  if (b.addToPackage !== undefined && typeof b.addToPackage !== 'boolean') return invalid('addToPackage phải là true hoặc false.');
  return { title, note, owner: b.owner as TaskOwner, date: b.date as string, addToPackage: b.addToPackage === true };
}

export interface OrderTaskPatch {
  title?: string;
  note?: string | null;
  owner?: TaskOwner;
}

/** Body PATCH sửa việc riêng: { title?, note?, owner? } (ít nhất một trường). */
export function parseOrderTaskPatch(body: Record<string, unknown> | null | undefined): OrderTaskPatch | RuleError {
  const b = body ?? {};
  const out: OrderTaskPatch = {};
  if (b.title !== undefined) {
    const t = textOf(b.title, ORDER_TASK_TITLE_MAX, 'Tên việc', true);
    if (typeof t !== 'string') return t ?? invalid('Tên việc không được để trống.');
    out.title = t;
  }
  if (b.note !== undefined) {
    const n = textOf(b.note, ORDER_TASK_NOTE_MAX, 'Ghi chú', false);
    if (n !== null && typeof n !== 'string') return n;
    out.note = n;
  }
  if (b.owner !== undefined) {
    if (!OWNERS.includes(b.owner as TaskOwner)) return invalid('Chọn ai phụ trách: CUSTOMER, VENDOR hoặc BOTH.');
    out.owner = b.owner as TaskOwner;
  }
  return Object.keys(out).length ? out : invalid('Không có gì để sửa (title, note hoặc owner).');
}

/** Sửa tên / ghi chú / chủ: chỉ việc riêng 'ORD:' và chưa xong. */
export function editOrderTaskIssue(task: { task_code: string | null; status: string | null }): RuleError | null {
  if (!isCustomOrderTaskCode(task.task_code)) return { code: 'TASK_NOT_EDITABLE', message: 'Chỉ sửa được việc riêng của đơn. Việc của gói hãy đổi trong gói dịch vụ.', status: 409 };
  if (task.status === 'Done') return { code: 'TASK_ALREADY_DONE', message: 'Việc đã xong, không sửa được.', status: 409 };
  return null;
}

/** "Bỏ việc khỏi đơn": việc của gói ('PKG:') hoặc việc riêng ('ORD:'), chưa xong. Không bỏ việc thanh toán ('PAY:') và việc chi tiết cũ. */
export function removeOrderTaskIssue(task: { task_code: string | null; status: string | null }): RuleError | null {
  const code = task.task_code ?? '';
  if (code.startsWith(PAY_PREFIX)) return { code: 'TASK_NOT_REMOVABLE', message: 'Không bỏ được việc thanh toán của đơn.', status: 409 };
  if (!code.startsWith(PKG_PREFIX) && !isCustomOrderTaskCode(code)) return { code: 'TASK_NOT_REMOVABLE', message: 'Việc này không bỏ khỏi đơn được.', status: 409 };
  if (task.status === 'Done') return { code: 'TASK_ALREADY_DONE', message: 'Việc đã xong, không bỏ được.', status: 409 };
  return null;
}
