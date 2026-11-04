/* Phân bổ ngân sách và gợi ý gói (allocation.ts), mục 11 của đặc tả. Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const a = require('../dist/modules/weddings/allocation');

const M = 1_000_000;
let seq = 0;
const base = (price, extra = {}) => ({
  id: `p${++seq}`,
  vendorId: extra.vendorId ?? `v${seq}`,
  name: `Gói ${price / M}tr`,
  price,
  unit: 'gói',
  capacity: null,
  minTables: null,
  vendorName: `NCC ${seq}`,
  ward: null,
  rating: null,
  reviewCount: 0,
  styles: [],
  ...extra,
});
const pkg = (tr, extra) => base(tr * M, extra);
/** Gói tiệc: đơn giá/bàn (triệu), sức chứa, số bàn tối thiểu */
const hall = (perTable, capacity, minTables) => base(perTable * M, { unit: 'mâm', capacity, minTables });
const cat = (slug, packages) => ({ id: `c-${slug}`, slug, name: slug, packages });

// Dữ liệu chung: 300 khách = 30 bàn → tiệc 90, 120, 150, 232 (5,8tr × tối thiểu 40 bàn)
const V1 = hall(3, 400, 20);
const V2 = hall(4, 350, 25);
const V3 = hall(5, 500, 30);
const V4 = hall(5.8, 500, 40);
const venue = () => cat('nha-hang', [V1, V2, V3, V4]);
const decor = () => cat('decor', [10, 15, 23, 35].map((t) => pkg(t)));
const photo = () => cat('chup-anh', [8, 12, 20, 30].map((t) => pkg(t)));
const dress = () => cat('trang-phuc', [5, 8, 15].map((t) => pkg(t)));
const makeup = () => cat('makeup', [2, 3, 5].map((t) => pkg(t)));
const flower = () => cat('hoa-cuoi', [2, 4, 6].map((t) => pkg(t)));
const all6 = () => [venue(), decor(), photo(), dress(), makeup(), flower()];

const input = (over = {}) => ({ total: 200 * M, guestCount: 300, preset: 'BALANCED', ownVenue: false, categories: all6(), planVendors: [], ...over });

/** NCC đã chọn trong kế hoạch, mặc định gói đã chọn = gói đầu tiên của danh sách */
const chosen = (category, packages, over = {}) => ({
  vendorId: packages[0].vendorId,
  vendorName: 'Đã chọn',
  categoryId: category.id,
  slug: category.slug,
  selectedPackageId: packages[0].id,
  orderTotal: null,
  orderDeposited: null,
  packages,
  ...over,
});

const row = (r, slug) => r.rows.find((x) => x.slug === slug);
const plannedTotal = (r) => r.committed + r.suggestedTotal;

test('1. 200tr, 300 khách, Cân bằng, chưa chọn gì: tiệc trừ trước, quỹ dịch vụ chia theo trung vị, không gói nào vượt', () => {
  const r = a.allocate(input());
  // Giới hạn tiệc = 200 − Σ trung vị dịch vụ (19 + 16 + 8 + 3 + 4 = 50) = 150 → gói 150tr; quỹ dịch vụ 50tr
  assert.equal(row(r, 'nha-hang').cost, 150 * M);
  assert.equal(r.fund.serviceBudget, 50 * M);
  assert.deepEqual(
    ['decor', 'chup-anh', 'trang-phuc', 'makeup', 'hoa-cuoi'].map((s) => row(r, s).ratio),
    [3800, 3200, 1600, 600, 800],
  );
  assert.equal(row(r, 'decor').limit, 19 * M);
  assert.equal(row(r, 'decor').cost, 15 * M);
  assert.ok(plannedTotal(r) <= 200 * M);
  assert.ok(r.rows.every((x) => x.status === 'SUGGESTED' && x.suggestion && x.suggestion.label === null));
  assert.ok(r.feasibility.ok);
});

