/*
 * Chủ của việc chi tiết gắn đơn (docs/TIMELINE.md mục 8) và luật nhắc hạn. Hàm thuần: không đụng CSDL, không đọc đồng hồ.
 * Ngày là chuỗi "YYYY-MM-DD"; "hôm nay" do nơi gọi truyền vào.
 */
import { templateOf } from './timeline-templates.ts';

/** CUSTOMER chỉ khách làm; VENDOR chỉ NCC làm; BOTH hai bên cùng làm, bên nào xong trước thì tick. */
export type TaskOwner = 'CUSTOMER' | 'VENDOR' | 'BOTH';
export type TaskRole = 'COUPLE' | 'VENDOR';

/** Việc chi tiết mà riêng khách làm (gửi tài liệu, chọn, duyệt, trả đồ). Thanh toán phần còn lại cũng là việc của khách. */
const CUSTOMER_CODES = new Set(['DECOR_BRIEF', 'PHOTO_PICK_EDIT', 'PHOTO_REVIEW', 'FLOWER_PICK_STYLE', 'ATTIRE_RETURN']);

/**
 * Chủ của việc theo mã mẫu: Ngày thực hiện (EVENT) do NCC; Thanh toán do khách; việc chi tiết còn lại hai bên cùng làm trừ
 * danh sách của khách. "Nhận hoa, kiểm tra độ tươi" (FLOWER_EVENT) là ngày thực hiện nhưng khách phải kiểm nên hai bên.
 * Mã lạ (timeline cũ) hoặc việc không thuộc mẫu: hai bên.
 */
export function ownerOf(code: string | null | undefined): TaskOwner {
  const tpl = templateOf(code);
  if (!tpl) return 'BOTH';
  if (CUSTOMER_CODES.has(tpl.code) || tpl.kind === 'PAYMENT') return 'CUSTOMER';
  if (tpl.kind === 'EVENT') return tpl.code === 'FLOWER_EVENT' ? 'BOTH' : 'VENDOR';
  return 'BOTH';
}

/** Vai này được đánh dấu xong / đổi hạn việc của chủ `owner` không. */
export const canTick = (role: TaskRole, owner: TaskOwner) => owner === 'BOTH' || (role === 'COUPLE' ? owner === 'CUSTOMER' : owner === 'VENDOR');

// ---------- Nhắc hạn ----------

/** Nhắc "sắp đến hạn" khi còn từng này ngày (gồm đúng hôm nay). */
export const DUE_SOON_DAYS = 2;
/** Nhắc "quá hạn" khi trễ từ 1 đến từng này ngày; quá nữa là dữ liệu cũ, không nhắc dồn. */
export const OVERDUE_MAX_DAYS = 14;

export type ReminderStage = 'DUE_SOON' | 'OVERDUE';

const dayOf = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000);
export const dmyOf = (s: string) => s.split('-').reverse().join('/');

/** Giai đoạn nhắc của một việc chưa xong theo hạn; null nếu chưa tới lúc (hoặc trễ quá lâu). */
export function reminderStage(due: string, today: string): ReminderStage | null {
  const diff = dayOf(due) - dayOf(today);
  if (diff >= 0 && diff <= DUE_SOON_DAYS) return 'DUE_SOON';
  if (diff < 0 && -diff <= OVERDUE_MAX_DAYS) return 'OVERDUE';
  return null;
}

export interface ReminderTask {
  title: string;
  orderCode: string;
  vendorName: string;
  due: string;
  owner: TaskOwner;
}

export interface Reminder {
  to: TaskRole;
  type: 'TaskDueSoon' | 'TaskOverdue';
  title: string;
  content: string;
}

/**
 * Ai nhận nhắc gì:
 * - Chủ việc (khách, NCC, hoặc cả hai) nhận "sắp đến hạn" và "quá hạn".
 * - Việc của NCC / hai bên mà NCC làm trễ: khách cũng nhận "NCC chưa cập nhật" (chính sách quá hạn, mục 8.3).
 * - Việc của khách trễ: NCC không nhận thông báo (chỉ thấy trên Tiến độ đơn).
 */
