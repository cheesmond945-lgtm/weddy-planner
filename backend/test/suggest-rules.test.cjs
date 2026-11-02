/* "Gợi ý cho bạn": hàm thuần lọc, xếp hạng, sinh lý do (suggest-rules.ts). Không cần DB. Chạy: npm test (build rồi chạy trên dist). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const r = require('../dist/modules/weddings/suggest-rules');
const { SUGGESTION_COUNT, MIN_REVIEWS } = require('../dist/modules/weddings/suggest.config');

const pkg = (id, vendorId, price, extra = {}) => ({ id, vendorId, name: `Gói ${id}`, price, unit: 'gói', capacity: null, minTables: null, ...extra });
const table = (id, vendorId, price, minTables, capacity = 1000) => pkg(id, vendorId, price, { unit: 'mâm', minTables, capacity });

const vendor = (id, packages, extra = {}) => ({
  id,
  name: `NCC ${id}`,
  city: 'Hà Nội',
  ward: null,
  packages,
  rating: 4.8,
  reviewCount: 10,
  styles: [],
  inPlan: false,
  ...extra,
});

const ctx = (extra = {}) => ({ slug: 'decor', categoryName: 'Trang trí', city: 'Hà Nội', ward: null, guestCount: 300, tables: 30, budget: 20_000_000, styles: [], ...extra });
const venueCtx = (extra = {}) => ctx({ slug: 'nha-hang', categoryName: 'Trung tâm tổ chức sự kiện', budget: 200_000_000, ...extra });

const suggest = (vendors, c) => r.rankSuggestions(r.hardFilter(vendors, c).passed, c).slice(0, SUGGESTION_COUNT);

test('nhà hàng có số bàn tối thiểu cao hơn dự kiến: tính theo số tối thiểu và có cảnh báo', () => {
  const c = venueCtx({ tables: 30 });
  const v = vendor('a', [table('p1', 'a', 5_000_000, 40)]);
  const est = r.estimateCost(v.packages, c.slug, c.guestCount, c.tables);
  assert.equal(est.chargedTables, 40);
  assert.equal(est.cost, 200_000_000);
  assert.equal(est.extraTables, 10);
  const [s] = suggest([v], c);
  const copy = r.buildReasons(s, c);
  assert.deepEqual(copy.reasons, ['4.8/5 từ 10 lượt']);
  assert.equal(copy.warning, 'Gói này tối thiểu 40 bàn, nhiều hơn dự kiến 10 bàn');
});

test('nhà hàng: lọc ngân sách theo tổng chi phí, không theo đơn giá', () => {
  // Đơn giá rẻ hơn nhưng tối thiểu 60 bàn: 4tr × 60 = 240tr > 200tr; gói 5,5tr × 30 = 165tr vẫn trong ngân sách
  const c = venueCtx({ tables: 30 });
  const res = r.hardFilter([vendor('re', [table('x', 're', 4_000_000, 60)]), vendor('dat', [table('y', 'dat', 5_500_000, 20)])], c);
  assert.deepEqual(res.passed.map((v) => v.id), ['dat']);
  assert.deepEqual(res.overBudget.map((v) => v.id), ['re']);
});

test('nhà hàng: chi phí ước tính là gói rẻ nhất trong các gói đủ chỗ; không sảnh nào đủ chỗ thì loại', () => {
  const c = venueCtx({ guestCount: 300, tables: 30 });
  const est = r.estimateCost([table('nho', 'a', 3_000_000, 10, 200), table('vua', 'a', 5_000_000, 20, 400), table('lon', 'a', 4_500_000, 50, 800)], c.slug, c.guestCount, c.tables);
  assert.equal(est.package.id, 'vua'); // 5tr × 30 = 150tr < 4,5tr × 50 = 225tr; sảnh 200 khách không đủ chỗ
  const res = r.hardFilter([vendor('chat', [table('z', 'chat', 3_000_000, 10, 200)])], c);
  assert.equal(res.passed.length, 0);
  assert.equal(res.noCapacity, 1);
});

test('dịch vụ ít đánh giá: không bị loại, chỉ gắn nhãn "Ít đánh giá"', () => {
  const c = ctx();
  const few = vendor('few', [pkg('p', 'few', 10_000_000)], { rating: 5, reviewCount: MIN_REVIEWS - 1 });
  const none = vendor('none', [pkg('q', 'none', 10_000_000)], { rating: null, reviewCount: 0 });
  const out = suggest([few, none], c);
  assert.equal(out.length, 2);
  for (const s of out) {
    const copy = r.buildReasons(s, c);
    assert.equal(copy.fewReviews, true);
    assert.deepEqual(copy.reasons, []); // không ghi "Ít đánh giá" trên thẻ
  }
  const enough = r.buildReasons(r.hardFilter([vendor('ok', [pkg('o', 'ok', 10_000_000)], { rating: 4.5, reviewCount: 12 })], c).passed[0], c);
  assert.equal(enough.fewReviews, false);
  assert.deepEqual(enough.reasons, ['4.5/5 từ 12 lượt']);
});

test('danh sách rỗng: không có gợi ý', () => {
  assert.deepEqual(suggest([], ctx()), []);
  const res = r.hardFilter([], ctx());
  assert.equal(res.passed.length + res.overBudget.length + res.noCapacity, 0);
});

test('đúng 3 kết quả khi có nhiều hơn 3 dịch vụ phù hợp', () => {
  const vendors = ['a', 'b', 'c', 'd', 'e'].map((id, i) => vendor(id, [pkg(id, id, 10_000_000 + i * 1_000_000)]));
  assert.equal(suggest(vendors, ctx()).length, 3);
});

test('ít hơn 3 kết quả: chỉ trả số dịch vụ phù hợp, dịch vụ vượt ngân sách nằm riêng', () => {
  const c = ctx({ budget: 15_000_000 });
  const res = r.hardFilter([vendor('a', [pkg('a', 'a', 12_000_000)]), vendor('b', [pkg('b', 'b', 30_000_000)])], c);
  assert.equal(suggest([vendor('a', [pkg('a', 'a', 12_000_000)]), vendor('b', [pkg('b', 'b', 30_000_000)])], c).length, 1);
  assert.equal(res.overBudget.length, 1);
});

test('lọc cứng: khác tỉnh/thành và đã có trong kế hoạch thì loại', () => {
  const res = r.hardFilter(
    [vendor('hcm', [pkg('h', 'hcm', 1)], { city: 'TP. Hồ Chí Minh' }), vendor('plan', [pkg('p', 'plan', 1)], { inPlan: true }), vendor('ok', [pkg('o', 'ok', 1)])],
    ctx(),
  );
  assert.deepEqual(res.passed.map((v) => v.id), ['ok']);
});

test('đám cưới có phường/xã: cùng phường xếp trước và lý do ghi rõ phường', () => {
  const c = ctx({ ward: 'Phường Cầu Giấy' });
  const near = vendor('near', [pkg('n', 'near', 5_000_000)], { ward: 'Cầu Giấy' }); // xa ngân sách hơn
  const far = vendor('far', [pkg('f', 'far', 19_000_000)], { ward: 'Đống Đa' }); // sát ngân sách hơn
  const out = suggest([far, near], c);
  assert.deepEqual(out.map((v) => v.id), ['near', 'far']);
  // Không ghi "cùng khu vực" / "cùng phường" trên thẻ: căn cứ chung nằm ở dòng tiêu đề
  assert.ok(out.every((v) => !r.buildReasons(v, c).reasons.some((x) => /khu vực|phường/i.test(x))));
});

test('đám cưới không có phường/xã: bỏ bước địa điểm, lý do ghi "Cùng khu vực tổ chức"', () => {
  const c = ctx({ ward: null });
  const out = suggest([vendor('near', [pkg('n', 'near', 5_000_000)], { ward: 'Cầu Giấy' }), vendor('far', [pkg('f', 'far', 19_000_000)], { ward: 'Đống Đa' })], c);
  assert.deepEqual(out.map((v) => v.id), ['far', 'near']); // chỉ còn xếp theo mức khớp ngân sách
});

test('hai dịch vụ cùng phường khác chi phí: chi phí gần ngân sách hơn xếp trước (CLOSEST), CHEAPEST thì ngược lại', () => {
  const c = ctx({ ward: 'Phường Đống Đa', budget: 20_000_000 });
  const cheap = vendor('cheap', [pkg('c', 'cheap', 8_000_000)], { ward: 'Đống Đa' });
  const close = vendor('close', [pkg('k', 'close', 18_000_000)], { ward: 'Đống Đa' });
  const passed = r.hardFilter([cheap, close], c).passed;
  assert.deepEqual(r.rankSuggestions(passed, c, 'CLOSEST').map((v) => v.id), ['close', 'cheap']);
  assert.deepEqual(r.rankSuggestions(passed, c, 'CHEAPEST').map((v) => v.id), ['cheap', 'close']);
});

test('hai dịch vụ khác phường nhưng một bên sát ngân sách hơn: địa điểm vẫn ưu tiên trước ngân sách', () => {
  const c = ctx({ ward: 'Phường Tây Hồ', budget: 20_000_000 });
  const sameWardFar = vendor('same', [pkg('s', 'same', 6_000_000)], { ward: 'Tây Hồ' });
  const otherWardClose = vendor('other', [pkg('o', 'other', 19_500_000)], { ward: 'Long Biên' });
  assert.deepEqual(suggest([otherWardClose, sameWardFar], c).map((v) => v.id), ['same', 'other']);
});

test('cùng chi phí: điểm đánh giá cao hơn trước, rồi số lượt đánh giá; chưa có đánh giá xếp sau', () => {
  const c = ctx();
  const mk = (id, rating, reviewCount) => vendor(id, [pkg(id, id, 10_000_000)], { rating, reviewCount });
  assert.deepEqual(suggest([mk('none', null, 0), mk('low', 4, 50), mk('hi-few', 5, 4), mk('hi-many', 5, 9)], ctx()).map((v) => v.id), ['hi-many', 'hi-few', 'low']);
});

test('phong cách trùng nhiều hơn xếp trước khi các tiêu chí trước bằng nhau', () => {
  const c = ctx({ styles: ['Hiện đại', 'Sân vườn'] });
  const a = vendor('a', [pkg('a', 'a', 10_000_000)], { styles: ['Cổ điển'] });
  const b = vendor('b', [pkg('b', 'b', 10_000_000)], { styles: ['hiện đại', 'Sân vườn'] });
  assert.deepEqual(suggest([a, b], c).map((v) => v.id), ['b', 'a']);
});

test('thẻ không ghi "giá từ" / "nằm trong ngân sách"; định dạng tiền VND', () => {
  const c = ctx();
  const [s] = suggest([vendor('a', [pkg('a', 'a', 12_500_000)])], c);
  assert.ok(!r.buildReasons(s, c).reasons.some((x) => /giá từ|ngân sách/i.test(x)));
  assert.equal(r.buildReasons(s, c).warning, null);
  assert.equal(r.formatVnd(1234567.4), '1.234.567đ');
});

test('chuẩn hóa phường/xã: bỏ tiền tố và dấu', () => {
  assert.equal(r.normalizePlace('Phường Cầu Giấy'), 'cau giay');
  assert.equal(r.normalizePlace('Xã Đông Anh'), 'dong anh');
  assert.equal(r.sameWard({ ward: 'Cầu Giấy' }, { ward: 'Phường Cầu Giấy' }), true);
  assert.equal(r.sameWard({ ward: 'Cầu Giấy' }, { ward: null }), false);
});

test('dòng giống nhau ở mọi thẻ thì bỏ, khác nhau thì giữ; cảnh báo luôn giữ', () => {
  const copy = (reasons, warning = null) => ({ reasons, warning, fewReviews: false });
  const same = r.dropSharedReasons([copy(['5.0/5 từ 3 lượt']), copy(['5.0/5 từ 3 lượt'], 'Gói này tối thiểu 20 bàn, nhiều hơn dự kiến 5 bàn')]);
  assert.deepEqual(same.map((x) => x.reasons), [[], []]);
  assert.equal(same[1].warning, 'Gói này tối thiểu 20 bàn, nhiều hơn dự kiến 5 bàn');
  const diff = r.dropSharedReasons([copy(['4.8/5 từ 12 lượt']), copy(['4.2/5 từ 5 lượt']), copy([])]);
  assert.deepEqual(diff.map((x) => x.reasons), [['4.8/5 từ 12 lượt'], ['4.2/5 từ 5 lượt'], []]);
  assert.deepEqual(r.dropSharedReasons([copy(['4.8/5 từ 12 lượt'])])[0].reasons, ['4.8/5 từ 12 lượt']); // một thẻ: giữ
});
