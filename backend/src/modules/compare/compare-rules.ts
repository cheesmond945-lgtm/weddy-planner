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

export interface CmpItem {
  id: string;
  name: string;
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
}

/** 232000000 → "232.000.000đ" (đầy đủ dấu chấm, không viết tắt "tr") */
export const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
const num = (n: number) => n.toLocaleString('vi-VN');
const shortWard = (w: string) => w.replace(/^(Phường|Xã) /, '');

export const isVenue = (slug: string) => slug === VENUE_SLUG;

/**
 * Tổng chi phí ước tính của một gói. Tiệc: đơn giá × max(số bàn, số bàn tối thiểu). Kế hoạch chưa có số khách thì giả định
 * theo số bàn tối thiểu; gói cũng không ghi tối thiểu thì không tính được (null). Hạng mục khác: giá gói.
 */
export function packageTotal(p: CmpPackage, slug: string, tables: number | null) {
  if (!isVenue(slug)) return { total: p.price, chargedTables: null as number | null, byMinimum: false, assumed: false };
  if (tables === null) {
    return p.minTables ? { total: p.price * p.minTables, chargedTables: p.minTables, byMinimum: true, assumed: true } : { total: null, chargedTables: null, byMinimum: false, assumed: true };
  }
  const charged = Math.max(tables, p.minTables ?? 0, 1);
  return { total: p.price * charged, chargedTables: charged, byMinimum: (p.minTables ?? 0) > tables, assumed: false };
}

/** Gói mặc định: gói rẻ nhất có tổng chi phí ≤ ngân sách hạng mục; không có thì gói rẻ nhất (so theo tổng chi phí) */
export function defaultPackage(item: CmpItem, ctx: CmpContext) {
  const sorted = [...item.packages].sort((a, b) => (packageTotal(a, ctx.slug, ctx.tables).total ?? a.price) - (packageTotal(b, ctx.slug, ctx.tables).total ?? b.price) || a.price - b.price || a.id.localeCompare(b.id));
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
    .map((x) => x.replace(/^[-–*+\s]+/, '').replace(/^(với|và|theo|gồm|có)\s+/i, '').replace(/\.$/, '').trim())
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
    const pkg = it.packages.find((p) => p.id === picked[it.id]) ?? defaultPackage(it, ctx);
    const cost = pkg ? packageTotal(pkg, ctx.slug, ctx.tables) : null;
    const total = cost?.total ?? null;

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

    // So với ngân sách hạng mục
    const budget =
      ctx.budget !== null && total !== null
        ? total < ctx.budget
          ? { kind: 'LEFT' as const, amount: ctx.budget - total, text: `Còn dư ${vnd(ctx.budget - total)}` }
          : total === ctx.budget
            ? { kind: 'EXACT' as const, amount: 0, text: 'Vừa đủ (còn 0đ)' }
            : { kind: 'OVER' as const, amount: total - ctx.budget, text: `Vượt ${vnd(total - ctx.budget)}` }
        : null;

    // Vị trí: chỉ so khi cả nơi tổ chức và NCC cùng xác định được phường/xã
    const location =
      ctx.weddingWard && it.ward
        ? it.ward === ctx.weddingWard
          ? { same: true, text: `Cùng ${shortWard(ctx.weddingWard)} với địa điểm tổ chức` }
          : { same: false, text: `Khác khu vực (${shortWard(it.ward)})` }
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
        .map((p) => ({ id: p.id, name: p.name, total: packageTotal(p, ctx.slug, ctx.tables).total }))
        .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity) || a.name.localeCompare(b.name, 'vi')),
      total,
      /** Công thức nhỏ dưới tổng: "40 × 5.800.000đ" (chỉ tiệc) */
      formula: venue && pkg && cost?.chargedTables ? `${num(cost.chargedTables)} × ${vnd(pkg.price)}` : null,
      assumption: cost?.assumed ? 'Tạm tính theo số bàn tối thiểu của gói vì kế hoạch chưa có số khách' : null,
      budget,
      tables,
      location,
      capacity,
      rating: { value: it.reviewCount > 0 ? it.rating : null, count: it.reviewCount, text: it.reviewCount > 0 && it.rating !== null ? `${it.rating.toLocaleString('vi-VN')}/5 từ ${num(it.reviewCount)} lượt` : 'Chưa có đánh giá' },
      includes: pkg ? includesOf(pkg.description, pkg.tags, [it.name, pkg.name]) : [],
      canAdd: fits,
      blockReason: fits ? null : `Gói này không đủ chỗ cho ${num(ctx.guestCount!)} khách. Hãy chọn gói khác.`,
      labels: { cheapest: false, largestCapacity: false, topRated: false },
    };
  });

  // Nhãn theo dòng, chỉ khi các bên khác nhau (hòa thì không gắn)
  const minTotal = uniqueBest(columns.map((c) => c.total), 'min');
  const maxCap = venue ? uniqueBest(columns.map((c) => c.capacity?.max ?? null), 'max') : null;
  const allRated = columns.every((c) => c.rating.count >= MIN_REVIEWS && c.rating.value !== null);
  const maxRating = allRated ? uniqueBest(columns.map((c) => c.rating.value), 'max') : null;
  for (const c of columns) {
    c.labels.cheapest = minTotal !== null && c.total === minTotal;
    c.labels.largestCapacity = maxCap !== null && c.capacity?.max === maxCap;
    c.labels.topRated = maxRating !== null && c.rating.value === maxRating;
  }

  // Dòng tóm tắt: chỉ nêu khác biệt, không khuyên chọn bên nào
  const summary: string[] = [];
  if (minTotal !== null) {
    const a = columns.find((c) => c.total === minTotal)!;
    const others = columns.filter((c) => c !== a).sort((x, y) => x.total! - y.total!);
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
  if (columns.every((c) => c.budget) && columns.some((c) => c.budget!.kind === 'OVER') && columns.some((c) => c.budget!.kind !== 'OVER')) {
    for (const c of columns.filter((x) => x.budget!.kind === 'OVER')) summary.push(`${c.name} vượt ngân sách hạng mục ${vnd(c.budget!.amount)}.`);
  }

  return {
    columns,
    summary,
    /** Các dòng hiển thị: số bàn và sức chứa chỉ có ở tiệc; so với ngân sách khi có ngân sách; vị trí khi có nơi tổ chức */
    rows: {
      budget: ctx.budget !== null,
      tables: venue,
      location: !!ctx.weddingWard,
      capacity: venue,
    },
  };
}

export type CompareOutput = ReturnType<typeof compareServices>;