test('2. đã chọn tiệc, đổi sang Ưu tiên hình ảnh: tiệc giữ nguyên, chỉ dịch vụ chia lại', () => {
  const v = venue();
  const pv = [chosen(v, [V3])];
  const r1 = a.allocate(input({ categories: [v, decor(), photo(), dress(), makeup(), flower()], planVendors: pv }));
  const r2 = a.allocate(input({ categories: [v, decor(), photo(), dress(), makeup(), flower()], planVendors: pv, preset: 'VISUAL' }));
  assert.equal(row(r1, 'nha-hang').status, 'CHOSEN');
  assert.equal(row(r1, 'nha-hang').cost, row(r2, 'nha-hang').cost);
  assert.equal(row(r2, 'nha-hang').ratio, null);
  assert.ok(row(r2, 'chup-anh').ratio > row(r1, 'chup-anh').ratio);
  assert.equal(r2.fund.venue.status, 'CHOSEN');
});

test('3. chọn trước trang trí 23tr và trang điểm 2tr: giới hạn tiệc = còn lại − trung vị nhóm chia', () => {
  const d = decor();
  const m = makeup();
  const r = a.allocate(input({ categories: [venue(), d, photo(), dress(), m, flower()], planVendors: [chosen(d, [d.packages[2]]), chosen(m, [m.packages[0]])] }));
  const v = row(r, 'nha-hang');
  // Còn lại 175; trung vị chụp ảnh 16 + trang phục 8 + hoa 4 = 28 → giới hạn 147 → gói 120tr
  assert.equal(v.limit, 147 * M);
  assert.equal(v.cost, 120 * M);
  assert.equal(r.fund.serviceBudget, 55 * M);
});

test('4. hạng mục không có gói trong giới hạn: gói rẻ nhất kèm nhãn "Vượt Y", không chặn', () => {
  const r = a.allocate(input({ total: 60 * M, categories: [cat('chup-anh', [pkg(37), pkg(38)]), cat('decor', [pkg(10), pkg(65)])] }));
  const p = row(r, 'chup-anh');
  assert.equal(p.limit, 30 * M);
  assert.equal(p.cost, 37 * M);
  assert.deepEqual(p.suggestion.label, { code: 'OVER_BY', amount: 7 * M });
  assert.equal(row(r, 'decor').cost, 10 * M);
});

test('5. ngân sách không đủ tối thiểu: cảnh báo kèm 3 hướng, vẫn có gợi ý để đi tiếp', () => {
  const r = a.allocate(input({ total: 100 * M }));
  assert.equal(r.feasibility.ok, false);
  assert.equal(r.feasibility.minNeed, 117 * M);
  assert.equal(r.feasibility.shortfall, 17 * M);
  assert.equal(r.feasibility.options.length, 3);
  assert.match(r.feasibility.message, /cần tối thiểu 117\.000\.000đ/);
  assert.ok(r.rows.every((x) => x.suggestion));
});

test('6. giảm tổng xuống dưới tổng hạng mục đã chọn: "Vượt ngân sách X đ", không chặn', () => {
  const v = venue();
  const d = decor();
  const r = a.allocate(input({ total: 150 * M, categories: [v, d], planVendors: [chosen(v, [V3]), chosen(d, [d.packages[3]])] }));
  assert.equal(r.status, 'OVER_BUDGET');
  assert.equal(r.overBudget.amount, 35 * M);
  assert.equal(r.overBudget.message, 'Vượt ngân sách 35.000.000đ');
  assert.equal(r.overBudget.level, 'soft');
});

test('7. bỏ một hạng mục khỏi kế hoạch: tỷ lệ nhóm vẫn tổng 10000', () => {
  const r = a.allocate(input({ categories: [venue(), decor(), photo(), dress(), makeup()] }));
  const rs = r.rows.filter((x) => x.ratio !== null).map((x) => x.ratio);
  assert.equal(rs.length, 4);
  assert.equal(rs.reduce((s, x) => s + x, 0), 10000);
});

test('8. tiệc đang tư vấn, tăng 30 → 35 bàn: báo thiếu đúng số kèm 3 hướng', () => {
  const v = venue();
  const r = a.allocate(input({ guestCount: 350, categories: [v, decor(), photo(), dress(), makeup(), flower()], planVendors: [chosen(v, [V3])] }));
  assert.equal(row(r, 'nha-hang').cost, 175 * M);
  assert.equal(r.feasibility.shortfall, 2 * M);
  assert.equal(r.feasibility.options.length, 3);
});