export function remindersFor(t: ReminderTask, stage: ReminderStage): Reminder[] {
  const due = dmyOf(t.due);
  const ref = `"${t.title}" của đơn ${t.orderCode}`;
  const mine = (to: TaskRole): Reminder =>
    stage === 'DUE_SOON'
      ? { to, type: 'TaskDueSoon', title: 'Việc sắp đến hạn', content: `Việc ${ref} hạn ${due}.` }
      : { to, type: 'TaskOverdue', title: 'Việc đã quá hạn', content: `Việc ${ref} đã quá hạn ${due}. Hãy hoàn thành và cập nhật trạng thái.` };
  const out: Reminder[] = [];
  if (t.owner === 'CUSTOMER' || t.owner === 'BOTH') out.push(mine('COUPLE'));
  if (t.owner === 'VENDOR' || t.owner === 'BOTH') out.push(mine('VENDOR'));
  if (stage === 'OVERDUE' && t.owner === 'VENDOR') {
    out.push({ to: 'COUPLE', type: 'TaskOverdue', title: 'Nhà cung cấp chưa cập nhật việc', content: `${t.vendorName || 'Nhà cung cấp'} chưa cập nhật việc ${ref} (hạn ${due}). Bạn nhắn nhà cung cấp trong chat để hỏi tiến độ.` });
  }
  return out;
}

// ---------- Tiến độ đơn (phía NCC) ----------

export interface ProgressTask {
  due: string;
  done: boolean;
  owner: TaskOwner;
  title?: string;
}

export interface OrderProgress {
  /** Tổng số việc của đơn và số đã xong (thanh tiến độ) */
  total: number;
  done: number;
  /** Việc chưa xong gần hạn nhất của NCC (VENDOR / BOTH): "Tiếp theo"; null khi NCC không còn việc nào */
  next: { due: string; title: string } | null;
  /** Số việc chưa xong */
  open: number;
  /** Việc chưa xong, quá hạn, thuộc NCC (VENDOR / BOTH): "Trễ tiến độ" */
  overdueVendor: number;
  /** Việc chưa xong, quá hạn, của khách */
  overdueCustomer: number;
  /** Việc chưa xong, hạn trong DUE_SOON_DAYS ngày tới, thuộc NCC */
  dueSoonVendor: number;
}

/** Tóm tắt tiến độ một đơn từ việc chi tiết của nó. */
export function orderProgress(tasks: readonly ProgressTask[], today: string): OrderProgress {
  const p: OrderProgress = { total: tasks.length, done: 0, next: null, open: 0, overdueVendor: 0, overdueCustomer: 0, dueSoonVendor: 0 };
  for (const t of tasks) {
    if (t.done) {
      p.done++;
      continue;
    }
    p.open++;
    const late = t.due < today;
    const vendorSide = t.owner !== 'CUSTOMER';
    if (vendorSide && (!p.next || t.due < p.next.due)) p.next = { due: t.due, title: t.title ?? '' };
    if (late && vendorSide) p.overdueVendor++;
    else if (late) p.overdueCustomer++;
    else if (vendorSide && reminderStage(t.due, today) === 'DUE_SOON') p.dueSoonVendor++;
  }
  return p;
}

// ---------- Tổng hợp việc của khách (việc khung, việc tự thêm) ----------

export interface DigestTask {
  title: string;
  due: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Thông báo tổng hợp mỗi ngày cho KHÁCH về việc không gắn đơn (thiệp, nhẫn, chọn NCC, Mốc chốt, việc tự thêm): một thông báo cho cả
 * các việc sắp đến hạn và quá hạn, thay vì mỗi việc một thông báo (timeline gấp thường dồn nhiều việc vào cùng một vài ngày).
 * null khi không có việc nào cần nhắc.
 */
export function taskDigest(tasks: readonly DigestTask[], today: string): { title: string; content: string; soon: number; overdue: number } | null {
  const staged = tasks
    .map((t) => ({ ...t, stage: reminderStage(t.due, today) }))
    .filter((t): t is DigestTask & { stage: ReminderStage } => t.stage !== null)
    .sort((a, b) => a.due.localeCompare(b.due));
  const overdue = staged.filter((t) => t.stage === 'OVERDUE').length;
  const soon = staged.length - overdue;
  if (!staged.length) return null;
  const counts = [soon && `${soon} việc sắp đến hạn`, overdue && `${overdue} việc quá hạn`].filter(Boolean).join(' và ');
  const shown = staged.slice(0, 3).map((t) => `"${clip(t.title, 60)}" (hạn ${dmyOf(t.due).slice(0, 5)})`);
  const more = staged.length > 3 ? ` và ${staged.length - 3} việc khác` : '';
  return { title: 'Việc cần làm trên timeline', content: `Bạn có ${counts} trên timeline: ${shown.join(', ')}${more}.`, soon, overdue };
}

