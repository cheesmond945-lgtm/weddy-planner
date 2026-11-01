/*
 * Lịch bận theo sảnh của Trung tâm tổ chức sự kiện (docs/LICH_BAN_SANH.md). Hàm thuần: không đụng CSDL, không đọc đồng hồ.
 * Ngày là chuỗi "YYYY-MM-DD"; "hôm nay" do nơi gọi truyền vào.
 *
 * Một sảnh (một gói của trung tâm) bận một ngày khi:
 * - nguồn "Đơn": có đơn Đã cọc / Hoàn thành gắn sảnh đó, ngày thực hiện là ngày đó (đơn Chờ cọc chưa tính);
 * - nguồn "Thủ công": NCC đánh dấu sảnh bận khoảng ngày chứa ngày đó (bảo trì, nghỉ, lý do riêng…).
 * Các danh mục khác (chụp ảnh, trang điểm…) có nhiều ekip nên chưa có lịch bận.
 */

/** Danh mục có lịch bận theo sảnh: slug của "Trung tâm tổ chức sự kiện". */
export const HALL_CATEGORY_SLUG = 'nha-hang';
/** Đơn làm sảnh bận. */
export const BUSY_ORDER_STATUSES = ['Deposited', 'Completed'];
/** Trạng thái gói hiện trên lịch bận của NCC (đang đăng hoặc đã ẩn: sảnh ẩn vẫn có thể còn đơn). */
export const HALL_PACKAGE_STATUSES = ['Approved', 'Hidden'];
/** Số ngày tối đa một lần hỏi lịch (đủ một lưới tháng 6 tuần). */
export const BUSY_QUERY_MAX_DAYS = 100;
/** Một lần đánh dấu bận dài tối đa (CHECK của bảng package_busy_dates: end_date - start_date <= 366). */
export const MANUAL_MAX_SPAN = 366;
export const REASON_MAX = 255;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;
const dayNum = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / DAY);
const ymdOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
export const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const spanDays = (from: string, to: string) => dayNum(to) - dayNum(from);
const dmy = (s: string) => s.split('-').reverse().join('/');

export interface BusyOrder {
  orderId: string;
  orderCode: string;
  customerName: string;
  packageId: string;
  /** Ngày thực hiện */
  date: string;
  status: string;
}

