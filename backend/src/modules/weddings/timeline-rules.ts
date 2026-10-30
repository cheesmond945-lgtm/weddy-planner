/*
 * Luật kiểm tra khi khách tự đổi hạn việc timeline (docs/TIMELINE.md mục 7). Hàm thuần: không đụng CSDL, không đọc đồng hồ.
 * Ngày là chuỗi "YYYY-MM-DD"; W ngày cưới, E ngày thực hiện của đơn dịch vụ, "hôm nay" do nơi gọi truyền vào.
 */
import { dayOf, ymd } from './timeline-schedule.ts';
import { TIMELINE_TEMPLATES, templateOf, type TimelineTemplate } from './timeline-templates.ts';

/** Việc sau ngày cưới (cảm ơn, nhận ảnh, thanh toán, trả đồ) được dời tối đa bao nhiêu ngày sau mốc của nó. */
export const POST_EVENT_MAX_DAYS = 365;

const addDays = (s: string, n: number) => ymd(dayOf(s) + n);
const maxYmd = (a: string, b: string) => (a > b ? a : b);

export interface DueBounds {
  /** Hạn sớm nhất */
  min: string;
  /** Hạn muộn nhất */
  max: string;
  /** true: ngày do đơn quyết định (Ngày thực hiện), khách không đổi hạn tay */
  fixed: boolean;
}

/**
 * Khoảng hạn hợp lệ của một việc, theo mẫu của nó:
 * - việc khách tự thêm, việc khung và việc chi tiết trước sự kiện (mốc W−n, D+n, S±n): từ hôm nay đến ngày cưới;
 * - việc chi tiết neo ngày thực hiện trước sự kiện (E−n): từ hôm nay đến E;
 * - "Ngày thực hiện" (kind EVENT mốc E hoặc W): cố định đúng E (W), không đổi tay. Đổi ngày thực hiện là việc của đơn (NCC "Sửa đơn");
 * - việc sau sự kiện (mốc W+n hoặc E+n, n > 0: cảm ơn, nhận ảnh, thanh toán, trả đồ): từ mốc của nó đến mốc + POST_EVENT_MAX_DAYS.
 * `event` là ngày thực hiện của đơn đang giữ việc; không có (việc khung, việc tự thêm) thì lấy ngày cưới.
 */
export function dueBounds(code: string | null | undefined, ctx: { today: string; wedding: string; event?: string | null }): DueBounds {
  const tpl = templateOf(code);
  const event = ctx.event || ctx.wedding;
  const beforeWedding: DueBounds = { min: ctx.today, max: ctx.wedding, fixed: false };
  if (!tpl) return beforeWedding;

  if (tpl.kind === 'EVENT' && (tpl.anchor === 'E' || tpl.anchor === 'W')) {
    const day = tpl.anchor === 'E' ? event : ctx.wedding;
    return { min: day, max: day, fixed: true };
  }
  if (tpl.offset > 0 && (tpl.anchor === 'E' || tpl.anchor === 'W')) {
    const base = tpl.anchor === 'E' ? event : ctx.wedding;
    return { min: maxYmd(ctx.today, base), max: addDays(base, POST_EVENT_MAX_DAYS), fixed: false };
  }
  if (tpl.anchor === 'E') return { min: ctx.today, max: event, fixed: false };
  return beforeWedding;
}

/** Thông báo khi hạn nằm ngoài khoảng; undefined nếu hợp lệ. */
export function dueRangeIssue(due: string, b: DueBounds): string | undefined {
  const dmy = (s: string) => s.split('-').reverse().join('/');
  if (b.fixed) return `Ngày này do đơn dịch vụ quyết định (${dmy(b.min)}), không đổi tay được. Muốn đổi, nhắn nhà cung cấp sửa ngày thực hiện của đơn.`;
  if (b.min > b.max) return 'Không còn khoảng ngày hợp lệ cho việc này (ngày cưới đã qua). Hãy cập nhật ngày cưới trước.';
  if (due < b.min || due > b.max) return `Hạn phải từ ${dmy(b.min)} đến ${dmy(b.max)}.`;
  return undefined;
}