test('9. tăng số khách vượt sức chứa trung tâm: đánh dấu "vượt sức chứa"', () => {
  const v = venue();
  const r = a.allocate(input({ guestCount: 600, categories: [v, decor()], planVendors: [chosen(v, [V3])] }));
  const vr = row(r, 'nha-hang');
  assert.equal(vr.chosen[0].overCapacity, true);
  assert.match(vr.message, /vượt sức chứa/);
});

test('12. hủy gói chụp ảnh đã cọc 1tr: không hoàn, 1tr vẫn trừ vào tổng, chụp ảnh quay lại nhóm chia', () => {
  const p = photo();
  const r = a.allocate(input({ categories: [venue(), decor(), p, dress(), makeup(), flower()], planVendors: [chosen(p, [p.packages[1]], { cancelled: true, orderTotal: 12 * M, orderDeposited: 1 * M })], lostDeposits: 1 * M }));
  assert.equal(row(r, 'chup-anh').status, 'SUGGESTED');
  assert.ok(row(r, 'chup-anh').ratio > 0);
  assert.equal(r.committed, 1 * M);
  assert.equal(r.fund.lostDeposit, 1 * M);
});

test('13. gói tiệc 5,8tr/bàn, tối thiểu 40 bàn, kế hoạch 30 bàn: chi phí 232tr (không phải 174tr)', () => {
  const v = cat('nha-hang', [V4]);
  assert.equal(a.costOf(V4, 30).cost, 232 * M);
  assert.equal(a.costOf(V4, 30).chargedTables, 40);
  const r = a.allocate(input({ categories: [v, decor(), photo(), dress(), makeup(), flower()] }));
  assert.equal(row(r, 'nha-hang').minPrice, 232 * M);
  assert.equal(row(r, 'nha-hang').cost, 232 * M);
  assert.equal(r.feasibility.minNeed, (232 + 27) * M);
});

test('14. chọn 4 dịch vụ đắt rồi chọn tiệc: không chặn, có hệ quả, "Vượt ngân sách"; thứ tự chọn không đổi kết quả', () => {
  const [v, d, p, dr, m, f] = all6();
  const services = [chosen(d, [d.packages[3]]), chosen(p, [p.packages[3]]), chosen(dr, [dr.packages[2]]), chosen(m, [m.packages[2]])];
  const venuePick = chosen(v, [V4]);
  const categories = [v, d, p, dr, m, f];
  const first = a.allocate(input({ categories, planVendors: [...services, venuePick] }));
  const later = a.allocate(input({ categories, planVendors: [venuePick, ...services.reverse()] }));
  assert.equal(first.committed, later.committed);
  assert.deepEqual(first.rows.map((x) => x.cost), later.rows.map((x) => x.cost));
  assert.equal(first.status, 'OVER_BUDGET');
  const c = a.consequenceOf(input({ categories, planVendors: services }), v.id, 232 * M);
  assert.equal(c.shortfall > 0, true);
  assert.match(c.message, /^Nếu chọn gói này, .*dịch vụ chưa chọn \(.+\).* thiếu .*Hãy chọn gói rẻ hơn hoặc tăng tổng ngân sách\.$/);
});

test('15. không gói tiệc nào trong giới hạn: gói rẻ nhất kèm "Vượt Y", quỹ dịch vụ trừ theo gói đó', () => {
  const r = a.allocate(input({ total: 100 * M }));
  const v = row(r, 'nha-hang');
  // Giới hạn = 100 − 50 = 50, gói rẻ nhất 90
  assert.equal(v.cost, 90 * M);
  assert.deepEqual(v.suggestion.label, { code: 'OVER_BY', amount: 40 * M });
  assert.equal(r.fund.venue.overBy, 40 * M);
  assert.equal(r.fund.serviceBudget, 10 * M);
});

