/**
 * So sánh 2–3 dịch vụ cùng hạng mục bằng thuật toán (không DB, không Nest, không gọi AI). Unit test: backend/test/compare-rules.test.cjs.
 * Đặc tả: docs/api/compare.md. Hằng số: compare.config.ts.
 *
 * Mọi so sánh và nhãn dùng TỔNG CHI PHÍ ƯỚC TÍNH (tiệc: đơn giá/bàn × max(số bàn, số bàn tối thiểu)), không dùng đơn giá.
 * Không đề xuất chọn bên nào: chỉ gắn nhãn theo từng dòng và ghép câu tóm tắt các khác biệt.
 */
import { CAPACITY_NOTABLE_GAP, INCLUDE_MAX_CHARS, MAX_INCLUDES, MIN_REVIEWS, VENUE_SLUG } from './compare.config';

export interface CmpPackage {
  id: string;
  name: string;
  /** Đơn giá/bàn (tiệc) hoặc giá trọn gói */
  price: number;
  minTables: number | null;
  capacity: number | null;
  description: string;
  /** Thẻ của gói do NCC nhập (phong cách, kiểu dáng): dữ liệu có cấu trúc cho dòng "Bao gồm" */
  tags?: string[];
}

/** Lịch ngày cưới của một gói: còn trống / đã kín / NCC chưa xác nhận */
export type DayAvailability = 'FREE' | 'FULL' | 'UNCONFIRMED' | 'MINE';

export interface CmpItem {
  id: string;
  name: string;
  /** Lịch ngày cưới theo gói (packageId -> trạng thái); không có ngày cưới thì bỏ trống */
  availability?: Record<string, DayAvailability>;
  /** Đơn còn hiệu lực của khách với NCC này: tổng chi phí lấy theo giá đơn (cùng số với tab Ngân sách) */
  order?: { total: number; deposited: boolean; packageId: string | null } | null;
  /** Phường/xã chính thức của NCC (có tiền tố); null khi không xác định được */
  ward: string | null;
  rating: number | null;
  reviewCount: number;
  packages: CmpPackage[];
}

export interface CmpContext {
  slug: string;
  /** Số khách dự kiến; null khi kế hoạch chưa có */
  guestCount: number | null;
  /** Số bàn của kế hoạch = ⌈số khách / GUESTS_PER_TABLE⌉; null khi chưa có số khách */
  tables: number | null;
  /** Ngân sách hạng mục (Giới hạn của hàm phân bổ); null khi kế hoạch chưa có tổng ngân sách */
  budget: number | null;
  /** Phường/xã nơi tổ chức (có tiền tố); null thì ẩn dòng Vị trí */
  weddingWard: string | null;
  /** Ngày cưới "YYYY-MM-DD"; null thì ẩn dòng Lịch ngày cưới */
  weddingDate?: string | null;
  /** Tên NCC hạng mục này khách đã cọc: các NCC khác không thêm được từ trang So sánh */
  lockedBy?: string | null;
  /** Tiền cọc khách đã nộp cho NCC `lockedBy` (có thể mất nếu đổi, tùy chính sách NCC) */
  lockedDeposit?: number;
  /**
   * Hệ quả khi hạng mục tốn `total` (`switching`: đổi khỏi NCC đã cọc, tính thêm tiền cọc có thể mất): các khoản cộng / trừ
   * (Tổng ngân sách − đã chọn ở hạng mục khác − hạng mục này − …) để hiện được phép tính, và số dịch vụ chưa chọn.
   */
  consequence?: ((total: number, switching: boolean) => { openCount: number; parts: { label: string; amount: number; sign: 1 | -1 }[] }) | null;
}

/** 232000000 → "232.000.000đ" (đầy đủ dấu chấm, không viết tắt "tr") */
export const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
const num = (n: number) => n.toLocaleString('vi-VN');
const shortWard = (w: string) => w.replace(/^(Phường|Xã) /, '');

