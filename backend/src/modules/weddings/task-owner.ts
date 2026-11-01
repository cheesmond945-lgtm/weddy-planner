/*
 * Chủ của việc chi tiết gắn đơn (docs/TIMELINE.md mục 8) và luật nhắc hạn. Hàm thuần: không đụng CSDL, không đọc đồng hồ.
 * Ngày là chuỗi "YYYY-MM-DD"; "hôm nay" do nơi gọi truyền vào.
 */
import { PAY_PREFIX, pkgTaskIdOf } from './timeline-rows.ts';

/** CUSTOMER chỉ khách làm; VENDOR chỉ NCC làm; BOTH hai bên cùng làm, bên nào xong trước thì tick. */
export type TaskOwner = 'CUSTOMER' | 'VENDOR' | 'BOTH';
export type TaskRole = 'COUPLE' | 'VENDOR';

/**
 * Chủ của 34 việc chi tiết CŨ sinh từ mẫu trong code (đã bỏ ở đợt 2) nhưng còn trong CSDL của các đơn đã cọc. Giữ đúng kết quả của ownerOf trước đây:
 * việc riêng khách làm (gửi tài liệu, chọn, duyệt, trả đồ) và thanh toán phần còn lại là CUSTOMER; "Ngày thực hiện" là VENDOR
 * (trừ "Nhận hoa, kiểm tra độ tươi" là BOTH vì khách phải kiểm); việc chi tiết còn lại hai bên.
 */
export const LEGACY_OWNER: Readonly<Record<string, TaskOwner>> = {
  // CUSTOMER
  DECOR_BRIEF: 'CUSTOMER',
  PHOTO_PICK_EDIT: 'CUSTOMER',
  PHOTO_REVIEW: 'CUSTOMER',
  FLOWER_PICK_STYLE: 'CUSTOMER',
  ATTIRE_RETURN: 'CUSTOMER',
  VENUE_PAY: 'CUSTOMER',
  PHOTO_PAY: 'CUSTOMER',
  ATTIRE_PAY: 'CUSTOMER',
  DECOR_PAY: 'CUSTOMER',
  MAKEUP_PAY: 'CUSTOMER',
  FLOWER_PAY: 'CUSTOMER',
  // VENDOR
  PHOTO_ALBUM_SHOOT: 'VENDOR',
  DECOR_EVENT: 'VENDOR',
  MAKEUP_EVENT: 'VENDOR',
  PHOTO_EVENT: 'VENDOR',
  VENUE_EVENT: 'VENDOR',
  // BOTH
  FLOWER_EVENT: 'BOTH',
  VENUE_HALL_CONFIRM: 'BOTH',
  VENUE_TASTING: 'BOTH',
  VENUE_MENU_FINAL: 'BOTH',
  VENUE_EVENT_FINAL: 'BOTH',
  PHOTO_CONCEPT: 'BOTH',
  PHOTO_DELIVERY_PREP: 'BOTH',
  PHOTO_FILES: 'BOTH',
  ATTIRE_MEASURE: 'BOTH',
  ATTIRE_ALBUM_PICKUP: 'BOTH',
  ATTIRE_FIT_FIRST: 'BOTH',
  ATTIRE_FIT_LAST: 'BOTH',
  ATTIRE_RECEIVE: 'BOTH',
  DECOR_REVIEW_MOCKUP: 'BOTH',
  DECOR_FINAL: 'BOTH',
  MAKEUP_TRIAL: 'BOTH',
  MAKEUP_FINAL: 'BOTH',
  FLOWER_FINAL: 'BOTH',
};

/**
 * Chủ của một việc theo mã:
 * - 'PKG:<id>': owner NCC khai trong package_tasks (tra trong `pkgOwners`: package_tasks.id -> owner, nạp theo lô, gồm cả việc đã xóa mềm); thiếu thì hai bên;
 * - 'PAY:<orderId>': khách (thanh toán phần còn lại);
 * - mã việc chi tiết cũ: LEGACY_OWNER; mã khung, mã lạ, việc khách tự thêm: hai bên.
 * Chủ chỉ để hiển thị và nhắc: NCC đổi được trạng thái mọi việc chi tiết của đơn mình, khách chỉ xem.
 */