test('16. gói tiệc vượt sức chứa bị loại, các gói khác không bị chặn theo ngân sách', () => {
  const r = a.allocate(input({ guestCount: 380, total: 50 * M }));
  const v = row(r, 'nha-hang');
  assert.equal(v.minPrice, 114 * M);
  assert.notEqual(v.suggestion.package.id, V2.id);
  assert.ok(r.rows.every((x) => x.suggestion));
});

test('17. OwnVenue: tiệc bị bỏ khỏi phép tính, chi phí tự lo trừ vào tổng', () => {
  const r = a.allocate(input({ ownVenue: true, ownVenueCost: 120 * M }));
  const v = row(r, 'nha-hang');
  assert.equal(v.status, 'OWN_VENUE');
  assert.equal(v.suggestion, null);
  assert.equal(r.committed, 120 * M);
  assert.equal(r.fund.venue.status, 'OWN');
  assert.equal(r.fund.serviceBudget, 80 * M);
  assert.equal(a.allocate(input({ ownVenue: true })).committed, 0);
});

test('19. giá rẻ nhất của tiệc không phụ thuộc khu vực, phụ thuộc sức chứa và số bàn', () => {
  const near = { ...V3, id: 'near', ward: 'Phường Cầu Giấy' };
  const cats = () => [cat('nha-hang', [V1, V2, near, V4]), decor()];
  const plain = a.allocate(input({ categories: cats() }));
  const withWard = a.allocate(input({ categories: cats(), ward: 'Phường Cầu Giấy' }));
  assert.equal(row(plain, 'nha-hang').minPrice, row(withWard, 'nha-hang').minPrice);
  const more = a.allocate(input({ categories: cats(), guestCount: 450 }));
  assert.equal(row(plain, 'nha-hang').minPrice, 90 * M);
  assert.equal(row(more, 'nha-hang').minPrice, 225 * M);
});

test('trung vị kiểu PERCENTILE_CONT(0.5)', () => {
  assert.equal(a.median([10, 15, 23, 35]), 19);
  assert.equal(a.median([2, 3, 5]), 3);
  assert.equal(a.median([]), null);
});

// ---------- Tài liệu triển khai Tùy chỉnh v1.2, mục 8.5 và 8.8 ----------

/** T27: tổng 350, đã chọn 40, ngoài nền tảng 2, tiệc chưa chọn với gói đề xuất 150 */
const t27 = (extra = 2 * M) => {
  const d = decor();
  const m = makeup();
  return input({
    total: 350 * M,
    extraCosts: extra,
    categories: [cat('nha-hang', [V3]), d, photo(), dress(), m, flower()],
    planVendors: [chosen(d, [d.packages[3]]), chosen(m, [m.packages[2]])],
  });
};

test('T27 quỹ dịch vụ = còn lại − gói tiệc đề xuất; T63 chi tiết quỹ; T62 dòng Tiệc', () => {
  const r = a.allocate(t27());
  assert.equal(r.fund.remaining, 308 * M);
  assert.equal(r.fund.serviceBudget, 158 * M);
  assert.deepEqual(
    { total: r.fund.totalBudget, selected: r.fund.selectedCost, lost: r.fund.lostDeposit, external: r.fund.externalCost },
    { total: 350 * M, selected: 40 * M, lost: 0, external: 2 * M },
  );
  assert.deepEqual(r.fund.venue, { status: 'SUGGESTED', amount: 150 * M, overBy: null });
});

test('T28 tiệc tự lo 100tr, ngoài nền tảng 2tr: quỹ 248tr', () => {
  const r = a.allocate(input({ total: 350 * M, ownVenue: true, ownVenueCost: 100 * M, extraCosts: 2 * M }));
  assert.equal(r.fund.serviceBudget, 248 * M);
});

test('T29 tiệc chưa chọn, không gói hợp lệ: quỹ = còn lại, tiệc chưa trừ', () => {
  const r = a.allocate(input({ guestCount: 900, total: 300 * M }));
  assert.equal(r.fund.venue.status, 'NO_PACKAGE');
  assert.equal(r.fund.venue.amount, null);
  assert.equal(r.fund.serviceBudget, 300 * M);
  assert.equal(row(r, 'nha-hang').message, 'Chưa có gói tiệc phù hợp cho 900 khách');
});

