/**
 * Chuẩn hóa dữ liệu nhập từ Excel/CSV (docs/KE_HOACH_KE_HOACH_CUA_TOI.md P6). Hàm thuần, có unit test ở
 * backend/test/import-rows.test.cjs. Frontend chỉ đọc file và ghép cột; mọi kiểm tra từng dòng nằm ở đây
 * (frontend gọi dryRun để xem trước), nên FE và BE luôn ra cùng một kết quả.
 */

export const IMPORT_MAX_ROWS = 500;

export type DateOrder = 'DMY' | 'MDY';
export type Side = 'Bride' | 'Groom';
export type Rsvp = 'Pending' | 'Attending' | 'Declined';
export type AssigneeKind = 'Bride' | 'Groom' | 'Both' | 'Member';

export const GUEST_GROUPS = ['Gia đình', 'Họ hàng', 'Bạn bè', 'Đồng nghiệp', 'Khác'];

/** Bỏ dấu tiếng Việt, viết thường, gộp khoảng trắng: "  Nhà  Gái " -> "nha gai". */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Số tiền: "5tr", "5 triệu", "1,5tr", "500k", "500 nghìn", "2 tỷ", "5.000.000", "5,000,000đ", "5000000".
 * Không hợp lệ hoặc ≤ 0 thì null.
 */
export function parseMoney(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  const s = fold(str(v)).replace(/\s*(vnd|dong|d)\s*$/, '');
  if (!s) return null;
  const m = s.match(/^(\d+(?:[.,]\d+)*)\s*(ty|tr|trieu|k|nghin|ngan)?$/);
  if (!m) return null;
  const unit = m[2] ? ({ ty: 1e9, tr: 1e6, trieu: 1e6, k: 1e3, nghin: 1e3, ngan: 1e3 } as Record<string, number>)[m[2]] : 1;
  let num = m[1];
  if (unit === 1) {
    // Không có đơn vị: dấu chấm/phẩy là phân cách hàng nghìn ("5.000.000", "5,000,000")
    if (!/^\d{1,3}([.,]\d{3})*$/.test(num) && !/^\d+$/.test(num)) return null;
    num = num.replace(/[.,]/g, '');
  } else {
    // Có đơn vị: "1,5tr" hoặc "1.5tr" là số thập phân
    if (!/^\d+([.,]\d+)?$/.test(num)) return null;
    num = num.replace(',', '.');
  }
  const n = Math.round(Number(num) * unit);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const ymd = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
};

/**
 * Ngày: "2027-03-15", "15/03/2027" (hoặc "03/15/2027" khi order = MDY), dấu "/", "-", "."; năm 2 chữ số thì là 20xx;
 * số serial của Excel (ví dụ 46461). Trả về "YYYY-MM-DD" hoặc null.
 */
export function parseDate(v: unknown, order: DateOrder = 'DMY'): string | null {
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(str(v))) {
    const serial = Math.floor(Number(v));
    if (serial < 20000 || serial > 80000) return null;
    // Excel đếm từ 1899-12-30 (đã tính lỗi năm nhuận 1900)
    return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
  }
  const s = str(v);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ T].*)?$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  return order === 'MDY' ? ymd(year, +m[1], +m[2]) : ymd(year, +m[2], +m[1]);
}

/**
 * Chỉ cho chọn kiểu tháng/ngày/năm khi cột có ngày mà số thứ hai > 12 và không ngày nào có số đầu > 12 (P6).
 * Frontend dùng bản sao của hàm này để bật/tắt lựa chọn; backend dùng để từ chối MDY không hợp lệ.
 */
export function canBeMonthFirst(values: unknown[]): boolean {
  let secondOver12 = false;
  for (const v of values) {
    const m = str(v).match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})/);
    if (!m) continue;
    if (+m[1] > 12) return false;
    if (+m[2] > 12) secondOver12 = true;
  }
  return secondOver12;
}

/** Bên: "Nhà gái", "Gái", "Cô dâu", "CD", "Bride" -> Bride; "Nhà trai", "Trai", "Chú rể", "CR", "Groom" -> Groom. */
export function parseSide(v: unknown): Side | null {
  const s = fold(str(v));
  if (['nha gai', 'gai', 'co dau', 'cd', 'bride', 'ben gai', 'ben co dau'].includes(s)) return 'Bride';
  if (['nha trai', 'trai', 'chu re', 'cr', 'groom', 'ben trai', 'ben chu re'].includes(s)) return 'Groom';
  return null;
}

