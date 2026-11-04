/*
 * Ưu đãi tặng bánh cưới, tháp ly của Trung tâm tiệc cưới: gói (sảnh) sức chứa từ GIFT_MIN_CAPACITY khách mới được tặng.
 * - Được tặng: có việc GIFT_TASK_TITLE trong công việc của gói, mô tả có câu GIFT_SENTENCE.
 * - Không tặng: không có việc đó, không có câu đó, và các việc chung không nhắc bánh / tháp ly (tránh hiểu là gói nào cũng tặng).
 * Áp khi NCC lưu gói, lưu công việc, và khi Admin duyệt bản cập nhật gói (sức chứa có thể đổi). Module thuần, có test.
 */
import { syncPackageTasks, type ParsedTask } from './package-tasks.ts';

export const GIFT_MIN_CAPACITY = 500;
export const GIFT_TASK_TITLE = 'Chuẩn bị bánh cưới, tháp ly tặng kèm';
/** Gói đã đủ điều kiện (sức chứa) nên ghi thẳng là tặng, không kèm điều kiện */
export const GIFT_SENTENCE = 'Tặng kèm bánh cưới và tháp ly.';

/** Việc tặng của gói: NCC chuẩn bị, trước ngày tiệc 2 ngày */
const GIFT_TASK: Omit<ParsedTask, 'id'> = { title: GIFT_TASK_TITLE, note: null, owner: 'VENDOR', offsetDays: -2 };

/** Câu tặng đã có trong mô tả (cả câu cũ "… khi đủ điều kiện ưu đãi của gói.") */
const GIFT_SENTENCE_RE = /\s*Tặng kèm bánh cưới và tháp ly[^.]*\./g;

export const isGiftTask = (title: string) => title.startsWith('Chuẩn bị bánh cưới, tháp ly');

export const hasGift = (capacity: number | null | undefined) => (capacity ?? 0) >= GIFT_MIN_CAPACITY;

/** Tên việc chung của gói KHÔNG tặng: bỏ chữ bánh, tháp ly và nghi thức cắt bánh. */
export function plainTitle(title: string) {
  return title
    .replace(/,\s*bánh,\s*tháp ly/gi, '')
    .replace(/nghi thức cắt bánh,\s*rót rượu/gi, 'các nghi thức')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Mô tả theo ưu đãi: được tặng thì có câu tặng ngay trước câu cuối (câu giá), không thì bỏ câu đó. */
export function giftDescription(description: string, gift: boolean) {
  const base = description.replace(GIFT_SENTENCE_RE, '').trim();
  if (!gift || !base) return base;
  const parts = base.split(/(?<=[.!?])\s+/);
  if (parts.length < 2) return `${base} ${GIFT_SENTENCE}`;
  const last = parts.pop()!;
  return [...parts, GIFT_SENTENCE, last].join(' ');
}

/** Danh sách công việc theo ưu đãi: thêm việc tặng (sau "Gửi thực đơn in…", không có thì cuối) hoặc bỏ việc tặng và chữ bánh, tháp ly. */
export function giftTasks(tasks: ParsedTask[], gift: boolean): ParsedTask[] {
  if (gift) {
    if (tasks.some((t) => isGiftTask(t.title))) return tasks;
    const i = tasks.findIndex((t) => t.title.startsWith('Gửi thực đơn in'));
    const at = i >= 0 ? i + 1 : tasks.length;
    return [...tasks.slice(0, at), { ...GIFT_TASK }, ...tasks.slice(at)];
  }
  return tasks.filter((t) => !isGiftTask(t.title)).map((t) => ({ ...t, title: plainTitle(t.title) }));
}

interface GiftTx {
  package_tasks: {
    findMany(args: object): Promise<{ id: string; title: string; note: string | null; owner: string; offset_days: number; sort_order: number }[]>;
  };
}

/** Công việc đang có của gói, theo thứ tự hiển thị, dạng ParsedTask (để chạy giftTasks rồi syncPackageTasks). */
export async function currentTasks(tx: GiftTx, packageId: string): Promise<ParsedTask[]> {
  const rows = await tx.package_tasks.findMany({ where: { package_id: packageId, deleted_at: null }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] });
  return rows.map((r) => ({ id: r.id, title: r.title, note: r.note, owner: r.owner as ParsedTask['owner'], offsetDays: r.offset_days }));
}

/** Danh sách có đổi so với hiện tại không (khỏi ghi lại khi đã đúng quy tắc). */
export const tasksChanged = (before: ParsedTask[], after: ParsedTask[]) =>
  before.length !== after.length || before.some((t, i) => t.id !== after[i].id || t.title !== after[i].title);

interface GiftWriteTx extends GiftTx {
  package_tasks: GiftTx['package_tasks'] & {
    updateMany(args: object): Promise<unknown>;
    update(args: object): Promise<unknown>;
    create(args: object): Promise<unknown>;
  };
}

/** Đưa công việc đang có của gói về đúng quy tắc tặng theo `capacity` (chỉ ghi khi có đổi). */
export async function applyGiftTasks(tx: GiftWriteTx, packageId: string, capacity: number | null | undefined) {
  const before = await currentTasks(tx, packageId);
  const after = giftTasks(before, hasGift(capacity));
  if (tasksChanged(before, after)) await syncPackageTasks(tx as never, packageId, after);
}
