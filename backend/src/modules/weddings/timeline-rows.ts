/*
 * Chuyển kế hoạch ngày (timeline-schedule.ts) thành dòng timeline_tasks. Hàm thuần, không đụng CSDL:
 * dùng chung cho hook (timeline-hooks.ts) và script dựng lại timeline (scripts/rebuild-timelines.ts).
 *
 * Việc chi tiết của đơn lấy từ package_tasks của gói gắn với đơn (NCC khai), sinh lúc cọc:
 *   task_code 'PKG:<package_tasks.id>:<8 ký tự đầu của order_id>' mỗi việc của gói (hậu tố để hai đơn dùng cùng gói không trùng mã trong một đám cưới;
 *   dạng cũ 'PKG:<id>' vẫn đọc được); 'PAY:<orderId>' việc thanh toán phần còn lại (mỗi đơn một việc).
 */
import { planFrame, planPackageTasks } from './timeline-schedule.ts';
import { isFrameKind, type ServiceKey, type TimelineTemplate } from './timeline-templates.ts';

export interface ServiceRef {
  key: ServiceKey;
  categoryId: string;
}

/** Todo: NCC đang làm; Waiting: chờ khách; Done: xong. Cột status là varchar nên không phải đổi CSDL. */
export type TaskStatus = 'Todo' | 'Waiting' | 'Done';

export interface TaskRow {
  wedding_id: string;
  category_id: string | null;
  order_id: string | null;
  title: string;
  scheduled_date: Date;
  status: TaskStatus;
  completed_date?: Date | null;
  task_type: 'Frame' | 'Detail';
  task_code: string;
  display_order: number;
}

const asDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export const PKG_PREFIX = 'PKG:';
export const PAY_PREFIX = 'PAY:';
/** 'PKG:' + 36 + ':' + 8 = 49 ký tự (cột task_code tối đa 50). */
export const pkgCode = (packageTaskId: string, orderId: string) => `${PKG_PREFIX}${packageTaskId}:${orderId.slice(0, 8)}`;
export const payCode = (orderId: string) => `${PAY_PREFIX}${orderId}`;
/** Id việc của gói trong task_code, hoặc null nếu không phải việc của gói. */
export const pkgTaskIdOf = (code: string | null | undefined) => (code?.startsWith(PKG_PREFIX) ? code.slice(PKG_PREFIX.length).split(':')[0] : null);
export const isOrderTaskCode = (code: string | null | undefined) => !!code && (code.startsWith(PKG_PREFIX) || code.startsWith(PAY_PREFIX));

/** Việc khung: Tự làm của "Chung" và Tự làm / Chọn NCC / Mốc chốt của các hạng mục đã chọn, hạn tính từ ngày cưới. */
export function frameRows(templates: readonly TimelineTemplate[], input: { weddingId: string; wedding: string; today: string; services: readonly ServiceRef[] }): TaskRow[] {
  const plan = planFrame(templates, { wedding: input.wedding, today: input.today, services: input.services.map((s) => s.key) });
  const byCode = new Map(templates.map((t) => [t.code, t]));
  return plan.tasks.map((p) => {
    const t = byCode.get(p.code)!;
    return {
      wedding_id: input.weddingId,
      category_id: t.service ? (input.services.find((s) => s.key === t.service)?.categoryId ?? null) : null,
      order_id: null,
      title: t.title,
      scheduled_date: asDate(p.date),
      status: 'Todo' as const,
      task_type: isFrameKind(t.kind) ? ('Frame' as const) : ('Detail' as const),
      task_code: t.code,
      display_order: t.order,
    };
  });
}

export type PackageTaskOwner = 'CUSTOMER' | 'VENDOR' | 'BOTH';

/** Một việc NCC khai cho gói (package_tasks), theo đúng thứ tự cần hiển thị. */
export interface PackageTaskRef {
  id: string;
  title: string;
  note: string | null;
  owner: PackageTaskOwner;
  /** So với ngày thực hiện E của đơn */
  offsetDays: number;
}

const TITLE_MAX = 255;
/** Tên việc trên timeline: tên + " — " + ghi chú nếu có, cắt còn tối đa 255 ký tự. */
export function taskTitle(title: string, note: string | null): string {
  const full = note?.trim() ? `${title.trim()} — ${note.trim()}` : title.trim();
  return full.length > TITLE_MAX ? `${full.slice(0, TITLE_MAX - 1)}…` : full;
}

/** Việc của khách thì chờ khách (Waiting), còn lại NCC làm (Todo). */
export const initialStatus = (owner: PackageTaskOwner): TaskStatus => (owner === 'CUSTOMER' ? 'Waiting' : 'Todo');

const PAY_DISPLAY_ORDER = 1000;
const PKG_DISPLAY_ORDER = 100;

/**
 * Việc chi tiết của một đơn vừa đặt cọc: mỗi việc trong gói (mọi gói của đơn gộp lại, đúng thứ tự đưa vào) cộng một việc thanh toán phần còn lại.
 * Hạn tính bằng planPackageTasks từ D, E, I; thanh toán = max(E + 7, hạn lớn nhất của việc gói). Bỏ qua mã đã có (chạy lại không sinh trùng).
 * `vendorProcessMissing`: đơn không có việc nào của gói (không gắn gói, hoặc gói chưa khai việc): chỉ sinh việc thanh toán.
 */
