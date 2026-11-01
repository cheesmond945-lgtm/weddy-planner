/* Hàm tính ngân sách theo giá gói và mức chi (budget-engine.ts). Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const e = require('../dist/modules/weddings/budget-engine');

const M = 1_000_000;
let seq = 0;
/** Gói trọn gói */
const pkg = (price, extra = {}) => ({ id: `p${++seq}`, vendorId: extra.vendorId ?? `v${seq}`, name: `Gói ${price / M}tr`, price, unit: 'gói', capacity: null, minTables: null, ...extra });
/** Gói nhà hàng tính theo mâm */
const hall = (pricePerTable, capacity, minTables = null, extra = {}) => pkg(pricePerTable, { unit: 'mâm', capacity, minTables, ...extra });

const cat = (id, slug, packages) => ({ id, slug, name: slug, packages });

const input = (over = {}) => ({
  total: 150 * M,
  guestCount: 250,
  tableOverride: null,
  tier: 'AUTO',
  extraCosts: 0,
  categories: [],
  manual: new Map(),
  planVendors: [],
  ...over,
});

// Ví dụ đối chiếu trong đặc tả: 250 khách, nhà hàng 5 gói, chụp ảnh 4 gói, 150 triệu
const venue = cat('c-venue', 'nha-hang', [85, 105, 127, 150, 210].map((t) => pkg(t * M, { capacity: 300 })));
const photo = cat('c-photo', 'chup-anh', [10, 18, 30, 45].map((t) => pkg(t * M)));

test('ví dụ đối chiếu: AUTO ra Cân đối, nhà hàng 127tr, chụp ảnh 18tr, tổng 145tr, còn dư 5tr', () => {
  const r = e.computeBudget(input({ categories: [venue, photo] }));
  assert.equal(r.effectiveTier, 'BALANCED');
  assert.deepEqual(r.categories.map((c) => c.budget), [127 * M, 18 * M]);
  assert.equal(r.totals.allocated, 145 * M);
  assert.equal(r.totals.unallocated, 5 * M);
  assert.equal(r.categories[0].reason, 'Theo giá gói mức Cân đối');
  assert.equal(r.warnings.length, 0);
});

test('phân vị nearest-rank với 1, 2, 3 và nhiều gói', () => {
  assert.equal(e.nearestRank([10], 0.2), 10);
  assert.equal(e.nearestRank([10], 0.75), 10);
  assert.deepEqual([0.2, 0.45, 0.75].map((p) => e.nearestRank([10, 20], p)), [10, 10, 20]);
  assert.deepEqual([0.2, 0.45, 0.75].map((p) => e.nearestRank([10, 20, 30], p)), [10, 20, 30]);
  assert.deepEqual([0.2, 0.45, 0.75].map((p) => e.nearestRank([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], p)), [2, 5, 8]);
  assert.equal(e.nearestRank([], 0.5), null);
});

test('hạng mục không có gói: dùng tỷ lệ cố định chuẩn hóa theo các hạng mục khách chọn', () => {
  // nhà hàng 0,4 và decor 0,12 cùng không có gói: decor = 150tr × 0,12 / 0,52
  const r = e.computeBudget(input({ categories: [cat('a', 'nha-hang', []), cat('b', 'decor', [])] }));
  assert.equal(r.categories[1].budget, e.roundBudget((150 * M * 0.12) / 0.52));
  assert.equal(r.categories[1].source, 'FALLBACK');
  assert.match(r.categories[1].reason, /tỷ lệ/);
});

test('nhà hàng: loại sảnh không đủ chỗ; không sảnh nào đủ thì về tỷ lệ', () => {
  const v = cat('c', 'nha-hang', [hall(4 * M, 200), hall(5 * M, 300), hall(6 * M, 400)]);
  const s = e.suggestAll(input({ categories: [v] }), 'SAVING').get('c');
  // 250 khách = 25 mâm; sảnh 200 bị loại, còn 125tr và 150tr; SAVING lấy phần tử đầu
  assert.deepEqual([s.amount, s.packageCount], [125 * M, 2]);
  const none = e.suggestAll(input({ guestCount: 500, categories: [v] }), 'SAVING').get('c');
  assert.equal(none.source, 'FALLBACK');
});

