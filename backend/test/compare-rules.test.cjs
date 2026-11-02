/* So sánh dịch vụ (compare-rules.ts), mục 13 của đặc tả. Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../dist/modules/compare/compare-rules');

const M = 1_000_000;
const pkg = (id, price, extra = {}) => ({ id, name: `Gói ${id}`, price, minTables: null, capacity: null, description: 'Sảnh riêng, MC, ban nhạc, hoa bàn, cổng hoa', ...extra });
const item = (id, packages, extra = {}) => ({ id, name: id, ward: null, rating: null, reviewCount: 0, packages, ...extra });
const venueCtx = (over = {}) => ({ slug: 'nha-hang', guestCount: 300, tables: 30, budget: 250 * M, weddingWard: null, ...over });

test('gói tiệc 5,8tr/bàn, tối thiểu 40 bàn, kế hoạch 30 bàn: 232tr, công thức "40 × 5.800.000đ"', () => {
  const t = c.packageTotal(pkg('p', 5.8 * M, { minTables: 40 }), 'nha-hang', 30);
  assert.equal(t.total, 232 * M);
  assert.equal(t.chargedTables, 40);
  const r = c.compareServices([item('A', [pkg('a', 5.8 * M, { minTables: 40, capacity: 600 })]), item('B', [pkg('b', 6 * M, { capacity: 600 })])], venueCtx());
  const a = r.columns[0];
  assert.equal(a.total, 232 * M);
  assert.equal(a.formula, '40 × 5.800.000đ');
  assert.equal(a.tables.text, '40 bàn, tối thiểu của gói');
  assert.equal(a.tables.warning, 'Gói này yêu cầu tối thiểu 40 bàn, nhiều hơn 10 bàn so với dự kiến của bạn');
  assert.equal(r.columns[1].tables.text, '30 bàn, theo dự kiến của bạn');
  assert.equal(r.columns[1].tables.warning, null);
});

test('đơn giá thấp hơn nhưng tổng cao hơn: nhãn "Chi phí thấp nhất" gắn theo tổng chi phí', () => {
  // A: 5tr × 40 bàn tối thiểu = 200tr; B: 6tr × 30 bàn = 180tr
  const r = c.compareServices([item('A', [pkg('a', 5 * M, { minTables: 40 })]), item('B', [pkg('b', 6 * M)])], venueCtx());
  assert.deepEqual(r.columns.map((x) => x.labels.cheapest), [false, true]);
  assert.equal(r.summary[0], 'B rẻ hơn A 20.000.000đ.');
});

test('hòa chi phí: không gắn nhãn, không có câu rẻ hơn', () => {
  const r = c.compareServices([item('A', [pkg('a', 20 * M)]), item('B', [pkg('b', 20 * M)])], { slug: 'decor', guestCount: 300, tables: 30, budget: 25 * M, weddingWard: null });
  assert.ok(r.columns.every((x) => !x.labels.cheapest));
  assert.equal(r.summary.length, 0);
});

test('một cùng khu vực, một khác: tóm tắt có câu vị trí; chưa chọn nơi tổ chức thì ẩn dòng Vị trí', () => {
  const items = [item('A', [pkg('a', 10 * M)], { ward: 'Phường Cầu Giấy' }), item('B', [pkg('b', 12 * M)], { ward: 'Phường Đống Đa' })];
  const r = c.compareServices(items, { slug: 'decor', guestCount: 300, tables: 30, budget: 20 * M, weddingWard: 'Phường Cầu Giấy' });
  assert.equal(r.columns[0].location.text, 'Cùng Cầu Giấy với địa điểm tổ chức');
  assert.equal(r.columns[1].location.text, 'Khác khu vực (Đống Đa)');
  assert.ok(r.summary.includes('A cùng khu vực với địa điểm tổ chức.'));
  const none = c.compareServices(items, { slug: 'decor', guestCount: 300, tables: 30, budget: 20 * M, weddingWard: null });
  assert.equal(none.rows.location, false);
  assert.ok(none.columns.every((x) => x.location === null));
  assert.ok(!none.summary.some((s) => s.includes('khu vực')));
});

test('hai bên đều đủ chỗ, chênh lệch sức chứa nhỏ: không có câu sức chứa; chênh nhiều thì có', () => {
  const small = c.compareServices([item('A', [pkg('a', 5 * M, { capacity: 350 })]), item('B', [pkg('b', 5.2 * M, { capacity: 380 })])], venueCtx());
  assert.ok(!small.summary.some((s) => s.includes('sức chứa')));
  assert.equal(small.columns[1].labels.largestCapacity, true);
  const big = c.compareServices([item('A', [pkg('a', 5 * M, { capacity: 350 })]), item('B', [pkg('b', 5.2 * M, { capacity: 600 })])], venueCtx());
  assert.ok(big.summary.includes('B có sức chứa lớn hơn A 250 khách.'));
  assert.equal(big.columns[1].capacity.text, 'Tối đa 600 khách, đủ cho 300 khách của bạn');
});

test('đổi gói: tổng, so với ngân sách và tóm tắt cập nhật', () => {
  const items = [item('A', [pkg('a1', 18 * M), pkg('a2', 30 * M)]), item('B', [pkg('b1', 22 * M)])];
  const ctx = { slug: 'decor', guestCount: 300, tables: 30, budget: 25 * M, weddingWard: null };
  const before = c.compareServices(items, ctx);
  assert.equal(before.columns[0].package.id, 'a1');
  assert.equal(before.columns[0].budget.text, 'Còn dư 7.000.000đ');
  assert.deepEqual(before.summary, ['A rẻ hơn B 4.000.000đ.']);
  const after = c.compareServices(items, ctx, { A: 'a2' });
  assert.equal(after.columns[0].total, 30 * M);
  assert.equal(after.columns[0].budget.text, 'Vượt 5.000.000đ');
  assert.deepEqual(after.summary, ['B rẻ hơn A 8.000.000đ.', 'A vượt ngân sách hạng mục 5.000.000đ.']);
});

test('gói mặc định: rẻ nhất trong ngân sách, không có thì rẻ nhất; vừa đủ ghi "Vừa đủ (còn 0đ)"', () => {
  const r = c.compareServices([item('A', [pkg('a1', 40 * M), pkg('a2', 25 * M)]), item('B', [pkg('b1', 30 * M)])], { slug: 'decor', guestCount: 1, tables: 1, budget: 25 * M, weddingWard: null });
  assert.equal(r.columns[0].package.id, 'a2');
  assert.equal(r.columns[0].budget.text, 'Vừa đủ (còn 0đ)');
  assert.equal(r.columns[1].package.id, 'b1');
});

test('gói tiệc không đủ chỗ: cảnh báo ở Sức chứa, khóa nút kèm lý do; hạng mục khác không có dòng số bàn và sức chứa', () => {
  const r = c.compareServices([item('A', [pkg('a', 5 * M, { capacity: 250 })]), item('B', [pkg('b', 5 * M, { capacity: 400 })])], venueCtx());
  assert.equal(r.columns[0].capacity.text, 'Tối đa 250 khách, không đủ cho 300 khách của bạn');
  assert.equal(r.columns[0].canAdd, false);
  assert.match(r.columns[0].blockReason, /không đủ chỗ cho 300 khách/);
  const decor = c.compareServices([item('A', [pkg('a', 10 * M)]), item('B', [pkg('b', 12 * M)])], { slug: 'decor', guestCount: 300, tables: 30, budget: 20 * M, weddingWard: null });
  assert.deepEqual([decor.rows.tables, decor.rows.capacity], [false, false]);
  assert.ok(decor.columns.every((x) => x.tables === null && x.capacity === null && x.formula === null && x.canAdd));
});

test('kế hoạch chưa có ngân sách / số khách: bỏ dòng So với ngân sách, tiệc tạm tính theo số bàn tối thiểu', () => {
  const r = c.compareServices([item('A', [pkg('a', 5 * M, { minTables: 30 })]), item('B', [pkg('b', 6 * M)])], venueCtx({ guestCount: null, tables: null, budget: null }));
  assert.equal(r.rows.budget, false);
  assert.equal(r.columns[0].total, 150 * M);
  assert.match(r.columns[0].assumption, /tối thiểu của gói/);
  assert.equal(r.columns[1].total, null);
  assert.equal(r.columns[0].labels.cheapest, false);
});

test('"Điểm cao nhất" chỉ khi mọi bên đủ số lượt đánh giá', () => {
  const r = c.compareServices([item('A', [pkg('a', 10 * M)], { rating: 4.8, reviewCount: 5 }), item('B', [pkg('b', 12 * M)], { rating: 4.5, reviewCount: 2 })], { slug: 'decor', guestCount: 300, tables: 30, budget: null, weddingWard: null });
  assert.ok(r.columns.every((x) => !x.labels.topRated));
  const ok = c.compareServices([item('A', [pkg('a', 10 * M)], { rating: 4.8, reviewCount: 5 }), item('B', [pkg('b', 12 * M)], { rating: 4.5, reviewCount: 3 })], { slug: 'decor', guestCount: 300, tables: 30, budget: null, weddingWard: null });
  assert.deepEqual(ok.columns.map((x) => x.labels.topRated), [true, false]);
  assert.equal(ok.columns[0].rating.text, '4,8/5 từ 5 lượt');
});

test('dòng Bao gồm: thẻ của gói trước, rồi cụm ngắn từ mô tả; bỏ câu giới thiệu, giá, sức chứa', () => {
  assert.deepEqual(c.includesOf('Sảnh riêng, MC, ban nhạc, hoa bàn, cổng hoa'), ['Sảnh riêng', 'MC', 'Ban nhạc', 'Hoa bàn']);
  assert.deepEqual(c.includesOf('- Album 30x30\n- 2 thợ chụp\n- Quay phim'), ['Album 30x30', '2 thợ chụp', 'Quay phim']);
  const desc =
    'Cổng Hoa Rực Rỡ là lựa chọn phong cách truyền thống từ Ha Vy Wedding & Event, với cổng hoa nhiều sắc màu dẫn vào không gian tiệc. Gói dành cho cặp đôi ưu tiên sự đồng nhất giữa sân khấu, lối đi và góc chụp ảnh. Mức giá từ 14.500.000đ, có thể điều chỉnh theo quy mô và địa điểm tổ chức.';
  const r = c.includesOf(desc, ['Truyền thống'], ['Ha Vy Wedding & Event', 'Cổng Hoa Rực Rỡ']);
  assert.equal(r[0], 'Phong cách truyền thống');
  assert.ok(r.includes('Cổng hoa nhiều sắc màu dẫn vào không gian tiệc'));
  assert.ok(r.length <= 4 && r.every((x) => x.length <= 60 && !/giá|Ha Vy/.test(x)));
});