/** Nhóm: khớp một nhóm có sẵn (bỏ dấu), nếu không thì giữ chữ người dùng nhập (tối đa 30 ký tự). Trống là "Khác". */
export function parseGroup(v: unknown): string | null {
  const s = str(v).replace(/\s+/g, ' ');
  if (!s) return 'Khác';
  const known = GUEST_GROUPS.find((g) => fold(g) === fold(s));
  if (known) return known;
  return s.length <= 30 ? s : null;
}

/** Có/không: "x", "có", "rồi", "đã mời", "yes", "true", "1" là có; trống, "không", "chưa", "no", "0" là không. */
export function parseBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const s = fold(str(v));
  if (['x', 'co', 'roi', 'da moi', 'yes', 'y', 'true', '1', 'v', '✓'].includes(s)) return true;
  if (['', 'khong', 'chua', 'chua moi', 'no', 'n', 'false', '0'].includes(s)) return false;
  return null;
}

/** Phản hồi: "Sẽ đến", "Đến", "Có" -> Attending; "Từ chối", "Không đến" -> Declined; trống, "Chưa phản hồi" -> Pending. */
export function parseRsvp(v: unknown): Rsvp | null {
  const s = fold(str(v));
  if (['', 'chua phan hoi', 'chua', 'pending', 'cho'].includes(s)) return 'Pending';
  if (['se den', 'den', 'co', 'co den', 'tham du', 'attending', 'yes'].includes(s)) return 'Attending';
  if (['tu choi', 'khong den', 'khong', 'vang', 'declined', 'no'].includes(s)) return 'Declined';
  return null;
}

/** Số người: số nguyên 1-50, trống là 1. */
export function parsePartySize(v: unknown): number | null {
  const s = str(v);
  if (!s) return 1;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : null;
}

export interface MemberRef {
  userId: string;
  name: string;
  relation: 'Bride' | 'Groom' | 'Relative' | null;
}

/**
 * Phụ trách: "CD"/"Cô dâu" -> Bride, "CR"/"Chú rể" -> Groom, "Tất cả"/"Cả hai" -> Both, tên thành viên -> Member
 * (thành viên là cô dâu hoặc chú rể thì thành Bride/Groom). Cụm lạ trả về undefined (bỏ qua, không đoán); trống là null.
 */
export function parseAssignee(v: unknown, members: MemberRef[]): { kind: AssigneeKind; userId: string | null } | null | undefined {
  const s = fold(str(v));
  if (!s) return null;
  if (['cd', 'co dau', 'bride'].includes(s)) return { kind: 'Bride', userId: null };
  if (['cr', 'chu re', 'groom'].includes(s)) return { kind: 'Groom', userId: null };
  if (['tat ca', 'ca hai', 'both', 'ca 2', 'cd + cr', 'cd va cr'].includes(s)) return { kind: 'Both', userId: null };
  const hits = members.filter((m) => fold(m.name) === s);
  if (hits.length !== 1) return undefined;
  const m = hits[0];
  if (m.relation === 'Bride' || m.relation === 'Groom') return { kind: m.relation, userId: null };
  return { kind: 'Member', userId: m.userId };
}

export interface RowResult<T> {
  /** Số thứ tự dòng trong file (bắt đầu từ 1, không tính dòng tiêu đề) */
  row: number;
  value: T | null;
  errors: string[];
  warnings: string[];
}

export interface GuestRow {
  fullName: string;
  side: Side;
  group: string;
  partySize: number;
  isInvited: boolean;
  rsvp: Rsvp;
}

/** Khóa so trùng khách: tên bỏ dấu + bên. */
export const guestKey = (name: string, side: Side) => `${fold(name)}|${side}`;