export interface SiblingTask {
  code: string | null;
  due: string;
  done: boolean;
}

/**
 * Thứ tự trong cùng một hạng mục khi khách tự đổi hạn: việc Chọn NCC phải trước hoặc cùng ngày Mốc chốt (cùng ngày được, hạn là "muộn nhất").
 * Mốc chốt đã xong (đã cọc) thì các việc Chọn NCC chỉ còn là lịch sử, không ràng buộc nữa.
 * `siblings`: việc khác của cùng hạng mục (không gồm chính việc đang đổi). Trả thông báo lỗi, undefined nếu ổn.
 */
export function sequenceIssue(
  code: string | null | undefined,
  due: string,
  siblings: readonly SiblingTask[],
  templates: readonly TimelineTemplate[] = TIMELINE_TEMPLATES,
): string | undefined {
  const tpl = templateOf(code);
  if (!tpl?.service || (tpl.kind !== 'CHOOSE' && tpl.kind !== 'BOOK')) return undefined;
  const dmy = (s: string) => s.split('-').reverse().join('/');
  const kindOf = (c: string | null) => templates.find((t) => t.code === c && t.service === tpl.service)?.kind;
  const book = siblings.find((s) => kindOf(s.code) === 'BOOK');
  if (tpl.kind === 'CHOOSE') {
    if (book && !book.done && due > book.due) return `Việc chọn nhà cung cấp phải xong trước hoặc cùng ngày mốc "Chốt" của hạng mục (${dmy(book.due)}).`;
    return undefined;
  }
  if (book?.done) return undefined;
  const lastChoose = siblings.filter((s) => kindOf(s.code) === 'CHOOSE').reduce<string | undefined>((m, s) => (m === undefined || s.due > m ? s.due : m), undefined);
  if (lastChoose && due < lastChoose) return `Mốc "Chốt" không được trước việc chọn nhà cung cấp cuối của hạng mục (${dmy(lastChoose)}).`;
  return undefined;
}

// ---------- Đổi ngày cưới: đơn bị ảnh hưởng ----------

export interface OrderForDateChange {
  orderCode: string;
  status: string | null;
  /** Ngày thực hiện của đơn */
  eventDate: string;
  vendorName: string;
}

export type DateChangeKind =
  /** Đơn đã cọc, ngày thực hiện khác ngày cưới mới (có thể là dịch vụ làm trước ngày cưới nên chỉ nhắc) */
  | 'DIFFERENT'
  /** Ngày thực hiện sau ngày cưới mới: đơn lệch thật, cần NCC đổi ngày */
  | 'AFTER_WEDDING';

/**
 * Đơn bị ảnh hưởng khi khách đổi ngày cưới sang `newWedding`; null nếu không ảnh hưởng.
 * - Deposited: khác ngày cưới mới thì nhắc (DIFFERENT), sau ngày cưới mới thì AFTER_WEDDING;
 * - Pending / NeedRevision: chỉ khi ngày thực hiện sau ngày cưới mới (AFTER_WEDDING, `blocksDeposit`: khách chưa cọc được cho tới khi NCC đổi ngày);
 * - các trạng thái khác (nháp, hết hạn, hủy, hoàn thành): không ảnh hưởng.
 */
export function dateChangeIssue(o: OrderForDateChange, newWedding: string): { kind: DateChangeKind; blocksDeposit: boolean } | null {
  if (!o.eventDate) return null;
  if (o.status === 'Deposited') {
    if (o.eventDate > newWedding) return { kind: 'AFTER_WEDDING', blocksDeposit: false };
    return o.eventDate !== newWedding ? { kind: 'DIFFERENT', blocksDeposit: false } : null;
  }
  if ((o.status === 'Pending' || o.status === 'NeedRevision') && o.eventDate > newWedding) return { kind: 'AFTER_WEDDING', blocksDeposit: true };
  return null;
}

