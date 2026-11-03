/* Hàm chi phí gói dùng chung (budget-engine.ts) và chi phí của NCC đã chọn (allocation.chosenItem). Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const e = require('../dist/modules/weddings/budget-engine');
const a = require('../dist/modules/weddings/allocation');

const M = 1_000_000;
let seq = 0;
/** Gói trọn gói */
const pkg = (price, extra = {}) => ({ id: `p${++seq}`, vendorId: extra.vendorId ?? `v${seq}`, name: `Gói ${price / M}tr`, price, unit: 'gói', capacity: null, minTables: null, ...extra });
/** Gói nhà hàng tính theo bàn */
const hall = (pricePerTable, capacity, minTables = null, extra = {}) => pkg(pricePerTable, { unit: 'mâm', capacity, minTables, ...extra });

test('chi phí gói theo bàn: số bàn tự tính, ghi đè số bàn, số bàn tối thiểu', () => {
  const h = hall(5 * M, 400, 30);
  assert.equal(e.tableCount(250, null), 25);
  assert.equal(e.tableCount(251, null), 26);
  assert.equal(e.tableCount(250, 40), 40);
  assert.equal(e.packageCost(h, 25), 150 * M); // tối thiểu 30 bàn
  assert.equal(e.packageCost(h, 40), 200 * M);
  assert.equal(e.packageCost(pkg(9 * M), 40), 9 * M);
});

test('gói dự kiến: chi phí ước tính thấp nhất (gói đủ chỗ)', () => {
  const ps = [pkg(18 * M), pkg(10 * M), pkg(30 * M)];
  assert.equal(e.plannedPackage(ps, 'chup-anh', 250, 25).cost, 10 * M);
  // Nhà hàng: chỉ xét sảnh đủ chỗ; chi phí = đơn giá × max(số bàn dự kiến, số bàn tối thiểu)
  const halls = [hall(4 * M, 200), hall(5 * M, 300), hall(7 * M, 300)];
  assert.equal(e.plannedPackage(halls, 'nha-hang', 250, 25).cost, 125 * M);
  // Đơn giá rẻ hơn nhưng tối thiểu nhiều bàn thì tổng đắt hơn: chọn theo tổng chi phí
  const byMin = [hall(4 * M, 600, 50), hall(5 * M, 600, 20)];
  assert.equal(e.plannedPackage(byMin, 'nha-hang', 250, 25).cost, 125 * M);
});

const pv = (packages, extra = {}) => ({ vendorId: 'x', vendorName: 'X', categoryId: 'c-photo', slug: 'chup-anh', selectedPackageId: null, orderTotal: null, orderDeposited: null, packages, ...extra });

test('gói đã chọn bị ẩn sau khi chọn: về gói dự kiến và gắn cờ', () => {
  const ps = [pkg(10 * M, { vendorId: 'x' }), pkg(18 * M, { vendorId: 'x' })];
  const chosen = a.chosenItem(pv(ps, { selectedPackageId: ps[1].id }), 250, 25);
  assert.deepEqual([chosen.packageSource, chosen.cost], ['SELECTED', 18 * M]);
  const gone = a.chosenItem(pv(ps, { selectedPackageId: 'p-da-an' }), 250, 25);
  assert.deepEqual([gone.packageSource, gone.cost, gone.packageUnavailable], ['PLANNED', 10 * M, true]);
});

test('nguồn chi phí: Dự kiến khi chưa có đơn, Theo đơn khi có đơn chưa cọc, Đã cọc khi đơn đã cọc', () => {
  const ps = [pkg(10 * M, { vendorId: 'x' })];
  const at = (extra) => a.chosenItem(pv(ps, extra), 250, 25);
  assert.deepEqual([at({}).costSource, at({}).deposited], ['PLANNED', 0]);
  assert.deepEqual([at({ orderTotal: 12 * M }).costSource, at({ orderTotal: 12 * M }).cost], ['ORDER', 12 * M]);
  assert.deepEqual([at({ orderTotal: 12 * M, orderDeposited: 3 * M }).costSource, at({ orderTotal: 12 * M, orderDeposited: 3 * M }).deposited], ['DEPOSITED', 3 * M]);
});