test('T30, T46 giới hạn gợi ý của hạng mục đã chọn không phụ thuộc gói đang chọn; T48 đã cọc thì không có', () => {
  const d = cat('decor', [pkg(10), pkg(20), pkg(30)]);
  const cats = () => [d, cat('chup-anh', [pkg(30)]), cat('makeup', [pkg(20)]), cat('hoa-cuoi', [pkg(20)])];
  const at = (p, over) => a.allocate(input({ total: 110 * M, categories: cats(), planVendors: [chosen(d, [p], over)] }));
  const r20 = at(d.packages[1]);
  assert.equal(r20.fund.serviceBudget, 90 * M);
  assert.equal(row(r20, 'decor').limit, 24_444_444);
  const r30 = at(d.packages[2]);
  assert.equal(r30.fund.serviceBudget, 80 * M);
  assert.equal(row(r30, 'decor').limit, 24_444_444);
  assert.equal(row(r30, 'decor').cost - row(r30, 'decor').limit, 5_555_556);
  assert.equal(row(at(d.packages[2], { orderTotal: 30 * M, orderDeposited: 9 * M }), 'decor').limit, null);
});

test('T31, T54 đổi tổng ngân sách / chi phí ngoài nền tảng: tỷ lệ giữ nguyên, tiền tính lại', () => {
  const a2 = a.allocate(t27(2 * M));
  const a12 = a.allocate(t27(12 * M));
  assert.equal(a12.fund.serviceBudget, 148 * M);
  assert.deepEqual(a12.rows.map((x) => x.ratio), a2.rows.map((x) => x.ratio));
  const ca = row(a12, 'chup-anh');
  assert.equal(ca.limit, Math.round((148 * M * ca.ratio) / 10000));
});

test('T55 chi phí ngoài nền tảng làm quỹ âm: quỹ 0, tỷ lệ vẫn tổng 100', () => {
  const r = a.allocate(t27(250 * M));
  assert.equal(r.fund.serviceBudgetRaw, -90 * M);
  assert.equal(r.fund.serviceBudget, 0);
  assert.equal(r.rows.filter((x) => x.ratio !== null).reduce((s, x) => s + x.ratio, 0), 10000);
  assert.ok(r.rows.filter((x) => x.ratio !== null).every((x) => x.limit === 0));
});

test('T61 tăng chi phí ngoài nền tảng làm gói tiệc đề xuất đổi: quỹ đổi theo gói mới', () => {
  const r0 = a.allocate(input());
  const r30 = a.allocate(input({ extraCosts: 30 * M }));
  assert.equal(r0.fund.venue.amount, 150 * M);
  assert.equal(r30.fund.venue.amount, 120 * M);
  assert.equal(r30.fund.serviceBudget, 50 * M);
});

// ---------- Tùy chỉnh: cấu hình đã lưu ----------

const split = (items, over = {}) => ({ baseMode: 'BALANCED', excluded: [], capAmount: null, items, ...over });
const it = (category, ratio, locked = false) => ({ id: category.id, slug: category.slug, ratio, locked });

test('Tùy chỉnh: dùng tỷ lệ đã lưu, bỏ khỏi phần chia thì không có tỷ lệ, ngân sách hay gợi ý gói', () => {
  const [v, d, p, dr, m, f] = all6();
  const saved = split([it(d, 4000), it(dr, 2000, true), it(m, 1000), it(f, 3000)], { excluded: [p.id] });
  const r = a.allocate(input({ categories: [v, d, p, dr, m, f], preset: 'CUSTOM', split: saved }));
  assert.equal(r.split.changed, false);
  assert.equal(row(r, 'chup-anh').status, 'EXCLUDED');
  assert.equal(row(r, 'chup-anh').limit, null);
  assert.equal(row(r, 'chup-anh').suggestion, null);
  assert.equal(row(r, 'decor').ratio, 4000);
  assert.equal(row(r, 'decor').limit, Math.round((r.fund.serviceBudget * 4000) / 10000));
  // Hạng mục bị bỏ không tính vào trung vị của giới hạn tiệc: 200 − (19 + 8 + 3 + 4) = 166 → gói 150
  assert.equal(row(r, 'nha-hang').limit, 166 * M);
});