test('chi phí gói theo mâm: số mâm tự tính, ghi đè số mâm, số mâm tối thiểu', () => {
  const h = hall(5 * M, 400, 30);
  assert.equal(e.tableCount(250, null), 25);
  assert.equal(e.tableCount(251, null), 26);
  assert.equal(e.tableCount(250, 40), 40);
  assert.equal(e.packageCost(h, 25), 150 * M); // tối thiểu 30 mâm
  assert.equal(e.packageCost(h, 40), 200 * M);
  assert.equal(e.packageCost(pkg(9 * M), 40), 9 * M);
  const r = e.computeBudget(input({ tableOverride: 40, categories: [cat('c', 'nha-hang', [hall(5 * M, 400)])] }));
  assert.equal(r.tables.count, 40);
  assert.equal(r.categories[0].suggested, 200 * M);
});

test('ngân sách thấp hơn mức Tiết kiệm: dùng Tiết kiệm và cảnh báo', () => {
  const r = e.computeBudget(input({ total: 80 * M, categories: [venue, photo] }));
  assert.equal(r.effectiveTier, 'SAVING');
  // SAVING: nhà hàng 85tr + chụp ảnh 10tr = 95tr, thiếu 15tr
  assert.equal(r.warnings[0].code, 'BELOW_SAVING');
  assert.equal(r.warnings[0].amount, 15 * M);
  assert.match(r.warnings[0].message, /thấp hơn mức Tiết kiệm khoảng 15\.000\.000đ/);
});

test('AUTO ở sát ngưỡng: bằng đúng tổng thì lấy, thiếu 1 đồng thì xuống mức', () => {
  // PREMIUM = 150 + 30 = 180tr
  assert.equal(e.computeBudget(input({ total: 180 * M, categories: [venue, photo] })).effectiveTier, 'PREMIUM');
  assert.equal(e.computeBudget(input({ total: 180 * M - 1, categories: [venue, photo] })).effectiveTier, 'BALANCED');
  // Chi phí khác trừ vào phần dùng để chọn mức
  assert.equal(e.computeBudget(input({ total: 180 * M, extraCosts: 1, categories: [venue, photo] })).effectiveTier, 'BALANCED');
});

test('chọn tay mức Cao cấp vượt ngân sách: giữ mức và cảnh báo', () => {
  const r = e.computeBudget(input({ tier: 'PREMIUM', categories: [venue, photo] }));
  assert.equal(r.effectiveTier, 'PREMIUM');
  assert.equal(r.warnings[0].code, 'TIER_OVER_BUDGET');
  assert.match(r.warnings[0].message, /Mức Cao cấp cần khoảng 180\.000\.000đ, ngân sách của bạn là 150\.000\.000đ/);
});

test('sửa tay giữ nguyên khi đổi mức chi và đổi tổng ngân sách', () => {
  const manual = new Map([['c-photo', 25 * M]]);
  for (const over of [{ tier: 'SAVING' }, { tier: 'PREMIUM' }, { total: 300 * M }]) {
    const r = e.computeBudget(input({ categories: [venue, photo], manual, ...over }));
    assert.equal(r.categories[1].budget, 25 * M);
    assert.equal(r.categories[1].manual, true);
    assert.equal(r.categories[1].reason, 'Bạn đã sửa');
    assert.equal(r.categories[0].manual, false);
  }
});

test('cân đối: chỉ co ô chưa sửa; mẫu số 0 và k ≤ 0 báo lỗi', () => {
  const base = input({ total: 120 * M, extraCosts: 5 * M, categories: [venue, photo], manual: new Map([['c-photo', 15 * M]]) });
  const r = e.computeBudget(base);
  // ô nhà hàng chưa sửa: k = (120 - 15 - 5) / 85 (mức SAVING)
  const next = e.rebalance(r, base.total, base.extraCosts);
  assert.deepEqual([...next], [['c-venue', 100 * M]]);
  const allManual = e.computeBudget({ ...base, manual: new Map([['c-photo', 15 * M], ['c-venue', 90 * M]]) });
  assert.throws(() => e.rebalance(allManual, base.total, base.extraCosts), { code: 'REBALANCE_NOTHING_TO_SCALE' });
  const over = e.computeBudget({ ...base, manual: new Map([['c-photo', 130 * M]]) });
  assert.throws(() => e.rebalance(over, base.total, base.extraCosts), { code: 'REBALANCE_MANUAL_OVER_BUDGET', message: 'Các ô bạn sửa đã vượt tổng ngân sách.' });
});