export interface ManualBusy {
  id: string;
  packageId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export type BusySource =
  | { kind: 'ORDER'; orderId: string; orderCode: string; customerName: string }
  | { kind: 'MANUAL'; busyId: string; reason: string; startDate: string; endDate: string };

export interface BusyDay {
  packageId: string;
  date: string;
  source: BusySource;
}

/** Các ngày từ `from` đến `to`, gồm hai đầu. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let n = dayNum(from); n <= dayNum(to); n++) out.push(ymdOf(n));
  return out;
}

const counts = (o: BusyOrder) => BUSY_ORDER_STATUSES.includes(o.status);

/**
 * Lịch bận chi tiết (phía NCC) trong [from, to]: mỗi (sảnh, ngày, nguồn) một dòng; khoảng thủ công trải ra từng ngày, cắt theo [from, to].
 * Sắp theo ngày; cùng ngày thì đơn trước thủ công.
 */
export function busyDays(orders: readonly BusyOrder[], manual: readonly ManualBusy[], from: string, to: string): BusyDay[] {
  const out: BusyDay[] = [];
  for (const o of orders) {
    if (!counts(o) || o.date < from || o.date > to) continue;
    out.push({ packageId: o.packageId, date: o.date, source: { kind: 'ORDER', orderId: o.orderId, orderCode: o.orderCode, customerName: o.customerName } });
  }
  for (const m of manual) {
    const start = m.startDate > from ? m.startDate : from;
    const end = m.endDate < to ? m.endDate : to;
    if (start > end) continue;
    for (const date of eachDay(start, end)) {
      out.push({ packageId: m.packageId, date, source: { kind: 'MANUAL', busyId: m.id, reason: m.reason, startDate: m.startDate, endDate: m.endDate } });
    }
  }
  const rank = (d: BusyDay) => (d.source.kind === 'ORDER' ? 0 : 1);
  return out.sort((a, b) => a.date.localeCompare(b.date) || rank(a) - rank(b));
}

/** Các ngày sảnh `packageId` bận trong [from, to] (phía khách: chỉ ngày, không nguồn, không lộ khách hay đơn). */
export function busyDatesOf(packageId: string, orders: readonly BusyOrder[], manual: readonly ManualBusy[], from: string, to: string): string[] {
  const own = (x: { packageId: string }) => x.packageId === packageId;
  return [...new Set(busyDays(orders.filter(own), manual.filter(own), from, to).map((d) => d.date))];
}

/** Sảnh `packageId` bận ngày `date` vì đâu (bỏ qua đơn `exceptOrderId`, tức chính đơn đang kiểm); null nếu còn trống. Đơn được ưu tiên báo trước. */
export function hallConflict(packageId: string, date: string, orders: readonly BusyOrder[], manual: readonly ManualBusy[], exceptOrderId?: string): BusySource | null {
  const o = orders.find((x) => x.packageId === packageId && x.date === date && counts(x) && x.orderId !== exceptOrderId);
  if (o) return { kind: 'ORDER', orderId: o.orderId, orderCode: o.orderCode, customerName: o.customerName };
  const m = manual.find((x) => x.packageId === packageId && x.startDate <= date && x.endDate >= date);
  return m ? { kind: 'MANUAL', busyId: m.id, reason: m.reason, startDate: m.startDate, endDate: m.endDate } : null;
}

/** Số sảnh và số sảnh còn trống ngày `date` của từng NCC (nhãn ngày cưới ở danh sách, dòng ngày cưới ở trang chi tiết). */
export function hallsFreeOn(
  halls: readonly { id: string; vendorId: string }[],
  orders: readonly BusyOrder[],
  manual: readonly ManualBusy[],
  date: string,
): Record<string, { halls: number; free: number }> {
  const out: Record<string, { halls: number; free: number }> = {};
  for (const h of halls) {
    const v = (out[h.vendorId] ??= { halls: 0, free: 0 });
    v.halls++;
    if (!hallConflict(h.id, date, orders, manual)) v.free++;
  }
  return out;
}

/** Lời báo khi sảnh bận: NCC thấy nguồn (mã đơn của mình, lý do mình ghi); khách chỉ biết sảnh không nhận ngày đó. */
export function hallBusyMessage(role: 'VENDOR' | 'COUPLE', hallName: string, date: string, src: BusySource): string {
  const hall = `Sảnh "${hallName}"`;
  if (role === 'VENDOR') {
    return src.kind === 'ORDER'
      ? `${hall} đã bận ngày ${dmy(date)} (đơn ${src.orderCode} đã đặt cọc). Chọn sảnh hoặc ngày khác.`
      : `${hall} đã bận ngày ${dmy(date)} (bạn đã đánh dấu bận: ${src.reason}). Chọn sảnh hoặc ngày khác, hoặc gỡ ngày bận ở Lịch làm việc > Lịch bận.`;
  }
  return src.kind === 'ORDER'
    ? `${hall} đã có khách khác đặt cọc ngày ${dmy(date)}. Nhắn nhà cung cấp để đổi sảnh hoặc ngày.`
    : `${hall} không nhận tiệc ngày ${dmy(date)}. Nhắn nhà cung cấp để đổi sảnh hoặc ngày.`;
}

export interface ManualInput {
  packageIds: string[];
  startDate: string;
  endDate: string;
  reason: string;
}

/**
 * Kiểm tra một lần NCC đánh dấu bận: một hoặc nhiều sảnh, từ ngày đến ngày (đến ngày bỏ trống = một ngày), lý do bắt buộc.
 * Không đánh dấu ngày đã qua; dài tối đa MANUAL_MAX_SPAN ngày. Trả lỗi theo trường (packageIds, startDate, endDate, reason).
 */
export function parseManual(input: { packageIds?: unknown; startDate?: unknown; endDate?: unknown; reason?: unknown }, today: string): { value: ManualInput } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const raw: unknown[] = Array.isArray(input.packageIds) ? input.packageIds : [];
  const ids = [...new Set(raw.filter((x): x is string => typeof x === 'string' && UUID.test(x)))];
  if (!raw.length) errors.packageIds = 'Chọn ít nhất một sảnh.';
  else if (ids.length !== new Set(raw).size) errors.packageIds = 'Sảnh không hợp lệ.';
  const start = isYmd(input.startDate) ? input.startDate : '';
  const end = input.endDate === undefined || input.endDate === null || input.endDate === '' ? start : isYmd(input.endDate) ? input.endDate : '';
  if (!start) errors.startDate = 'Chọn ngày bắt đầu.';
  else if (start < today) errors.startDate = 'Không đánh dấu bận ngày đã qua.';
  if (!end) errors.endDate = 'Chọn ngày kết thúc hợp lệ.';
  else if (start && end < start) errors.endDate = 'Ngày kết thúc không trước ngày bắt đầu.';
  else if (start && spanDays(start, end) > MANUAL_MAX_SPAN) errors.endDate = `Mỗi lần đánh dấu tối đa ${MANUAL_MAX_SPAN + 1} ngày.`;
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) errors.reason = 'Ghi lý do bận (bảo trì, nghỉ, lý do riêng…).';
  else if (reason.length > REASON_MAX) errors.reason = `Lý do tối đa ${REASON_MAX} ký tự.`;
  return Object.keys(errors).length ? { errors } : { value: { packageIds: ids, startDate: start, endDate: end, reason } };
}
