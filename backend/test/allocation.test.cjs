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
const makeup = () => cat('trang-diem', [2, 3, 5].map((t) => pkg(t)));
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

test('1. 200tr, 300 khách, Cân bằng, chưa chọn gì: tổng gợi ý ≤ 200tr', () => {
  const r = a.allocate(input());
  assert.ok(plannedTotal(r) <= 200 * M, `tổng ${plannedTotal(r)}`);
  assert.ok(r.rows.every((x) => x.status === 'SUGGESTED' && x.suggestion));
  assert.ok(r.rows.every((x) => x.suggestion.label === null));
  assert.equal(row(r, 'nha-hang').cost, 150 * M);
  assert.ok(r.feasibility.ok);
});

test('2. đã chọn tiệc, đổi sang Ưu tiên hình ảnh: tiệc giữ nguyên, chỉ 5 dịch vụ chia lại', () => {
  const v = venue();
  const pv = [chosen(v, [V3])];
  const r1 = a.allocate(input({ categories: [v, decor(), photo(), dress(), makeup(), flower()], planVendors: pv }));
  const r2 = a.allocate(input({ categories: [v, decor(), photo(), dress(), makeup(), flower()], planVendors: pv, preset: 'VISUAL' }));
  assert.equal(row(r1, 'nha-hang').status, 'CHOSEN');
  assert.equal(row(r1, 'nha-hang').cost, row(r2, 'nha-hang').cost);
  assert.equal(row(r2, 'nha-hang').weight, null);
  assert.ok(row(r2, 'chup-anh').weight > row(r1, 'chup-anh').weight);
  assert.ok(plannedTotal(r2) <= 200 * M);
});

test('3. chọn trước trang trí 23tr và trang điểm 2tr: tiệc gợi ý theo Mục tiêu / Trần cứng mới, tổng ≤ 200tr', () => {
  const d = decor();
  const m = makeup();
  const r = a.allocate(input({ categories: [venue(), d, photo(), dress(), m, flower()], planVendors: [chosen(d, [d.packages[2]]), chosen(m, [m.packages[0]])] }));
  const v = row(r, 'nha-hang');
  // Còn lại 175; trung vị chụp ảnh 16 + trang phục 8 + hoa 4 = 28 → mục tiêu 147; giá rẻ nhất 8 + 5 + 2 = 15 → trần 160
  assert.equal(v.allocation, 147 * M);
  assert.equal(v.cap, 160 * M);
  assert.equal(v.cost, 120 * M);
  assert.ok(plannedTotal(r) <= 200 * M);
});