export function ownerOf(code: string | null | undefined, pkgOwners?: ReadonlyMap<string, TaskOwner>): TaskOwner {
  if (!code) return 'BOTH';
  const pid = pkgTaskIdOf(code);
  if (pid) return pkgOwners?.get(pid) ?? 'BOTH';
  if (code.startsWith(PAY_PREFIX)) return 'CUSTOMER';
  return LEGACY_OWNER[code] ?? 'BOTH';
}

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
  /** Todo: NCC đang làm; Waiting: chờ khách. (Việc đã Done không được nhắc.) */
  status: 'Todo' | 'Waiting';
}

export interface Reminder {
  to: TaskRole;
  type: 'TaskDueSoon' | 'TaskOverdue';
  title: string;
  content: string;
}

/**
 * Ai nhận nhắc gì (việc chưa Done của đơn đã cọc):
 * - NCC: việc sắp đến hạn đang ở phía NCC (Todo) và mọi việc quá hạn chưa Done (NCC là người điều phối việc của đơn).
 * - Khách: việc đang chờ khách (Waiting) sắp đến hạn ("<NCC> đang chờ bạn: ...") hoặc quá hạn; việc phía NCC (Todo, chủ VENDOR) trễ thì khách nhận
 *   "NCC chưa cập nhật".
 */
export function remindersFor(t: ReminderTask, stage: ReminderStage): Reminder[] {
  const due = dmyOf(t.due);
  const ref = `"${t.title}" của đơn ${t.orderCode}`;
  const vendor = t.vendorName || 'Nhà cung cấp';
  const out: Reminder[] = [];
  if (stage === 'DUE_SOON') {
    if (t.status === 'Todo') out.push({ to: 'VENDOR', type: 'TaskDueSoon', title: 'Việc sắp đến hạn', content: `Việc ${ref} hạn ${due}.` });
    else out.push({ to: 'COUPLE', type: 'TaskDueSoon', title: 'Nhà cung cấp đang chờ bạn', content: `${vendor} đang chờ bạn: "${t.title}" (đơn ${t.orderCode}, hạn ${due}).` });
    return out;
  }
  out.push({ to: 'VENDOR', type: 'TaskOverdue', title: 'Việc đã quá hạn', content: `Việc ${ref} đã quá hạn ${due}. Hãy hoàn thành và cập nhật trạng thái.` });
  if (t.status === 'Waiting') out.push({ to: 'COUPLE', type: 'TaskOverdue', title: 'Việc đã quá hạn', content: `${vendor} đang chờ bạn: "${t.title}" (đơn ${t.orderCode}) đã quá hạn ${due}.` });
  else if (t.owner === 'VENDOR') out.push({ to: 'COUPLE', type: 'TaskOverdue', title: 'Nhà cung cấp chưa cập nhật việc', content: `${vendor} chưa cập nhật việc ${ref} (hạn ${due}). Bạn nhắn nhà cung cấp trong chat để hỏi tiến độ.` });
  return out;
}

/** Việc owner BOTH chưa chốt ngày và còn trong từng này ngày tới thì NCC được nhắc "chưa chốt lịch với khách". */
export const UNCONFIRMED_DAYS = 7;

// ---------- Tiến độ đơn (phía NCC) ----------

export interface ProgressTask {
  due: string;
  done: boolean;
  owner: TaskOwner;
  title?: string;
  /** Todo / Waiting / Done. Có thì phía NCC = chưa Waiting; thiếu (dữ liệu cũ) thì suy theo owner */
  status?: string | null;
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
    const vendorSide = t.status ? t.status !== 'Waiting' : t.owner !== 'CUSTOMER';
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