const dmyOf = (s: string) => s.split('-').reverse().join('/');

/** Câu cảnh báo cho khách trong hộp xem trước đổi ngày cưới. */
export function customerDateWarning(o: OrderForDateChange, issue: { kind: DateChangeKind; blocksDeposit: boolean }, newWedding: string): string {
  const base = `Đơn ${o.orderCode} của ${o.vendorName} thực hiện ngày ${dmyOf(o.eventDate)}`;
  if (issue.kind === 'DIFFERENT') return `${base}, khác ngày cưới mới. Nhắn NCC để cập nhật đơn.`;
  if (issue.blocksDeposit) return `${base}, sau ngày cưới mới (${dmyOf(newWedding)}) nên bạn chưa đặt cọc được cho tới khi nhà cung cấp đổi ngày. Bạn bấm "Yêu cầu chỉnh sửa" và chọn "Đổi ngày thực hiện".`;
  return `${base}, sau ngày cưới mới (${dmyOf(newWedding)}). Nhắn NCC để cập nhật ngày thực hiện của đơn.`;
}

/** Câu báo cho NCC khi khách đã đổi ngày cưới làm đơn của họ lệch (chỉ AFTER_WEDDING). */
export function vendorDateNotice(o: OrderForDateChange, newWedding: string): string {
  return `Khách đã đổi ngày cưới sang ${dmyOf(newWedding)}, đơn ${o.orderCode} đang thực hiện ngày ${dmyOf(o.eventDate)} (sau ngày cưới). Hãy cập nhật ngày thực hiện của đơn.`;
}

// ---------- Kiểm tra toàn vẹn (npm run timelines:audit) ----------

export interface AuditInput {
  weddingDate: string;
  orders: readonly { id: string; code: string; status: string | null; eventDate: string }[];
  tasks: readonly { id: string; status: string | null; orderId: string | null; type: string | null }[];
}

export type AuditIssue =
  /** Đơn còn hiệu lực (Pending, NeedRevision, Deposited) có ngày thực hiện sau ngày cưới */
  | { kind: 'EVENT_AFTER_WEDDING'; orderCode: string; eventDate: string }
  /** Việc chi tiết còn gắn với đơn đã hủy, hết hạn hoặc nháp (đáng ra đã bị gỡ) */
  | { kind: 'DETAIL_OF_INACTIVE_ORDER'; orderCode: string; taskIds: string[] }
  /** Đơn Hoàn thành mà việc chi tiết vẫn Todo (đáng ra đã đóng) */
  | { kind: 'COMPLETED_ORDER_OPEN_TASKS'; orderCode: string; taskIds: string[] };

/** Các bất biến của timeline một đám cưới; trả danh sách vi phạm (rỗng là ổn). Hàm thuần. */
export function auditTimeline(input: AuditInput): AuditIssue[] {
  const out: AuditIssue[] = [];
  for (const o of input.orders) {
    const details = input.tasks.filter((t) => t.orderId === o.id && t.type === 'Detail');
    if (['Pending', 'NeedRevision', 'Deposited'].includes(o.status ?? '') && o.eventDate > input.weddingDate) out.push({ kind: 'EVENT_AFTER_WEDDING', orderCode: o.code, eventDate: o.eventDate });
    if (['Cancelled', 'Expired', 'Draft'].includes(o.status ?? '') && details.length) out.push({ kind: 'DETAIL_OF_INACTIVE_ORDER', orderCode: o.code, taskIds: details.map((t) => t.id) });
    const open = details.filter((t) => t.status === 'Todo');
    if (o.status === 'Completed' && open.length) out.push({ kind: 'COMPLETED_ORDER_OPEN_TASKS', orderCode: o.code, taskIds: open.map((t) => t.id) });
  }
  return out;
}
