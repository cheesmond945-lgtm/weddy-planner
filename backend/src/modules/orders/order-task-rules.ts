/*
 * Luật đổi trạng thái / ngày của việc chi tiết gắn đơn (docs/TIMELINE.md, "Hướng mới 11/2026"). Hàm thuần: không đụng CSDL, không đọc đồng hồ.
 * NCC tự chủ việc chi tiết của đơn mình (mọi việc, kể cả việc của khách); khách chỉ xem.
 */
import { initialStatus, type TaskStatus } from '../weddings/timeline-rows.ts';
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
