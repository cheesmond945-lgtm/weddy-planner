import { normalizePhone, PHONE_MESSAGE, VN_PHONE_RE } from '../../common/phone.ts';
import { HttpException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

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
/** Khách có từng này giờ để đặt cọc kể từ lúc NCC gửi (hoặc gửi bản cập nhật) đơn; quá hạn thì đơn tự hết hạn */
export const DEPOSIT_HOLD_HOURS = 12;
/** Đơn chờ cọc còn dưới từng này giờ là "sắp hết hạn" (thẻ số liệu của NCC, khớp mức gấp ở FE) */
export const DEPOSIT_SOON_HOURS = 6;

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

/** Số ngày sau ngày thực hiện thì hệ thống tự hoàn tất đơn Deposited mà NCC quên bấm Hoàn tất. */
export const AUTO_COMPLETE_DAYS = 7;
/**
 * Mốc tự hoàn tất: đơn Deposited có event_date < mốc này thì tự hoàn tất, tức là khi đã QUÁ ngày thực hiện hơn 7 ngày
 * (event_date < hôm nay − 7, nghĩa là từ ngày thứ 8 sau ngày thực hiện). `today` là "YYYY-MM-DD" giờ VN.
 */
export const autoCompleteCutoff = (today: string) => new Date(`${addDaysYmd(today, -AUTO_COMPLETE_DAYS)}T00:00:00Z`);

/** Tin hệ thống trong chat khi đơn hoàn thành: NCC bấm tay khác với hệ thống tự hoàn tất. */
export const completedChatText = (orderCode: string | null, by: 'VENDOR' | 'SYSTEM') =>
  by === 'VENDOR'
    ? `NCC đã hoàn tất đơn ${orderCode}.`
    : `Đơn ${orderCode} được hệ thống tự hoàn tất vì đã quá ngày thực hiện hơn ${AUTO_COMPLETE_DAYS} ngày mà NCC chưa bấm Hoàn tất.`;
const validYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
/** "YYYY-MM-DD" -> "dd/mm/yyyy" để đưa vào thông báo. */
export const dmy = (s: string) => s.split('-').reverse().join('/');

// ---------- Ngày thực hiện so với ngày cưới (docs/TIMELINE.md mục 7) ----------

/** Ngày thực hiện sau ngày cưới của khách (không có ngày cưới thì không xét). So sánh chuỗi "YYYY-MM-DD" đúng thứ tự thời gian. */
export const eventAfterWedding = (eventDate: string, weddingDate: string | null | undefined) => !!weddingDate && eventDate > weddingDate;

/**
 * Lỗi ngày thực hiện / ngày cưới khi NCC gửi hoặc sửa đơn; null nếu hợp lệ. Hàm thuần, parseContent ném lỗi theo kết quả.
 * - send: ngày cưới của khách phải còn ở phía sau (WEDDING_DATE_PASSED, 409); ngày thực hiện không sau ngày cưới
 *   (EVENT_DATE_AFTER_WEDDING, 422), kể cả khi chỉnh sửa đơn Pending / NeedRevision: khách chưa cọc nên NCC phải sửa.
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

export const DEPOSIT_ROUNDING = 1_000;
export const DEPOSIT_MIN = 100_000;
/** Tỷ lệ cọc tối thiểu (%), áp khi lưu nháp, gửi và chỉnh sửa đơn. Đợt 1 (cọc) khách chuyển khoản qua VietQR, đợt 2 (còn lại) trả tiền mặt cho NCC. */
export const DEPOSIT_PERCENT_MIN = 10;

/** Tổng × tỷ lệ / 100, làm tròn gần nhất đến 1.000đ, tối thiểu 100.000đ (cọc 0đ thì khách không thanh toán được). */
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
export const CHANGE_LABEL: Record<ChangeType, string> = { Item: 'Đổi hạng mục', Quantity: 'Đổi số bàn', EventDate: 'Đổi ngày thực hiện', Other: 'Khác' };

export const UNITS = ['Gói', 'Bàn'] as const;
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
  items?: { id?: string | null; itemName?: string; unit?: string; quantity?: number | string; unitPrice?: number | string; packageId?: string | null }[];
  /** Sảnh (gói) của đơn: bắt buộc khi Trung tâm tiệc cưới gửi / sửa đơn (docs/LICH_BAN_SANH.md); dịch vụ khác bỏ qua */
  packageId?: string | null;
}

export interface ParsedItem {
  /** Id dòng hiện có (order_items.id) mà form gửi lên khi sửa sau cọc, để giữ gói của dòng theo id chứ không theo tên; dòng mới thì không có */
  id?: string | null;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  /** Gói dịch vụ của dòng (order_items.package_id), để sinh việc chi tiết từ quy trình của gói khi cọc. Chỉ kiểm định dạng ở đây; thuộc NCC nào: OrdersService */
  packageId?: string | null;
}