export function orderTaskRows(input: {
  weddingId: string;
  orderId: string;
  categoryId: string | null;
  vendorName: string;
  ctx: { today: string; event: string; deposit: string };
  tasks: readonly PackageTaskRef[];
  existingCodes?: ReadonlySet<string>;
}): { rows: TaskRow[]; vendorProcessMissing: boolean } {
  const have = input.existingCodes ?? new Set<string>();
  const plan = planPackageTasks({ D: input.ctx.deposit, E: input.ctx.event, I: input.ctx.today, tasks: input.tasks.map((t) => ({ id: t.id, offsetDays: t.offsetDays })) });
  const dateOf = new Map(plan.tasks.map((p) => [p.id, p.date]));
  const base = { wedding_id: input.weddingId, category_id: input.categoryId, order_id: input.orderId, task_type: 'Detail' as const };

  const rows: TaskRow[] = input.tasks.map((t, i) => ({
    ...base,
    title: taskTitle(t.title, t.note),
    scheduled_date: asDate(dateOf.get(t.id)!),
    status: initialStatus(t.owner),
    task_code: pkgCode(t.id, input.orderId),
    display_order: PKG_DISPLAY_ORDER + i,
  }));
  const last = plan.tasks.reduce((m, p) => (p.date > m ? p.date : m), '');
  rows.push({
    ...base,
    title: `Thanh toán phần còn lại cho ${input.vendorName.trim() || 'nhà cung cấp'}`,
    scheduled_date: asDate(payDate(input.ctx.event, last)),
    status: 'Waiting',
    task_code: payCode(input.orderId),
    display_order: PAY_DISPLAY_ORDER,
  });
  return { rows: rows.filter((r) => !have.has(r.task_code)), vendorProcessMissing: input.tasks.length === 0 };
}

/** Hạn thanh toán phần còn lại: sau ngày thực hiện 7 ngày, và không sớm hơn việc cuối của gói. */
export function payDate(event: string, lastPackageDate: string): string {
  const e7 = new Date(Date.parse(`${event}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  return lastPackageDate > e7 ? lastPackageDate : e7;
}

export interface OrderTaskState {
  /** timeline_tasks.id */
  id: string;
  code: string;
  status: string | null;
  /** Đã có dòng task_confirmations (NCC chốt ngày) */
  confirmed: boolean;
  /** Hạn hiện tại "YYYY-MM-DD" */
  date: string;
}

/**
 * NCC sửa ngày thực hiện của đơn đã cọc: tính lại hạn các việc của gói (PKG) và việc thanh toán (PAY) CHƯA xong và CHƯA chốt theo E mới.
 * Việc đã xong, việc đã chốt giữ ngày; việc chốt trước E mà ngày chốt nằm sau E mới thì vào needsRecheck (NCC cần chốt lại với khách).
 * Việc chi tiết cũ (mã mẫu) không đụng tới. `offsets`: package_tasks.id -> offsetDays (kể cả việc của gói đã xóa mềm).
 */
export function replanOrderTasks(input: { ctx: { today: string; event: string; deposit: string }; tasks: readonly OrderTaskState[]; offsets: ReadonlyMap<string, number> }): {
  updates: { id: string; date: string }[];
  needsRecheck: string[];
} {
  const pkg = input.tasks.flatMap((t) => {
    const pid = pkgTaskIdOf(t.code);
    return pid && input.offsets.has(pid) ? [{ t, pid, offsetDays: input.offsets.get(pid)! }] : [];
  });
  const plan = planPackageTasks({ D: input.ctx.deposit, E: input.ctx.event, I: input.ctx.today, tasks: pkg.map((p) => ({ id: p.pid, offsetDays: p.offsetDays })) });
  const planned = new Map(plan.tasks.map((p) => [p.id, p.date]));
  const locked = (t: OrderTaskState) => t.status === 'Done' || t.confirmed;

  const updates: { id: string; date: string }[] = [];
  const final: string[] = [];
  const needsRecheck: string[] = [];
  for (const p of pkg) {
    const date = locked(p.t) ? p.t.date : planned.get(p.pid)!;
    final.push(date);
    if (!locked(p.t) && date !== p.t.date) updates.push({ id: p.t.id, date });
    if (p.t.confirmed && p.offsetDays < 0 && p.t.date > input.ctx.event) needsRecheck.push(p.t.id);
  }
  const last = final.reduce((m, d) => (d > m ? d : m), '');
  for (const t of input.tasks) {
    if (!t.code.startsWith(PAY_PREFIX) || locked(t)) continue;
    const date = payDate(input.ctx.event, last);
    if (date !== t.date) updates.push({ id: t.id, date });
  }
  return { updates, needsRecheck };
}

export interface CancelInput {
  /** Việc chi tiết đang gắn với đơn bị hủy */
  details: readonly { id: string; status: string | null }[];
  /** Đơn khác cùng hạng mục của khách: Deposited / Completed */
  others: readonly { id: string; status: string }[];
}

/**
 * Khi đơn đã cọc bị hủy: gỡ các việc chi tiết CHƯA xong của đơn; việc đã xong GIỮ LẠI (lịch sử). Còn đơn khác cùng hạng mục đã cọc / hoàn thành
 * thì Mốc chốt vẫn xong; không còn thì Mốc chốt về Todo (nhóm quay lại trạng thái khóa). Hàm thuần, không đụng CSDL.
 */
export function cancelPlan(input: CancelInput): { deleteIds: string[]; reopenBook: boolean } {
  return { deleteIds: input.details.filter((d) => d.status !== 'Done').map((d) => d.id), reopenBook: input.others.length === 0 };
}