/** Kiểm tra từng dòng khách. `existing`: khóa của khách đã có (bỏ qua khi thay toàn bộ). Trùng trong file cũng báo lỗi. */
export function normalizeGuests(rows: Record<string, unknown>[], existing: Set<string>): RowResult<GuestRow>[] {
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fullName = str(r.name).replace(/\s+/g, ' ');
    if (!fullName) errors.push('Thiếu tên khách.');
    else if (fullName.length > 100) errors.push('Tên khách tối đa 100 ký tự.');
    const side = parseSide(r.side);
    if (!side) errors.push(str(r.side) ? `Không hiểu bên "${str(r.side)}" (dùng Nhà trai hoặc Nhà gái).` : 'Thiếu bên (Nhà trai hoặc Nhà gái).');
    const group = parseGroup(r.group);
    if (group === null) errors.push('Nhóm tối đa 30 ký tự.');
    const partySize = parsePartySize(r.partySize);
    if (partySize === null) errors.push('Số người là số nguyên từ 1 đến 50.');
    let isInvited = parseBool(r.invited);
    if (isInvited === null) errors.push(`Không hiểu cột Đã mời "${str(r.invited)}".`);
    let rsvp = parseRsvp(r.rsvp);
    if (rsvp === null) errors.push(`Không hiểu phản hồi "${str(r.rsvp)}".`);
    // Có phản hồi thì coi như đã mời
    if (rsvp && rsvp !== 'Pending' && isInvited === false) {
      isInvited = true;
      warnings.push('Có phản hồi nên tính là đã mời.');
    }
    if (fullName && side) {
      const key = guestKey(fullName, side);
      if (seen.has(key)) errors.push('Trùng với một dòng phía trên.');
      else if (existing.has(key)) errors.push('Đã có trong danh sách khách.');
      seen.add(key);
    }
    const ok = !errors.length;
    return { row: i + 1, errors, warnings, value: ok ? { fullName, side: side!, group: group!, partySize: partySize!, isInvited: isInvited!, rsvp: rsvp! } : null };
  });
}

export interface TaskRow {
  title: string;
  dueDate: string;
  assignee: { kind: AssigneeKind; userId: string | null } | null;
  note: string | null;
}

/** Kiểm tra từng dòng công việc. Hạn phải từ `today` đến trước `weddingDate` (đều là YYYY-MM-DD). */
export function normalizeTasks(rows: Record<string, unknown>[], opts: { dateOrder: DateOrder; today: string; weddingDate: string; members: MemberRef[] }): RowResult<TaskRow>[] {
  return rows.map((r, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const title = str(r.title).replace(/\s+/g, ' ');
    if (!title) errors.push('Thiếu tên việc.');
    else if (title.length > 255) errors.push('Tên việc tối đa 255 ký tự.');
    const dueDate = parseDate(r.dueDate, opts.dateOrder);
    if (!str(r.dueDate)) errors.push('Thiếu hạn.');
    else if (!dueDate) errors.push(`Không hiểu ngày "${str(r.dueDate)}".`);
    else if (dueDate < opts.today || dueDate >= opts.weddingDate) errors.push('Hạn phải từ hôm nay đến trước ngày cưới.');
    let assignee = parseAssignee(r.assignee, opts.members);
    if (assignee === undefined) {
      warnings.push(`Không rõ người phụ trách "${str(r.assignee)}", để trống.`);
      assignee = null;
    }
    const note = str(r.note) || null;
    if (note && note.length > 200) errors.push('Ghi chú tối đa 200 ký tự.');
    const ok = !errors.length;
    return { row: i + 1, errors, warnings, value: ok ? { title, dueDate: dueDate!, assignee, note } : null };
  });
}

export interface ExpenseRow {
  title: string;
  amount: number;
}

/** Kiểm tra từng dòng chi phí khác. */
export function normalizeExpenses(rows: Record<string, unknown>[]): RowResult<ExpenseRow>[] {
  return rows.map((r, i) => {
    const errors: string[] = [];
    const title = str(r.title).replace(/\s+/g, ' ');
    if (!title) errors.push('Thiếu tên khoản chi.');
    else if (title.length > 100) errors.push('Tên khoản chi tối đa 100 ký tự.');
    const amount = parseMoney(r.amount);
    if (amount === null) errors.push(str(r.amount) ? `Không hiểu số tiền "${str(r.amount)}".` : 'Thiếu số tiền.');
    else if (amount > 1e13) errors.push('Số tiền quá lớn.');
    const ok = !errors.length;
    return { row: i + 1, errors, warnings: [], value: ok ? { title, amount: amount! } : null };
  });
}

/** Một ô CSV: bọc ngoặc kép khi có dấu phẩy, ngoặc kép hoặc xuống dòng; chặn công thức (=, +, -, @) khi mở bằng Excel. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** File CSV UTF-8 có BOM (Excel mở đúng tiếng Việt), xuống dòng CRLF. */
export const toCsv = (header: string[], rows: unknown[][]) => '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
