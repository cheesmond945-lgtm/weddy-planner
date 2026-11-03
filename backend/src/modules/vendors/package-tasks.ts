/*
 * Việc chi tiết do NCC khai theo từng gói (bảng package_tasks, prisma/sql/2026-11-01-package-tasks.sql).
 * offset_days so với ngày thực hiện E của đơn: âm = trước, 0 = đúng ngày, dương = sau.
 * Module thuần (không import Nest / Prisma client) để test bằng mock.
 */

export const TASK_OWNERS = ['CUSTOMER', 'VENDOR', 'BOTH'] as const;
export type TaskOwner = (typeof TASK_OWNERS)[number];

export const MAX_TASKS_PER_PACKAGE = 40;
export const MAX_TITLE = 255;
export const MAX_NOTE = 500;
export const MIN_OFFSET = -365;
export const MAX_OFFSET = 120;

export interface PackageTaskInput {
  id?: unknown;
  title?: unknown;
  note?: unknown;
  owner?: unknown;
  offsetDays?: unknown;
}

export interface PackageTaskDto {
  id: string;
  title: string;
  note: string | null;
  owner: TaskOwner;
  offsetDays: number;
  sortOrder: number;
}

export interface ParsedTask {
  id?: string;
  title: string;
  note: string | null;
  owner: TaskOwner;
  offsetDays: number;
}

/** Lỗi theo dòng: `index` là vị trí trong mảng gửi lên (-1: lỗi chung của danh sách). */
export interface TaskError {
  index: number;
  field: 'tasks' | 'id' | 'title' | 'note' | 'owner' | 'offsetDays';
  message: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kiểm tra và chuẩn hóa danh sách việc; không đạt thì trả đủ lỗi (không dừng ở lỗi đầu). */
export function parseTasks(raw: unknown): { tasks: ParsedTask[]; errors: TaskError[] } {
  const errors: TaskError[] = [];
  if (!Array.isArray(raw)) return { tasks: [], errors: [{ index: -1, field: 'tasks', message: 'Danh sách công việc không hợp lệ.' }] };
  if (raw.length > MAX_TASKS_PER_PACKAGE) errors.push({ index: -1, field: 'tasks', message: `Tối đa ${MAX_TASKS_PER_PACKAGE} công việc mỗi gói.` });

  const tasks: ParsedTask[] = [];
  const seen = new Set<string>();
  raw.forEach((r: unknown, index) => {
    const t = (r && typeof r === 'object' ? r : {}) as PackageTaskInput;
    const bad = (field: TaskError['field'], message: string) => errors.push({ index, field, message });

    const title = typeof t.title === 'string' ? t.title.trim() : '';
    if (!title) bad('title', 'Vui lòng nhập tên công việc.');
    else if (title.length > MAX_TITLE) bad('title', `Tên công việc tối đa ${MAX_TITLE} ký tự.`);

    let note: string | null = null;
    if (t.note !== undefined && t.note !== null) {
      if (typeof t.note !== 'string') bad('note', 'Ghi chú không hợp lệ.');
      else {
        note = t.note.trim() || null;
        if (note && note.length > MAX_NOTE) bad('note', `Ghi chú tối đa ${MAX_NOTE} ký tự.`);
      }
    }

    const owner = t.owner as TaskOwner;
    if (!TASK_OWNERS.includes(owner)) bad('owner', 'Người phụ trách phải là CUSTOMER, VENDOR hoặc BOTH.');

    const off = t.offsetDays;
    if (typeof off !== 'number' || !Number.isInteger(off) || off < MIN_OFFSET || off > MAX_OFFSET) {
      bad('offsetDays', `Mốc thời gian phải là số nguyên từ ${MIN_OFFSET} đến ${MAX_OFFSET} ngày so với ngày thực hiện.`);
    }

    let id: string | undefined;
    if (t.id !== undefined && t.id !== null) {
      if (typeof t.id !== 'string' || !UUID.test(t.id)) bad('id', 'Mã công việc không hợp lệ.');
      else if (seen.has(t.id)) bad('id', 'Công việc bị trùng mã.');
      else {
        id = t.id;
        seen.add(t.id);
      }
    }
    tasks.push({ id, title, note, owner, offsetDays: off as number });
  });
  return { tasks, errors };
}

/** Phần của transaction Prisma mà đồng bộ cần: để test truyền mock. */
export interface PackageTasksTx {
  package_tasks: {
    findMany(args: unknown): Promise<{ id: string }[]>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
  };
}

/**
 * Thay toàn bộ danh sách việc của gói: có id (thuộc gói, chưa xóa) → cập nhật; không id → thêm; id cũ vắng mặt → xóa mềm (deleted_at).
 * sort_order = vị trí trong mảng. Có id không thuộc gói thì trả chỉ số các dòng đó (để báo 400) và không ghi gì.
 */
export async function syncPackageTasks(tx: PackageTasksTx, packageId: string, tasks: ParsedTask[], now = new Date()): Promise<{ foreign: number[] }> {
  const current = await tx.package_tasks.findMany({ where: { package_id: packageId, deleted_at: null }, select: { id: true } });
  const have = new Set(current.map((r) => r.id));
  const foreign = tasks.flatMap((t, i) => (t.id && !have.has(t.id) ? [i] : []));
  if (foreign.length) return { foreign };

  const keep = new Set(tasks.flatMap((t) => (t.id ? [t.id] : [])));
  const removed = [...have].filter((id) => !keep.has(id));
  if (removed.length) await tx.package_tasks.updateMany({ where: { id: { in: removed }, package_id: packageId }, data: { deleted_at: now, updated_date: now } });

  for (const [i, t] of tasks.entries()) {
    const data = { title: t.title, note: t.note, owner: t.owner, offset_days: t.offsetDays, sort_order: i, updated_date: now };
    if (t.id) await tx.package_tasks.update({ where: { id: t.id }, data });
    else await tx.package_tasks.create({ data: { ...data, package_id: packageId } });
  }
  return { foreign: [] };
}

export const toTaskDto = (r: { id: string; title: string; note: string | null; owner: string; offset_days: number; sort_order: number }): PackageTaskDto => ({
  id: r.id,
  title: r.title,
  note: r.note,
  owner: r.owner as TaskOwner,
  offsetDays: r.offset_days,
  sortOrder: r.sort_order,
});