test('4. hạng mục không có gói ≤ phần chia: lấy gói rẻ nhất ≤ trần cứng, nhãn "vượt phân bổ", tổng vẫn ≤ ngân sách', () => {
  const r = a.allocate(input({ total: 60 * M, categories: [cat('chup-anh', [pkg(37), pkg(38)]), cat('decor', [pkg(10), pkg(65)])] }));
  const p = row(r, 'chup-anh');
  assert.equal(p.allocation, 30 * M);
  assert.deepEqual(p.suggestion.label, { code: 'OVER_ALLOCATION' });
  assert.equal(p.cost, 37 * M);
  assert.ok(plannedTotal(r) <= 60 * M);
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

test('7. bỏ một hạng mục: trọng số chuẩn hóa về 100%', () => {
  const r = a.allocate(input({ categories: [venue(), decor(), photo(), dress(), makeup()] }));
  const ws = r.rows.filter((x) => x.weight !== null).map((x) => x.weight);
  assert.equal(ws.length, 4);
  assert.ok(Math.abs(ws.reduce((s, w) => s + w, 0) - 1) < 1e-9);
});

test('8. tiệc đang tư vấn, tăng 30 → 35 bàn: báo thiếu đúng số kèm 3 hướng', () => {
  const v = venue();
  const r = a.allocate(input({ guestCount: 350, categories: [v, decor(), photo(), dress(), makeup(), flower()], planVendors: [chosen(v, [V3])] }));
  assert.equal(row(r, 'nha-hang').cost, 175 * M);
  // 175 + giá rẻ nhất 5 dịch vụ 27 = 202 → thiếu 2tr
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

test('10. gói rẻ nhất của một hạng mục bị ẩn: giá rẻ nhất cập nhật, tổng gợi ý vẫn ≤ ngân sách', () => {
  const d = decor();
  const before = a.allocate(input());
  const after = a.allocate(input({ categories: [venue(), cat('decor', d.packages.slice(1)), photo(), dress(), makeup(), flower()] }));
  assert.equal(row(before, 'decor').minPrice, 10 * M);
  assert.equal(row(after, 'decor').minPrice, 15 * M);
  assert.ok(plannedTotal(after) <= 200 * M);
});

test('11. NCC thêm nhiều gói đắt: trung vị tăng, hạng mục đã chọn giữ nguyên', () => {
  const v = venue();
  const pv = [chosen(v, [V3])];
  const r1 = a.allocate(input({ categories: [v, decor(), photo(), dress(), makeup(), flower()], planVendors: pv }));
  const pricey = cat('chup-anh', [8, 12, 20, 30, 60, 70, 80].map((t) => pkg(t)));
  const r2 = a.allocate(input({ categories: [v, decor(), pricey, dress(), makeup(), flower()], planVendors: pv }));
  assert.ok(row(r2, 'chup-anh').medianPrice > row(r1, 'chup-anh').medianPrice);
  assert.deepEqual(row(r2, 'nha-hang'), row(r1, 'nha-hang'));
  assert.ok(plannedTotal(r2) <= 200 * M);
});

test('12. hủy gói chụp ảnh đã cọc 1tr: không hoàn, 1tr vẫn trừ vào tổng, chụp ảnh trở về chưa chọn', () => {
  const p = photo();
  const r = a.allocate(input({ categories: [venue(), decor(), p, dress(), makeup(), flower()], planVendors: [chosen(p, [p.packages[1]], { cancelled: true, orderTotal: 12 * M, orderDeposited: 1 * M })], lostDeposits: 1 * M }));
  assert.equal(row(r, 'chup-anh').status, 'SUGGESTED');
  assert.equal(r.committed, 1 * M);
  assert.equal(r.lostDeposits, 1 * M);
  assert.ok(plannedTotal(r) <= 200 * M);
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
  assert.match(c.message, /^Chọn gói này, 1 dịch vụ còn lại còn tối đa .* thiếu /);
});

test('15. không còn gói tiệc nào ≤ trần cứng: gợi ý gói rẻ nhất kèm nhãn "vượt X đ"', () => {
  const r = a.allocate(input({ total: 100 * M }));
  const v = row(r, 'nha-hang');
  // Trần cứng = 100 − 27 = 73, gói rẻ nhất 90
  assert.equal(v.cost, 90 * M);
  assert.deepEqual(v.suggestion.label, { code: 'OVER_BY', amount: 17 * M });
});

test('16. gói tiệc vượt sức chứa bị loại, các gói khác không bị chặn theo ngân sách', () => {
  const r = a.allocate(input({ guestCount: 380, total: 50 * M }));
  const v = row(r, 'nha-hang');
  // 38 bàn: V1 = 114 (sức chứa 400), V2 sức chứa 350 bị loại
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
  assert.ok(plannedTotal(r) <= 200 * M);
  assert.equal(a.allocate(input({ ownVenue: true })).committed, 0);
});

test('18. ngân sách rất lớn: còn dư hiển thị đúng, không hạng mục nào bị vượt', () => {
  const r = a.allocate(input({ total: 10_000 * M }));
  assert.ok(r.leftover.amount > 0);
  assert.equal(r.leftover.amount, 10_000 * M - plannedTotal(r));
  assert.match(r.leftover.message, /^Còn dư /);
  assert.ok(r.rows.every((x) => x.suggestion.label === null));
});

test('19. giá rẻ nhất của tiệc không phụ thuộc khu vực, phụ thuộc sức chứa và số bàn', () => {
  const near = { ...V3, id: 'near', ward: 'Phường Cầu Giấy' };
  const cats = (g) => [cat('nha-hang', [V1, V2, near, V4]), decor()];
  const plain = a.allocate(input({ categories: cats() }));
  const withWard = a.allocate(input({ categories: cats(), ward: 'Phường Cầu Giấy' }));
  assert.equal(row(plain, 'nha-hang').minPrice, row(withWard, 'nha-hang').minPrice);
  // 450 khách = 45 bàn: V1 (400 chỗ), V2 (350 chỗ) bị loại → 5tr × 45 = 225tr
  const more = a.allocate(input({ categories: cats(), guestCount: 450 }));
  assert.equal(row(plain, 'nha-hang').minPrice, 90 * M);
  assert.equal(row(more, 'nha-hang').minPrice, 225 * M);
});

test('trung vị kiểu PERCENTILE_CONT(0.5)', () => {
  assert.equal(a.median([10, 15, 23, 35]), 19);
  assert.equal(a.median([2, 3, 5]), 3);
  assert.equal(a.median([]), null);
});

test('giới hạn riêng: chỉ còn Hoa cưới chưa chọn thì không nhận cả phần còn lại; tỷ lệ theo mức chia, không phải 100%', () => {
  const [v, d, p, dr, m, f] = all6();
  const pv = [chosen(v, [V3]), chosen(d, [d.packages[0]]), chosen(p, [p.packages[0]]), chosen(dr, [dr.packages[0]]), chosen(m, [m.packages[0]])];
  const r = a.allocate(input({ total: 350 * M, categories: [v, d, p, dr, m, f], planVendors: pv }));
  const fl = row(r, 'hoa-cuoi');
  // B3 vẫn dồn phần còn lại vào hạng mục cuối (thuật toán không đổi)
  assert.equal(fl.limit, r.remaining + fl.cost);
  assert.equal(fl.weight, 1);
  // Tỷ lệ theo mức chia trên mọi dịch vụ: trung vị hoa 4 / (19 + 16 + 8 + 3 + 4) = 8%
  assert.equal(Math.round(fl.share * 1000) / 10, 8);
  // Giới hạn riêng = (350 − 150 tiệc) × 8% = 16tr, khác phần còn lại của cả quỹ
  assert.equal(fl.shareLimit, 16 * M);
  assert.ok(fl.shareLimit < fl.limit);
  assert.ok(fl.shareLimit >= fl.cost);
  // Dịch vụ đã chọn cũng có giới hạn riêng (để so với chi phí đã chọn)
  assert.ok(row(r, 'decor').shareLimit > 0);
});

test('thanh kéo Tùy chỉnh: gồm cả dịch vụ đã chọn chưa cọc; đã cọc thì khóa (không có tỷ lệ), tiền chia trừ phần đã cọc', () => {
  const [v, d, p, dr, m, f] = all6();
  // Trang trí đã chọn (chưa cọc), trang phục đã cọc 15tr; đã lưu tỷ lệ cho chụp ảnh và hoa cưới
  const pv = [chosen(v, [V3]), chosen(d, [d.packages[0]]), chosen(dr, [dr.packages[2]], { orderTotal: 15 * M, orderDeposited: 3 * M })];
  const r = a.allocate(input({ categories: [v, d, p, dr, m, f], planVendors: pv, preset: 'CUSTOM', customWeights: { 'chup-anh': 80, 'hoa-cuoi': 20 } }));
  // Hạng mục chưa có tỷ lệ đã lưu (trang trí, trang điểm) nhận trung bình 50 rồi chuẩn hóa: 80 + 20 + 50 + 50 = 200
  assert.equal(row(r, 'decor').share, 0.25);
  assert.equal(row(r, 'chup-anh').share, 0.4);
  assert.equal(row(r, 'trang-phuc').share, null);
  const shares = ['decor', 'chup-anh', 'trang-diem', 'hoa-cuoi'].map((s) => row(r, s).share);
  assert.ok(Math.abs(shares.reduce((x, y) => x + y, 0) - 1) < 1e-9);
  // Tiền chia = 200 − tiệc 150 − trang phục đã cọc 15 = 35tr; giới hạn riêng = 35 × tỷ lệ
  assert.equal(r.sliderPool, 35 * M);
  assert.equal(row(r, 'chup-anh').shareLimit, 14 * M);
});

test('Tùy chỉnh khi chỉ còn 1 hạng mục: đặt số tiền tuyệt đối (tỷ lệ < 100%), phần còn lại không giao; giới hạn làm tròn 1.000đ', () => {
  const [v, d, p, dr, m, f] = all6();
  const pv = [chosen(v, [V3], { orderTotal: 150 * M, orderDeposited: 45 * M }), ...[d, p, dr, m].map((c) => chosen(c, [c.packages[0]], { orderTotal: c.packages[0].price, orderDeposited: 1 * M }))];
  // Chỉ còn hoa cưới chưa cọc; tiền chia = 200 − 150 − (10 + 8 + 5 + 2) = 25tr; đặt 20% = 5tr
  const r = a.allocate(input({ categories: [v, d, p, dr, m, f], planVendors: pv, preset: 'CUSTOM', customWeights: { 'hoa-cuoi': 20 } }));
  assert.equal(r.sliderPool, 25 * M);
  assert.equal(row(r, 'hoa-cuoi').share, 0.2);
  assert.equal(row(r, 'hoa-cuoi').shareLimit, 5 * M);
  // Làm tròn tới 1.000đ: 1/3 của 25tr
  const third = a.allocate(input({ categories: [v, d, p, dr, m, f], planVendors: pv, preset: 'CUSTOM', customWeights: { 'hoa-cuoi': 100 / 3 } }));
  assert.equal(third.rows.find((x) => x.slug === 'hoa-cuoi').shareLimit, 8_333_000);
});