export interface ParsedContent {
  customerName: string;
  customerPhone: string;
  eventDate: string;
  note: string | null;
  depositPercent: number;
  items: ParsedItem[];
  total: number;
  /** Sảnh đã chọn (chỉ kiểm định dạng ở đây; thuộc NCC nào, có bận không: OrdersService.checkHall) */
  packageId: string | null;
}

/** draft: lưu nháp (chỉ bắt buộc ngày). send: gửi hoặc chỉnh sửa đơn (kiểm tra đủ, kiểm tra cọc). edit: sửa sau cọc (như send, không kiểm tra cọc). */
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
  const customerPhone = normalizePhone(c.customerPhone);
  const eventOk = validYmd(c.eventDate);
  const eventDate = eventOk ? (c.eventDate as string) : '';
  if (!eventOk) errors.eventDate = 'Chọn ngày thực hiện dịch vụ.';

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
    const itemPackage = i.packageId === undefined || i.packageId === null || String(i.packageId).trim() === '' ? null : String(i.packageId).trim();
    if (itemPackage && !UUID.test(itemPackage)) errors[`items.${idx}.packageId`] = 'Gói không hợp lệ.';
    // Lưu nháp: ràng buộc của CSDL (số lượng > 0, đơn giá ≥ 0) vẫn phải đúng nên chuẩn hóa lại
    const itemId = i.id && UUID.test(String(i.id).trim()) ? String(i.id).trim() : null;
    return {
      id: itemId,
      packageId: itemPackage,
      itemName: i.itemName?.trim() ?? '',
      unit: (UNITS as readonly string[]).includes(unit) ? unit : 'Gói',
      quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
      unitPrice: unitPrice >= 0 ? unitPrice : 0,
    };
  });
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const packageId = c.packageId === undefined || c.packageId === null || String(c.packageId).trim() === '' ? null : String(c.packageId).trim();
  if (packageId && !UUID.test(packageId)) errors.packageId = 'Sảnh không hợp lệ.';

  const hasPercent = c.depositPercent !== undefined && c.depositPercent !== null && String(c.depositPercent).trim() !== '';
  const percent = hasPercent ? Number(c.depositPercent) : 30;
  const percentOk = percent > 0 && percent < 100;
  if (hasPercent && !percentOk) errors.depositPercent = 'Tỷ lệ đặt cọc phải lớn hơn 0 và nhỏ hơn 100 (%).';
  // Tối thiểu 10% áp cho cả lưu nháp lẫn gửi / chỉnh sửa đơn (không để nháp 5% rồi mới bị chặn lúc gửi). Sửa sau cọc giữ nguyên tỷ lệ đã chốt (đơn cũ có thể dưới mức tối thiểu) nên bỏ qua.
  else if (hasPercent && mode !== 'edit' && percent < DEPOSIT_PERCENT_MIN) errors.depositPercent = `Tỷ lệ đặt cọc tối thiểu ${DEPOSIT_PERCENT_MIN}%.`;

  if (strict) {
    if (!customerName) errors.customerName = 'Nhập tên khách hàng.';
    if (!VN_PHONE_RE.test(customerPhone)) errors.customerPhone = PHONE_MESSAGE;
    if (!items.length) errors.items = 'Thêm ít nhất một hạng mục.';
    else if (total <= 0) errors.items ??= 'Tổng tiền phải lớn hơn 0.';
    if (!hasPercent) errors.depositPercent = 'Nhập tỷ lệ đặt cọc (%).';
    if (mode === 'send' && !errors.items && !errors.depositPercent && depositOf(total, percent) >= total) errors.deposit = 'Tổng đơn quá nhỏ để đặt cọc.';
  }
  if (Object.keys(errors).length) fail('VALIDATION_ERROR', 'Đơn chưa hợp lệ.', 400, errors);

  if (strict && eventDate < todayVn() && eventDate !== opts.currentEventDate) {
    fail('EVENT_DATE_IN_PAST', 'Ngày thực hiện phải từ hôm nay trở đi.', 422, { eventDate: 'Ngày thực hiện phải từ hôm nay trở đi.' });
  }
  const wd = weddingDateIssue(eventDate, opts.weddingDate, { mode, currentEventDate: opts.currentEventDate });
  if (wd) fail(wd.code, wd.message, wd.status, { eventDate: wd.message, weddingDate: opts.weddingDate });

  return { customerName, customerPhone, eventDate, note: c.note?.trim() || null, depositPercent: percent, items, total, packageId };
}