test('Tùy chỉnh: hạng mục mở khóa cuối được chọn gói thì mở khóa hạng mục lớn nhất (T22), cấu hình cần lưu lại', () => {
  const [v, d, p, dr, m, f] = all6();
  const saved = split([it(d, 3000, true), it(p, 2500, true), it(dr, 2000, true), it(m, 1500, true), it(f, 1000)]);
  const r = a.allocate(input({ categories: [v, d, p, dr, m, f], preset: 'CUSTOM', split: saved, planVendors: [chosen(f, [f.packages[0]])] }));
  assert.equal(r.split.changed, true);
  assert.deepEqual(r.split.unlocked, [d.id]);
  assert.equal(row(r, 'decor').ratio, 4000);
  assert.equal(r.split.state.items.find((x) => x.id === d.id).locked, false);
});

test('Tùy chỉnh: hạng mục đã bỏ được chọn gói thì rời danh sách bỏ khỏi phần chia', () => {
  const [v, d, p, dr, m, f] = all6();
  const saved = split([it(d, 4000), it(dr, 2000), it(m, 1000), it(f, 3000)], { excluded: [p.id] });
  const r = a.allocate(input({ categories: [v, d, p, dr, m, f], preset: 'CUSTOM', split: saved, planVendors: [chosen(p, [p.packages[0]])] }));
  assert.equal(row(r, 'chup-anh').status, 'CHOSEN');
  assert.deepEqual(r.split.state.excluded, []);
  assert.equal(r.split.changed, true);
});

test('T42 nhóm còn một hạng mục, giá trần 15tr trên quỹ 20tr: Còn dư 5tr', () => {
  const [d, p, dr, m, f] = [decor(), photo(), dress(), makeup(), cat('hoa-cuoi', [pkg(6)])];
  const pv = [d, p, dr, m].map((c) => chosen(c, [c.packages[0]]));
  // Đã chọn 10 + 8 + 5 + 2 = 25 → quỹ 20 khi tổng 45
  const r = a.allocate(input({ total: 45 * M, categories: [d, p, dr, m, f], planVendors: pv, preset: 'CUSTOM', split: split([it(f, 10000)], { capAmount: 15 * M }) }));
  assert.equal(r.fund.serviceBudget, 20 * M);
  assert.equal(row(r, 'hoa-cuoi').limit, 15 * M);
  assert.equal(r.leftover.amount, 5 * M);
});

test('nhóm rỗng: cả quỹ là "Còn dư"', () => {
  const [d, p] = [decor(), photo()];
  const r = a.allocate(input({ total: 100 * M, categories: [d, p], planVendors: [chosen(d, [d.packages[0]]), chosen(p, [p.packages[0]])] }));
  assert.equal(r.leftover.amount, 82 * M);
  assert.match(r.leftover.message, /^Còn dư /);
});

test('Tùy chỉnh chưa có cấu hình (dữ liệu cũ): khởi tạo theo Cân bằng và đánh dấu cần lưu', () => {
  const r = a.allocate(input({ preset: 'CUSTOM' }));
  assert.equal(r.split.changed, true);
  assert.equal(r.split.baseMode, 'BALANCED');
  assert.equal(row(r, 'decor').ratio, 3800);
});

test('kế hoạch không có trung tâm tiệc: quỹ không trừ tiệc (NONE); tự lo tiệc thì vẫn trừ và hiện OWN', () => {
  const none = a.allocate(input({ categories: [decor(), photo()] }));
  assert.equal(none.fund.venue.status, 'NONE');
  assert.equal(none.fund.serviceBudget, 200 * M);
  const own = a.allocate(input({ categories: [decor(), photo()], ownVenue: true, ownVenueCost: 120 * M }));
  assert.deepEqual(own.fund.venue, { status: 'OWN', amount: 120 * M, overBy: null });
  assert.equal(own.fund.serviceBudget, 80 * M);
});