export const isVenue = (slug: string) => slug === VENUE_SLUG;
/** "2026-11-28" → "28/11" */
/** Làm tròn 10.000đ (cùng cách tab Ngân sách); mọi số tiền hiển thị và chênh lệch tính từ số đã làm tròn */
export const round10k = (n: number) => Math.floor(n / 10_000 + 0.5) * 10_000;
const dayMonth = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const AVAILABILITY_TEXT: Record<DayAvailability, string> = { FREE: 'Còn trống', FULL: 'Đã kín', UNCONFIRMED: 'Chưa xác nhận', MINE: 'Đã giữ' };

/**
 * Tổng chi phí ước tính của một gói. Tiệc: đơn giá × max(số bàn, số bàn tối thiểu). Kế hoạch chưa có số khách thì giả định
 * theo số bàn tối thiểu; gói cũng không ghi tối thiểu thì không tính được (null). Hạng mục khác: giá gói.
 */
export function packageTotal(p: CmpPackage, slug: string, tables: number | null) {
  if (!isVenue(slug))
    return {
      total: p.price,
      chargedTables: null as number | null,
      byMinimum: false,
      assumed: false,
    };
  if (tables === null) {
    return p.minTables
      ? {
          total: p.price * p.minTables,
          chargedTables: p.minTables,
          byMinimum: true,
          assumed: true,
        }
      : { total: null, chargedTables: null, byMinimum: false, assumed: true };
  }
  const charged = Math.max(tables, p.minTables ?? 0, 1);
  return {
    total: p.price * charged,
    chargedTables: charged,
    byMinimum: (p.minTables ?? 0) > tables,
    assumed: false,
  };
}

/**
 * Gói mặc định: gói rẻ nhất có tổng chi phí ≤ ngân sách hạng mục; không có thì gói rẻ nhất (so theo tổng chi phí).
 * Bỏ qua gói đã kín ngày cưới nếu NCC còn gói khác chưa kín.
 */
export function defaultPackage(item: CmpItem, ctx: CmpContext) {
  const open = item.packages.filter((p) => item.availability?.[p.id] !== 'FULL');
  const sorted = [...(open.length ? open : item.packages)].sort(
    (a, b) => (packageTotal(a, ctx.slug, ctx.tables).total ?? a.price) - (packageTotal(b, ctx.slug, ctx.tables).total ?? b.price) || a.price - b.price || a.id.localeCompare(b.id),
  );
  if (!sorted.length) return null;
  const within = ctx.budget === null ? [] : sorted.filter((p) => (packageTotal(p, ctx.slug, ctx.tables).total ?? Infinity) <= ctx.budget!);
  return within[0] ?? sorted[0];
}

/**
 * Dòng "Bao gồm": 3–4 ý ngắn. Trước hết là thẻ của gói (dữ liệu có cấu trúc), rồi bổ sung cụm ngắn tách từ mô tả
 * (xuống dòng, gạch đầu dòng, chấm, chấm phẩy, dấu phẩy). Bỏ cụm dài, cụm nhắc tên NCC / tên gói, giá, sức chứa (đã có dòng riêng).
 */
export function includesOf(description: string, tags: string[] = [], names: string[] = []) {
  const fold = (x: string) => x.toLowerCase();
  const skip = (x: string) =>
    x.length > INCLUDE_MAX_CHARS ||
    /giá|đ\/|\d{3}\.\d{3}|sức chứa|khách|giới thiệu|liên hệ|tư vấn|trao đổi|điều chỉnh|^tùy |lịch chụp|^số /i.test(x) ||
    names.some((n) => n && fold(x).includes(fold(n)));
  const clauses = description
    .split(/\r?\n|[•;]|,\s+|\.\s+/)
    .map((x) =>
      x
        .replace(/^[-–*+\s]+/, '')
        .replace(/^(với|và|theo|gồm|có)\s+/i, '')
        .replace(/\.$/, '')
        .trim(),
    )
    .filter((x) => x.length >= 2 && !skip(x))
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  const out: string[] = [];
  for (const x of [...tags.map((t) => `Phong cách ${t.toLowerCase()}`), ...clauses]) {
    if (out.length >= MAX_INCLUDES) break;
    if (!out.some((o) => fold(o) === fold(x))) out.push(x);
  }
  return out;
}