test('chi phí khác: trừ vào còn lại, tách khỏi ngân sách đã chia và chi phí theo gói', () => {
  const v1 = pkg(18 * M, { vendorId: 'ncc-anh' });
  const r = e.computeBudget(
    input({
      extraCosts: 3 * M,
      categories: [venue, photo],
      planVendors: [{ vendorId: 'ncc-anh', categoryId: 'c-photo', slug: 'chup-anh', selectedPackageId: null, orderTotal: null, packages: [v1, pkg(30 * M, { vendorId: 'ncc-anh' })] }],
    }),
  );
  assert.equal(r.totals.packagesCost, 18 * M);
  assert.equal(r.totals.remaining, 150 * M - 18 * M - 3 * M);
  assert.equal(r.totals.allocated, r.categories.reduce((s, c) => s + c.budget, 0));
});

test('chi phí theo gói cùng phạm vi với ngân sách đã chia: bỏ nhà cung cấp thuộc hạng mục không có ô ngân sách', () => {
  const r = e.computeBudget(
    input({
      categories: [photo],
      planVendors: [
        { vendorId: 'ncc-anh', categoryId: 'c-photo', slug: 'chup-anh', selectedPackageId: null, orderTotal: null, packages: [pkg(18 * M, { vendorId: 'ncc-anh' })] },
        { vendorId: 'ncc-nh', categoryId: 'c-venue', slug: 'nha-hang', selectedPackageId: null, orderTotal: 90 * M, packages: [] },
      ],
    }),
  );
  assert.equal(r.totals.packagesCost, 18 * M);
  assert.equal(r.totals.remaining, 150 * M - 18 * M);
});

test('gói dự kiến: lớn nhất không vượt ngân sách hạng mục, không gói nào vừa thì rẻ nhất', () => {
  const ps = [pkg(10 * M), pkg(18 * M), pkg(30 * M)];
  assert.equal(e.plannedPackage(ps, 'chup-anh', 250, 25, 20 * M).cost, 18 * M);
  assert.equal(e.plannedPackage(ps, 'chup-anh', 250, 25, 5 * M).cost, 10 * M);
  assert.equal(e.plannedPackage(ps, 'chup-anh', 250, 25, null).cost, 10 * M);
  // Nhà hàng: chỉ xét sảnh đủ chỗ
  const halls = [hall(4 * M, 200), hall(5 * M, 300), hall(7 * M, 300)];
  assert.equal(e.plannedPackage(halls, 'nha-hang', 250, 25, 200 * M).cost, 175 * M);
  assert.equal(e.plannedPackage(halls, 'nha-hang', 250, 25, 110 * M).cost, 125 * M);
});

test('gói đã chọn bị ẩn sau khi chọn: về gói dự kiến và gắn cờ', () => {
  const ps = [pkg(10 * M, { vendorId: 'x' }), pkg(18 * M, { vendorId: 'x' })];
  const pv = { vendorId: 'x', categoryId: 'c-photo', slug: 'chup-anh', orderTotal: null, packages: ps };
  const chosen = e.computeBudget(input({ categories: [venue, photo], planVendors: [{ ...pv, selectedPackageId: ps[0].id }] })).vendors[0];
  assert.deepEqual([chosen.packageSource, chosen.cost], ['SELECTED', 10 * M]);
  const gone = e.computeBudget(input({ categories: [venue, photo], planVendors: [{ ...pv, selectedPackageId: 'p-da-an' }] }));
  assert.deepEqual([gone.vendors[0].packageSource, gone.vendors[0].cost, gone.vendors[0].packageUnavailable], ['PLANNED', 18 * M, true]);
  assert.ok(gone.warnings.some((w) => w.code === 'PACKAGE_UNAVAILABLE'));
});

test('có đơn thì lấy tổng đơn, bỏ qua gói dự kiến và gói đã chọn', () => {
  const ps = [pkg(10 * M, { vendorId: 'x' }), pkg(18 * M, { vendorId: 'x' })];
  const r = e.computeBudget(input({ categories: [venue, photo], planVendors: [{ vendorId: 'x', categoryId: 'c-photo', slug: 'chup-anh', selectedPackageId: ps[0].id, orderTotal: 22 * M, packages: ps }] }));
  assert.deepEqual([r.vendors[0].packageSource, r.vendors[0].cost], ['ORDER', 22 * M]);
});

test('chỉ tính hạng mục khách chọn: thêm hạng mục thì tính lại', () => {
  const one = e.computeBudget(input({ categories: [photo] }));
  assert.equal(one.categories.length, 1);
  // Chỉ chụp ảnh: PREMIUM 30tr vừa ngân sách
  assert.equal(one.effectiveTier, 'PREMIUM');
  const two = e.computeBudget(input({ categories: [venue, photo] }));
  assert.equal(two.categories.length, 2);
  assert.equal(two.effectiveTier, 'BALANCED');
});