/** Các thay đổi nội dung giữa đơn hiện tại và nội dung mới, theo ChangeType (để ghi OrderRevisionChanges sau cọc). */
export function changeTypesBetween(
  prev: { eventDate: string; note: string | null; items: ParsedItem[]; packageId?: string | null; customerName?: string; customerPhone?: string },
  next: { eventDate: string; note: string | null; items: ParsedItem[]; packageId?: string | null; customerName?: string; customerPhone?: string },
): ChangeType[] {
  const out = new Set<ChangeType>();
  const key = (i: ParsedItem) => i.itemName.trim().toLowerCase();
  const names = (x: ParsedItem[]) => x.map(key).sort().join('|');
  // Đổi sảnh, đổi gói của dòng hạng mục tính là đổi hạng mục
  const pkgs = (x: ParsedItem[]) => x.map((i) => i.packageId ?? '').sort().join('|');
  if (names(prev.items) !== names(next.items) || (prev.packageId ?? null) !== (next.packageId ?? null) || pkgs(prev.items) !== pkgs(next.items)) out.add('Item');
  for (const n of next.items) {
    const p = prev.items.find((i) => key(i) === key(n));
    if (p && (p.quantity !== n.quantity || p.unit !== n.unit)) out.add('Quantity');
  }
  if (prev.eventDate !== next.eventDate) out.add('EventDate');
  const priceChanged = prev.items.some((p) => {
    const n = next.items.find((x) => key(x) === key(p));
    return !!n && n.unitPrice !== p.unitPrice;
  });
  // Đổi tên hoặc số điện thoại khách trên đơn tính là thay đổi khác
  const contactChanged = (prev.customerName ?? '') !== (next.customerName ?? '') || (prev.customerPhone ?? '') !== (next.customerPhone ?? '');
  if (priceChanged || contactChanged || (prev.note ?? '') !== (next.note ?? '')) out.add('Other');
  return [...out];
}

/** Hai nội dung giống nhau (cùng hạng mục theo thứ tự, ngày, ghi chú, tên, số điện thoại, tỷ lệ cọc, sảnh). */
export function sameContent(a: ParsedContent, b: ParsedContent): boolean {
  return (
    (a.packageId ?? null) === (b.packageId ?? null) &&
    a.customerName === b.customerName &&
    a.customerPhone === b.customerPhone &&
    a.eventDate === b.eventDate &&
    (a.note ?? '') === (b.note ?? '') &&
    a.depositPercent === b.depositPercent &&
    a.items.length === b.items.length &&
    a.items.every((x, i) => x.itemName === b.items[i].itemName && x.unit === b.items[i].unit && x.quantity === b.items[i].quantity && x.unitPrice === b.items[i].unitPrice && (x.packageId ?? null) === (b.items[i].packageId ?? null))
  );
}

/**
 * Sửa sau cọc: gói của dòng theo NCC gửi lên (NCC đổi được gói khi khách muốn đổi; việc chi tiết đổi theo ở packageSwitchPlan:
 * việc trùng tên giữ tiến độ, việc chỉ gói cũ có bị bỏ, việc chỉ gói mới có được thêm). Gói phải thuộc NCC (checkItemPackages).
 * Riêng dòng đang gắn sảnh cũ của đơn khi sảnh đổi sang `hall.to` thì chuyển theo sảnh mới (dòng sảnh đổi theo sảnh).
 * `current` giữ cho nơi gọi cũ, không còn dùng để khóa gói.
 */
export function carryItemPackages<T extends { id?: string | null; packageId?: string | null }>(
  items: readonly T[],
  current: readonly { id?: string | null; packageId?: string | null }[],
  hall?: { from: string | null; to: string | null },
): (T & { packageId: string | null })[] {
  void current;
  return items.map((i) => {
    let pkg = i.packageId ?? null;
    if (pkg && hall?.to && hall.from && pkg === hall.from && hall.to !== hall.from) pkg = hall.to;
    return { ...i, packageId: pkg };
  });
}

/**
 * Số bàn tối thiểu của sảnh cho dòng gắn sảnh (400 "Sảnh <tên> đặt tối thiểu N bàn."). Dòng gắn sảnh = dòng có packageId trùng sảnh.
 * Tạo / lưu nháp / gửi đơn: kiểm mọi dòng sảnh. Sửa đơn (`prior`): chỉ kiểm khi đổi sảnh hoặc số lượng dòng sảnh bị thay đổi
 * so với dòng cùng id trước đó; đơn cũ không đổi dòng sảnh thì không kiểm (có thể đã dưới mức tối thiểu từ trước).
 * Trả vị trí dòng và thông báo của dòng sai đầu tiên, hoặc null.
 */