/** Giá trị nhỏ nhất / lớn nhất duy nhất (hòa thì không có) */
function uniqueBest(values: (number | null)[], pick: 'min' | 'max') {
  const real = values.filter((v): v is number => v !== null);
  if (real.length < 2 || real.length !== values.length) return null;
  const best = pick === 'min' ? Math.min(...real) : Math.max(...real);
  return real.filter((v) => v === best).length === 1 ? best : null;
}

const joinNames = (names: string[]) => (names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} và ${names.at(-1)}`);

export function compareServices(items: CmpItem[], ctx: CmpContext, picked: Record<string, string> = {}) {
  const venue = isVenue(ctx.slug);

  const columns = items.map((it) => {
    // Đã cọc: khóa ở đúng gói trong đơn (không đổi gói ở trang này)
    const locked = !!it.order?.deposited;
    const orderPkg = locked ? it.packages.find((p) => p.id === it.order!.packageId) : undefined;
    const pkg = orderPkg ?? it.packages.find((p) => p.id === picked[it.id]) ?? defaultPackage(it, ctx);
    const cost = pkg ? packageTotal(pkg, ctx.slug, ctx.tables) : null;
    // Khách đã có đơn với NCC này: tổng theo giá đơn (cùng số với tab Ngân sách), không theo giá niêm yết
    const rawTotal = it.order ? it.order.total : (cost?.total ?? null);
    const total = rawTotal === null ? null : round10k(rawTotal);
    const ref = ctx.budget === null ? null : round10k(ctx.budget);

    // Lịch ngày cưới của gói đang xem (ưu tiên hàng đầu)
    const dayStatus = ctx.weddingDate && pkg ? (it.availability?.[pkg.id] ?? 'UNCONFIRMED') : null;
    const availability =
      dayStatus && ctx.weddingDate
        ? {
            status: dayStatus,
            text: dayStatus === 'MINE' ? `Đã giữ ngày ${dayMonth(ctx.weddingDate)} cho bạn` : `${AVAILABILITY_TEXT[dayStatus]} ngày ${dayMonth(ctx.weddingDate)}`,
          }
        : null;
    const full = dayStatus === 'FULL';

    // Số bàn tính phí (chỉ tiệc): cảnh báo khi tối thiểu của gói lớn hơn số bàn dự kiến
    const tables =
      venue && pkg && cost
        ? {
            count: cost.chargedTables,
            byMinimum: cost.byMinimum,
            text:
              cost.chargedTables === null
                ? 'Theo số bàn bạn đặt'
                : cost.assumed
                  ? `${num(cost.chargedTables)} bàn, tối thiểu của gói (tạm tính vì kế hoạch chưa có số khách)`
                  : cost.byMinimum
                    ? `${num(cost.chargedTables)} bàn, tối thiểu của gói`
                    : `${num(cost.chargedTables)} bàn, theo dự kiến của bạn`,
            warning:
              cost.byMinimum && !cost.assumed && ctx.tables !== null
                ? `Gói này yêu cầu tối thiểu ${num(pkg.minTables!)} bàn, nhiều hơn ${num(pkg.minTables! - ctx.tables)} bàn so với dự kiến của bạn`
                : null,
          }
        : null;

    // So với mức gợi ý của hạng mục (giới hạn gợi ý như khi hạng mục chưa chọn, không phải giá đơn đang có)
    const budget =
      ref !== null && total !== null
        ? total < ref
          ? { kind: 'LEFT' as const, amount: ref - total, text: `Thấp hơn mức gợi ý ${vnd(ref - total)}` }
          : total === ref
            ? { kind: 'EXACT' as const, amount: 0, text: 'Bằng mức gợi ý' }
            : { kind: 'OVER' as const, amount: total - ref, text: `Cao hơn mức gợi ý ${vnd(total - ref)}` }
        : null;

    // Hệ quả. Đã cọc NCC khác cùng hạng mục: khung "Nếu đổi sang {NCC}", tính thêm tiền cọc có thể mất.
    // NCC đã cọc: tình hình hiện tại. Còn lại: "Chọn gói này thì …". Số dư tính từ các khoản đã làm tròn (cộng lại khớp phép tính).
    const switching = !!ctx.lockedBy && ctx.lockedBy !== it.name;
    const after = ctx.consequence && rawTotal !== null ? ctx.consequence(rawTotal, switching) : null;
    let consequence: { over: boolean; text: string; detail: string } | null = null;
    if (after) {
      const parts = after.parts.map((x) => ({ ...x, amount: round10k(x.amount) }));
      const available = parts.reduce((t, x) => t + x.sign * x.amount, 0);
      const rest =
        available < 0 ? `vượt tổng ngân sách ${vnd(-available)}` : after.openCount ? `còn ${vnd(available)} cho ${num(after.openCount)} dịch vụ chưa chọn` : `ngân sách còn ${vnd(available)}`;
      const lead = switching
        ? '' // tiền cọc có thể mất ghi một lần ở lockNote; cột chỉ ghi kết quả
        : locked
          ? 'Hiện tại '
          : 'Chọn gói này thì ';
      consequence = {
        over: available < 0,
        text: lead ? lead + rest : rest.charAt(0).toUpperCase() + rest.slice(1),
        detail: parts.map((x, i) => `${i === 0 ? '' : x.sign < 0 ? '− ' : '+ '}${x.label} ${vnd(x.amount)}`).join(' ') + ` = ${available < 0 ? '−' : ''}${vnd(Math.abs(available))}`,
      };
    }

    // Vị trí: chỉ so khi cả nơi tổ chức và NCC cùng xác định được phường/xã
    const location =
      ctx.weddingWard && it.ward
        ? it.ward === ctx.weddingWard
          ? {
              same: true,
              text: `${shortWard(ctx.weddingWard)}, cùng khu vực nơi tổ chức`,
            }
          : {
              same: false,
              text: shortWard(it.ward),
            }
        : null;

    // Sức chứa (chỉ tiệc): gói không đủ chỗ thì cảnh báo và khóa nút thêm vào kế hoạch
    const fits = !venue || !pkg || pkg.capacity === null || ctx.guestCount === null || pkg.capacity >= ctx.guestCount;
    const capacity =
      venue && pkg && pkg.capacity !== null
        ? {
            max: pkg.capacity,
            fits,
            text:
              ctx.guestCount === null
                ? `Tối đa ${num(pkg.capacity)} khách`
                : fits
                  ? `Tối đa ${num(pkg.capacity)} khách, đủ cho ${num(ctx.guestCount)} khách của bạn`
                  : `Tối đa ${num(pkg.capacity)} khách, không đủ cho ${num(ctx.guestCount)} khách của bạn`,
          }
        : null;

    return {
      id: it.id,
      name: it.name,
      package: pkg ? { id: pkg.id, name: pkg.name, price: pkg.price } : null,
      /** Dropdown chọn gói: xếp theo tổng chi phí tăng dần */
      packages: it.packages
        .map((p) => ({
          id: p.id,
          name: p.name,
          total: packageTotal(p, ctx.slug, ctx.tables).total,
        }))
        .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity) || a.name.localeCompare(b.name, 'vi')),
      total,
      /** Công thức nhỏ dưới tổng: "40 × 5.800.000đ" (chỉ tiệc); có đơn thì ghi theo giá đơn */
      formula: it.order
        ? it.order.deposited
          ? 'Theo đơn đã cọc của bạn'
          : 'Theo đơn nhà cung cấp gửi'
        : venue && pkg && cost?.chargedTables
          ? `${num(cost.chargedTables)} × ${vnd(pkg.price)}`
          : null,
      availability,
      consequence,
      /** Đã cọc NCC này: khóa ô chọn gói (đổi gói / NCC làm qua đơn ở tab Dịch vụ) */
      locked,
      assumption: cost?.assumed ? 'Tạm tính theo số bàn tối thiểu của gói vì kế hoạch chưa có số khách' : null,
      budget,
      tables,
      location,
      capacity,
      rating: {
        value: it.reviewCount > 0 ? it.rating : null,
        count: it.reviewCount,
        text: it.reviewCount > 0 && it.rating !== null ? `${it.rating.toLocaleString('vi-VN')}/5 từ ${num(it.reviewCount)} lượt` : 'Chưa có đánh giá',
      },
      includes: pkg ? includesOf(pkg.description, pkg.tags, [it.name, pkg.name]) : [],
      canAdd: fits && !full && !(ctx.lockedBy && ctx.lockedBy !== it.name),
      /** Loại khóa: LOCKED (đã cọc NCC khác, FE hiện một cảnh báo chung lockNote), FULL (đã kín), CAPACITY (không đủ chỗ) */
      blockKind: full ? ('FULL' as const) : ctx.lockedBy && ctx.lockedBy !== it.name ? ('LOCKED' as const) : fits ? null : ('CAPACITY' as const),
      blockReason: full
        ? `${it.name} đã kín ngày ${dayMonth(ctx.weddingDate!)}.`
        : ctx.lockedBy && ctx.lockedBy !== it.name
          ? `Bạn đã cọc ${ctx.lockedBy}. Muốn đổi, hãy nhắn ${ctx.lockedBy} hoặc hủy đơn ở tab Dịch vụ.`
          : fits
            ? null
            : `Gói này không đủ chỗ cho ${num(ctx.guestCount!)} khách. Hãy chọn gói khác.`,
      labels: { cheapest: false, largestCapacity: false, topRated: false },
    };
  });

  // Nhãn theo dòng, chỉ khi các bên khác nhau (hòa thì không gắn). Bên đã kín ngày cưới không đem so giá.
  const open = columns.filter((c) => c.availability?.status !== 'FULL');
  // Một bên là giá đơn thật, bên kia giá niêm yết: không so "rẻ hơn" / "Chi phí thấp nhất" (so vậy luôn lệch, không có nghĩa)
  const hasOrder = items.some((it) => it.order);
  const minTotal =
    !hasOrder && open.length >= 2
      ? uniqueBest(
          open.map((c) => c.total),
          'min',
        )
      : null;
  const maxCap = venue
    ? uniqueBest(
        columns.map((c) => c.capacity?.max ?? null),
        'max',
      )
    : null;
  const allRated = columns.every((c) => c.rating.count >= MIN_REVIEWS && c.rating.value !== null);
  const maxRating = allRated
    ? uniqueBest(
        columns.map((c) => c.rating.value),
        'max',
      )
    : null;
  for (const c of columns) {
    c.labels.cheapest = minTotal !== null && c.total === minTotal && open.includes(c);
    c.labels.largestCapacity = maxCap !== null && c.capacity?.max === maxCap;
    c.labels.topRated = maxRating !== null && c.rating.value === maxRating;
  }

  // Dòng tóm tắt: chỉ nêu khác biệt, không khuyên chọn bên nào
  const summary: string[] = [];
  for (const c of columns.filter((x) => x.availability?.status === 'FULL')) summary.push(`${c.name} đã kín ngày ${dayMonth(ctx.weddingDate!)}.`);
  if (minTotal !== null) {
    const a = open.find((c) => c.total === minTotal)!;
    const others = open.filter((c) => c !== a).sort((x, y) => x.total! - y.total!);
    summary.push(`${a.name} rẻ hơn ${others.map((o) => `${o.name} ${vnd(o.total! - minTotal)}`).join(', rẻ hơn ')}.`);
  }
  if (maxCap !== null && ctx.guestCount !== null && columns.every((c) => c.capacity && c.capacity.fits)) {
    const b = columns.find((c) => c.capacity?.max === maxCap)!;
    const next = Math.max(...columns.filter((c) => c !== b).map((c) => c.capacity!.max));
    const second = columns.find((c) => c !== b && c.capacity!.max === next)!;
    if (maxCap - next >= CAPACITY_NOTABLE_GAP) summary.push(`${b.name} có sức chứa lớn hơn ${second.name} ${num(maxCap - next)} khách.`);
  }
  const located = columns.filter((c) => c.location);
  if (located.length === columns.length && located.some((c) => c.location!.same) && located.some((c) => !c.location!.same)) {
    summary.push(`${joinNames(located.filter((c) => c.location!.same).map((c) => c.name))} cùng khu vực với địa điểm tổ chức.`);
  }
  // Mọi bên đều cao hơn mức gợi ý: một dòng chung thay cho nhãn từng cột
  const allOver = columns.length > 0 && columns.every((c) => c.budget?.kind === 'OVER');
  const budgetNote = allOver
    ? `Cả ${num(columns.length)} bên đều cao hơn mức gợi ý ${vnd(round10k(ctx.budget!))}: ${columns.map((c) => `${c.name} cao hơn ${vnd(c.budget!.amount)}`).join(', ')}.`
    : null;

  // Dòng giống nhau ở mọi bên (số bàn tính phí, sức chứa): gộp thành một dòng "Giống nhau: …"
  const same = (texts: (string | null | undefined)[]) => texts.length > 1 && texts.every((t) => t && t === texts[0]);
  const sameTables = venue && same(columns.map((c) => (c.tables && !c.tables.warning ? `${c.tables.count}` : null)));
  const sameCapacity = venue && same(columns.map((c) => (c.capacity ? `${c.capacity.max}|${c.capacity.fits}` : null)));
  const sameParts = [
    sameTables && columns[0].tables?.count ? `${num(columns[0].tables.count)} bàn` : null,
    sameCapacity && columns[0].capacity
      ? ctx.guestCount !== null
        ? columns[0].capacity.fits
          ? `đủ cho ${num(ctx.guestCount)} khách`
          : `không đủ cho ${num(ctx.guestCount)} khách`
        : `tối đa ${num(columns[0].capacity.max)} khách`
      : null,
  ].filter(Boolean);
  const sameNote = sameParts.length ? `Giống nhau: ${sameParts.join(', ')}` : null;

  return {
    columns,
    summary,
    /** Một dòng chung khi mọi bên đều cao hơn mức gợi ý (FE hiện thay cho nhãn từng cột) */
    budgetNote,
    /** Tên dòng hệ quả: "Nếu đổi nhà cung cấp" khi đã cọc một bên, không thì "Nếu chọn gói này" */
    consequenceLabel: ctx.lockedBy ? 'Nếu đổi nhà cung cấp' : 'Nếu chọn gói này',
    /** Đã cọc một NCC của hạng mục: một cảnh báo chung ở đầu trang (thay cho lý do khóa nút lặp lại ở từng cột) */
    /** Ghi một lần dưới nhãn dòng Vị trí: "Nơi tổ chức: {phường/xã}" (các ô chỉ ghi phường/xã của NCC) */
    locationNote: ctx.weddingWard ? `Nơi tổ chức: ${shortWard(ctx.weddingWard)}` : null,
    lockNote: ctx.lockedBy
      ? `Bạn đã cọc ${ctx.lockedBy}${ctx.weddingDate ? ` cho ngày cưới ${dayMonth(ctx.weddingDate)}` : ''} nên chưa thêm được nhà cung cấp khác. Đổi nhà cung cấp có thể mất ${vnd(round10k(ctx.lockedDeposit ?? 0))} tiền cọc. Muốn đổi, hãy nhắn ${ctx.lockedBy} hoặc hủy đơn.`
      : null,
    /** Dòng gộp các tiêu chí giống nhau ở mọi bên ("Giống nhau: 30 bàn, đủ cho 300 khách"); các dòng đó ẩn đi */
    sameNote,
    /** Các dòng hiển thị: lịch khi có ngày cưới; số bàn và sức chứa chỉ có ở tiệc (ẩn khi đã gộp vào sameNote);
     *  so với ngân sách khi có ngân sách; hệ quả khi có tính được; vị trí khi có nơi tổ chức */
    rows: {
      availability: !!ctx.weddingDate,
      budget: ctx.budget !== null,
      consequence: columns.some((c) => c.consequence),
      tables: venue && !sameTables,
      location: !!ctx.weddingWard,
      capacity: venue && !sameCapacity,
    },
  };
}

export type CompareOutput = ReturnType<typeof compareServices>;
