import { HttpException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

/*
 * Quy tắc nghiệp vụ đơn hàng dùng chung (docs/CHOT_NGHIEP_VU_NCC.md mục 4, docs/api/orders.md phần NCC).
 * Tiền và ngày luôn do backend tính; công thức tiền cọc giống hệt frontend/src/lib/deposit.ts.
 */

export const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

/** Đơn của một đám cưới, rút gọn để kiểm tra luật "mỗi hạng mục tối đa MỘT đơn Deposited cùng lúc". */
export interface CategoryOrder {
  id: string;
  status: string | null;
  categoryId: string | null;
  code: string;
  vendorName: string;
  categoryName: string;
}

/** Đơn Deposited khác cùng hạng mục (nếu có). Đơn Completed không tính: đã xong, không giữ chỗ. */
export const depositedConflict = (orders: readonly CategoryOrder[], categoryId: string | null, exceptOrderId?: string) =>
  categoryId ? orders.find((o) => o.status === 'Deposited' && o.categoryId === categoryId && o.id !== exceptOrderId) : undefined;

/** Thông báo 409 CATEGORY_ALREADY_DEPOSITED cho khách (đặt cọc) hoặc NCC (gửi / tạo lại đơn). */
export const categoryTakenMessage = (who: 'COUPLE' | 'VENDOR', o: CategoryOrder) =>
  who === 'COUPLE'
    ? `Hạng mục ${o.categoryName} đã có đơn ${o.code} của ${o.vendorName} đang đặt cọc. Mỗi hạng mục chỉ có một đơn đã cọc cùng lúc: nhờ nhà cung cấp hủy đơn đó trước khi đặt cọc đơn mới.`
    : `Khách đã đặt cọc đơn ${o.code} của ${o.vendorName} cho hạng mục ${o.categoryName}. Mỗi hạng mục chỉ có một đơn đã cọc cùng lúc: chỉ gửi đơn mới sau khi đơn đó được hủy.`;

/** Tạo đơn: `send = true` gửi luôn (Draft → Pending), thiếu / false / giá trị khác = chỉ lưu nháp (docs/api/orders.md). */
export const wantsSend = (body: { send?: unknown } | null | undefined) => body?.send === true;

export const HOUR = 3_600_000;
export const DAY = 86_400_000;

// ---------- Thời gian (giờ Việt Nam) ----------

/** Hôm nay theo giờ Việt Nam, dạng "YYYY-MM-DD". */
export const todayVn = () => new Date(Date.now() + 7 * HOUR).toISOString().slice(0, 10);
/** Thời điểm -> ngày theo giờ Việt Nam, dạng "YYYY-MM-DD". */
export const ymdVn = (d: Date) => new Date(d.getTime() + 7 * HOUR).toISOString().slice(0, 10);
/** Cột @db.Date -> "YYYY-MM-DD". */
export const ymdOf = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysYmd = (s: string, n: number) => new Date(Date.parse(`${s}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const startOfDayVn = (s: string) => new Date(`${s}T00:00:00+07:00`);
export const endOfDayVn = (s: string) => new Date(`${s}T23:59:00+07:00`);
const validYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
/** "YYYY-MM-DD" -> "dd/mm/yyyy" để đưa vào thông báo. */
export const dmy = (s: string) => s.split('-').reverse().join('/');

// ---------- Ngày thực hiện so với ngày cưới (docs/TIMELINE.md mục 7) ----------

/** Ngày thực hiện sau ngày cưới của khách (không có ngày cưới thì không xét). So sánh chuỗi "YYYY-MM-DD" đúng thứ tự thời gian. */
export const eventAfterWedding = (eventDate: string, weddingDate: string | null | undefined) => !!weddingDate && eventDate > weddingDate;

/**
 * Lỗi ngày thực hiện / ngày cưới khi NCC gửi hoặc sửa đơn; null nếu hợp lệ. Hàm thuần, parseContent ném lỗi theo kết quả.
 * - send: ngày cưới của khách phải còn ở phía sau (WEDDING_DATE_PASSED, 409); ngày thực hiện không sau ngày cưới
 *   (EVENT_DATE_AFTER_WEDDING, 422), kể cả khi cập nhật đơn Pending / NeedRevision: khách chưa cọc nên NCC phải sửa.
 * - edit (sau cọc): chỉ kiểm ngày thực hiện, và giữ nguyên ngày đang có thì qua, để đơn cũ lệch ngày vẫn sửa được ghi chú, hạng mục.
 * - draft: không kiểm (nháp chưa tới tay khách).
 */
export function weddingDateIssue(
  eventDate: string,
  weddingDate: string | null | undefined,
  opts: { mode: ParseMode; currentEventDate?: string; today?: string },
): { code: string; message: string; status: number } | null {
  if (!weddingDate || opts.mode === 'draft') return null;
  if (opts.mode === 'send' && weddingDate <= (opts.today ?? todayVn())) {
    return { code: 'WEDDING_DATE_PASSED', message: `Ngày cưới của khách (${dmy(weddingDate)}) đã qua hoặc là hôm nay. Nhắn khách cập nhật ngày cưới trước khi gửi đơn.`, status: 409 };
  }
  if (eventAfterWedding(eventDate, weddingDate) && !(opts.mode === 'edit' && eventDate === opts.currentEventDate)) {
    return { code: 'EVENT_DATE_AFTER_WEDDING', message: `Ngày thực hiện (${dmy(eventDate)}) không được sau ngày cưới của khách (${dmy(weddingDate)}).`, status: 422 };
  }
  return null;
}

// ---------- Tiền cọc ----------

export const DEPOSIT_ROUNDING = 100_000;
export const DEPOSIT_MIN = 100_000;
/** Tỷ lệ cọc tối thiểu khi gửi đơn (%). Đợt 1 (cọc) khách chuyển khoản qua VNPay, đợt 2 (còn lại) trả tiền mặt cho NCC. */
export const DEPOSIT_PERCENT_MIN = 10;

/** Tổng × tỷ lệ / 100, làm tròn gần nhất đến 100.000đ, tối thiểu 100.000đ (cọc 0đ thì khách không thanh toán được). */
export function depositOf(total: number, percent: number): number {
  if (!(percent > 0 && percent < 100) || !(total > 0)) return 0;
  const rounded = Math.round((total * percent) / 100 / DEPOSIT_ROUNDING) * DEPOSIT_ROUNDING;
  return Math.max(DEPOSIT_MIN, rounded);
}

// ---------- Hằng số ----------

export const ORDER_STATUSES = ['Draft', 'Pending', 'NeedRevision', 'Deposited', 'Completed', 'Expired', 'Cancelled'] as const;
export const CANCEL_REASONS = ['CUSTOMER_REQUEST', 'VENDOR_UNABLE'] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];
export const CANCEL_LABEL: Record<CancelReason, string> = { CUSTOMER_REQUEST: 'Khách yêu cầu hủy', VENDOR_UNABLE: 'NCC không thể thực hiện' };

export const CHANGE_TYPES = ['Item', 'Quantity', 'EventDate', 'Other'] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];
export const CHANGE_LABEL: Record<ChangeType, string> = { Item: 'Đổi hạng mục', Quantity: 'Đổi số lượng', EventDate: 'Đổi ngày thực hiện', Other: 'Khác' };

export const UNITS = ['Gói', 'Bàn'] as const;
const PHONE = /^[0-9 +().-]{9,15}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

/**
 * UUID tăng dần theo thời điểm tạo (dạng v7): bảng OrderItems không có cột thứ tự, nên sắp theo Id để các
 * hạng mục luôn hiện đúng thứ tự NCC nhập. i = vị trí dòng trong cùng một lần tạo.
 */
export function orderedUuid(i: number): string {
  const ts = Date.now().toString(16).padStart(12, '0');
  const rand = randomBytes(8).toString('hex');
  const seq = (i & 0xfff).toString(16).padStart(3, '0');
  const variant = (0x8 | (parseInt(rand[0], 16) & 0x3)).toString(16);
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${seq}-${variant}${rand.slice(1, 4)}-${rand.slice(4, 16)}`;
}

// ---------- Nội dung đơn ----------

export interface ContentInput {
  customerName?: string;
  customerPhone?: string;
  eventDate?: string;
  note?: string | null;
  depositPercent?: number | string | null;
  items?: { itemName?: string; unit?: string; quantity?: number | string; unitPrice?: number | string }[];
}

export interface ParsedItem {
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface ParsedContent {
  customerName: string;
  customerPhone: string;
  eventDate: string;
  note: string | null;
  depositPercent: number;
  items: ParsedItem[];
  total: number;
}

/** draft: lưu nháp (chỉ bắt buộc ngày). send: gửi hoặc cập nhật đơn (kiểm tra đủ, kiểm tra cọc). edit: sửa sau cọc (như send, không kiểm tra cọc). */
export type ParseMode = 'draft' | 'send' | 'edit';

/**
 * Kiểm tra và chuẩn hóa nội dung đơn. Lỗi trường: 400 VALIDATION_ERROR kèm `details` theo trường
 * (customerName, customerPhone, eventDate, depositPercent, items, items.<i>.itemName|quantity|unitPrice|unit, deposit).
 * Ngày thực hiện trước hôm nay (giờ VN): 422 EVENT_DATE_IN_PAST, trừ khi giữ nguyên ngày hiện có của đơn (currentEventDate)
 * hoặc đang lưu nháp. Có `weddingDate`: thêm 409 WEDDING_DATE_PASSED và 422 EVENT_DATE_AFTER_WEDDING (xem weddingDateIssue).
 */
export function parseContent(c: ContentInput, mode: ParseMode, opts: { currentEventDate?: string; weddingDate?: string | null } = {}): ParsedContent {
  const strict = mode !== 'draft';
  const errors: Record<string, string> = {};

  const customerName = c.customerName?.trim() ?? '';
  const customerPhone = c.customerPhone?.trim() ?? '';
  const eventOk = validYmd(c.eventDate);
  const eventDate = eventOk ? (c.eventDate as string) : '';
  if (!eventOk) errors.eventDate = 'Chọn ngày diễn ra sự kiện.';

  const blank = (i: NonNullable<ContentInput['items']>[number]) => (i.itemName?.trim() ?? '') === '' && !Number(i.quantity) && !Number(i.unitPrice);
  const raw = (c.items ?? []).filter((i) => !blank(i));
  const items: ParsedItem[] = raw.map((i, idx) => {
    const unit = i.unit?.trim() || 'Gói';
    const quantity = Number(i.quantity);
    const unitPrice = Number(i.unitPrice);
    if (strict) {
      if (!i.itemName?.trim()) errors[`items.${idx}.itemName`] = 'Nhập tên hạng mục.';
      if (!Number.isInteger(quantity) || quantity <= 0) errors[`items.${idx}.quantity`] = 'Số lượng là số nguyên lớn hơn 0.';
      if (!(unitPrice >= 0)) errors[`items.${idx}.unitPrice`] = 'Đơn giá không âm.';
      if (!(UNITS as readonly string[]).includes(unit)) errors[`items.${idx}.unit`] = 'Đơn vị tính là Gói hoặc Bàn.';
    }
    // Lưu nháp: ràng buộc của CSDL (số lượng > 0, đơn giá ≥ 0) vẫn phải đúng nên chuẩn hóa lại
    return {
      itemName: i.itemName?.trim() ?? '',
      unit: (UNITS as readonly string[]).includes(unit) ? unit : 'Gói',
      quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
      unitPrice: unitPrice >= 0 ? unitPrice : 0,
    };
  });
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const hasPercent = c.depositPercent !== undefined && c.depositPercent !== null && String(c.depositPercent).trim() !== '';
  const percent = hasPercent ? Number(c.depositPercent) : 30;
  const percentOk = percent > 0 && percent < 100;
  if (hasPercent && !percentOk) errors.depositPercent = 'Tỷ lệ đặt cọc phải lớn hơn 0 và nhỏ hơn 100 (%).';

  if (strict) {
    if (!customerName) errors.customerName = 'Nhập tên khách hàng.';
    if (!PHONE.test(customerPhone)) errors.customerPhone = 'Số điện thoại gồm 9 đến 15 ký tự (số, khoảng trắng, + ( ) . -).';
    if (!items.length) errors.items = 'Thêm ít nhất một hạng mục.';
    else if (total <= 0) errors.items ??= 'Tổng tiền phải lớn hơn 0.';
    if (!hasPercent) errors.depositPercent = 'Nhập tỷ lệ đặt cọc (%).';
    // Sửa sau cọc giữ nguyên tỷ lệ đã chốt (đơn cũ có thể dưới mức tối thiểu) nên chỉ kiểm khi gửi
    else if (mode === 'send' && percentOk && percent < DEPOSIT_PERCENT_MIN) errors.depositPercent = `Tỷ lệ đặt cọc tối thiểu ${DEPOSIT_PERCENT_MIN}%.`;
    if (mode === 'send' && !errors.items && !errors.depositPercent && depositOf(total, percent) >= total) errors.deposit = 'Tổng đơn quá nhỏ để đặt cọc.';
  }
  if (Object.keys(errors).length) fail('VALIDATION_ERROR', 'Đơn chưa hợp lệ.', 400, errors);

  if (strict && eventDate < todayVn() && eventDate !== opts.currentEventDate) {
    fail('EVENT_DATE_IN_PAST', 'Ngày thực hiện phải từ hôm nay trở đi.', 422, { eventDate: 'Ngày thực hiện phải từ hôm nay trở đi.' });
  }
  const wd = weddingDateIssue(eventDate, opts.weddingDate, { mode, currentEventDate: opts.currentEventDate });
  if (wd) fail(wd.code, wd.message, wd.status, { eventDate: wd.message, weddingDate: opts.weddingDate });

  return { customerName, customerPhone, eventDate, note: c.note?.trim() || null, depositPercent: percent, items, total };
}

/** Các thay đổi nội dung giữa đơn hiện tại và nội dung mới, theo ChangeType (để ghi OrderRevisionChanges sau cọc). */
export function changeTypesBetween(
  prev: { eventDate: string; note: string | null; items: ParsedItem[] },
  next: { eventDate: string; note: string | null; items: ParsedItem[] },
): ChangeType[] {
  const out = new Set<ChangeType>();
  const key = (i: ParsedItem) => i.itemName.trim().toLowerCase();
  const names = (x: ParsedItem[]) => x.map(key).sort().join('|');
  if (names(prev.items) !== names(next.items)) out.add('Item');
  for (const n of next.items) {
    const p = prev.items.find((i) => key(i) === key(n));
    if (p && (p.quantity !== n.quantity || p.unit !== n.unit)) out.add('Quantity');
  }
  if (prev.eventDate !== next.eventDate) out.add('EventDate');
  const priceChanged = prev.items.some((p) => {
    const n = next.items.find((x) => key(x) === key(p));
    return !!n && n.unitPrice !== p.unitPrice;
  });
  if (priceChanged || (prev.note ?? '') !== (next.note ?? '')) out.add('Other');
  return [...out];
}

/** Hai nội dung giống nhau (cùng hạng mục theo thứ tự, ngày, ghi chú, tên, số điện thoại, tỷ lệ cọc). */
export function sameContent(a: ParsedContent, b: ParsedContent): boolean {
  return (
    a.customerName === b.customerName &&
    a.customerPhone === b.customerPhone &&
    a.eventDate === b.eventDate &&
    (a.note ?? '') === (b.note ?? '') &&
    a.depositPercent === b.depositPercent &&
    a.items.length === b.items.length &&
    a.items.every((x, i) => x.itemName === b.items[i].itemName && x.unit === b.items[i].unit && x.quantity === b.items[i].quantity && x.unitPrice === b.items[i].unitPrice)
  );
}

// ---------- Thanh toán đặt cọc ----------

/**
 * Chế độ thanh toán cọc (biến PAYMENT_MODE): 'simulate' ghi nhận thanh toán thành công ngay; 'vnpay' (chưa tích hợp).
 * Chưa đặt biến: giả lập khi chạy dev; nếu NODE_ENV=production thì KHÔNG giả lập, phải đặt rõ PAYMENT_MODE=simulate.
 */
export function paymentMode(): 'simulate' | 'vnpay' | 'off' {
  const mode = process.env.PAYMENT_MODE?.trim().toLowerCase();
  if (mode === 'simulate' || mode === 'vnpay') return mode;
  return process.env.NODE_ENV === 'production' ? 'off' : 'simulate';
}