export function hallTablesIssue(
  items: readonly { id?: string | null; quantity: number; packageId?: string | null }[],
  hall: { id: string; name: string; minTables: number | null },
  prior?: { hallId: string | null; items: readonly { id?: string | null; quantity: number }[] },
): { index: number; message: string } | null {
  const min = hall.minTables;
  if (!min || min <= 0) return null;
  for (let index = 0; index < items.length; index++) {
    const it = items[index];
    if (it.packageId !== hall.id || it.quantity >= min) continue;
    const before = prior && prior.hallId === hall.id && it.id ? prior.items.find((p) => p.id === it.id) : undefined;
    if (before && before.quantity === it.quantity) continue; // đơn cũ, không đổi dòng sảnh
    return { index, message: `Sảnh ${hall.name} đặt tối thiểu ${min} bàn.` };
  }
  return null;
}

/**
 * "Phiên bản" của đơn để chặn lưu đè khi đơn đã bị sửa từ nơi khác (hai tab, NCC và khách cùng lúc). Bảng orders không có updated_at / version
 * nên dùng dấu vân tay nội dung: băm trạng thái, thông tin khách, ngày, ghi chú, tỷ lệ cọc, sảnh, tổng tiền và các dòng (id, tên, đơn vị, số lượng, giá, gói).
 * Mỗi lần sửa đơn các dòng được tạo lại với id mới nên sửa nào cũng đổi phiên bản.
 */
export function orderVersionOf(o: {
  status: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  event_date: Date | null;
  note: string | null;
  deposit_percent: unknown;
  package_id: string | null;
  total_amount: unknown;
  order_items: readonly { id: string; item_name: string | null; unit: string | null; quantity: number | null; unit_price: unknown; package_id: string | null }[];
}): string {
  const items = [...o.order_items].sort((a, b) => a.id.localeCompare(b.id)).map((i) => [i.id, i.item_name ?? '', i.unit ?? '', i.quantity ?? 0, Number(i.unit_price), i.package_id ?? null]);
  const body = JSON.stringify([o.status, o.customer_name ?? '', o.customer_phone ?? '', o.event_date ? o.event_date.toISOString().slice(0, 10) : '', o.note ?? '', Number(o.deposit_percent), o.package_id ?? null, Number(o.total_amount), items]);
  return createHash('sha1').update(body).digest('hex').slice(0, 16);
}

/** Phiên bản mà form mở ra (`expected`) khác phiên bản hiện tại của đơn: 409 ORDER_STALE. Không gửi `expected` thì không kiểm. */
export function assertOrderFresh(expected: unknown, current: string): void {
  if (expected === undefined || expected === null || expected === '') return;
  if (expected !== current) fail('ORDER_STALE', 'Đơn đã được cập nhật ở nơi khác, vui lòng mở lại.', 409);
}

/** Khách không yêu cầu đổi gói (Đổi hạng mục) khi còn dưới từng này ngày tới ngày thực hiện (NCC đang chuẩn bị gấp) */
export const PACKAGE_CHANGE_MIN_DAYS = 7;
/** ... hoặc khi NCC đã hoàn thành từ tỷ lệ này số việc của gói trở lên (đã chuẩn bị nhiều, đổi gói sẽ phí công) */
export const PACKAGE_CHANGE_MAX_DONE = 0.5;

/**
 * Đơn đã cọc còn cho khách yêu cầu đổi gói (Đổi hạng mục) không: trả lý do khóa (hiện cho khách) hoặc null nếu còn đổi được.
 * Chỉ áp dụng cho đơn đã cọc; NCC vẫn tự đổi được gói trong "Chỉnh sửa đơn" nếu đồng ý.
 * `done` / `total`: số việc của gói (mã 'PKG:') đã xong / tổng của đơn.
 */
export function packageChangeLock(o: { deposited: boolean; today: string; eventDate: string; done: number; total: number }): string | null {
  if (!o.deposited || !o.eventDate) return null;
  const days = Math.round((Date.parse(o.eventDate) - Date.parse(o.today)) / DAY);
  if (days < PACKAGE_CHANGE_MIN_DAYS) return `Còn dưới ${PACKAGE_CHANGE_MIN_DAYS} ngày đến ngày thực hiện, nhà cung cấp đang chuẩn bị nên không đổi gói được nữa.`;
  if (o.total > 0 && o.done / o.total >= PACKAGE_CHANGE_MAX_DONE) return `Nhà cung cấp đã hoàn thành ${o.done}/${o.total} việc chuẩn bị của gói nên không đổi gói được nữa.`;
  return null;
}
