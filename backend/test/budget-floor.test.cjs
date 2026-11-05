/* Ngân sách tối thiểu khi lưu thông tin đám cưới (budget-floor.ts). Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { budgetFloorErrors } = require('../dist/modules/weddings/budget-floor');

const M = 1_000_000;
const minCosts = { 'nha-hang': 135 * M, decor: 10 * M, 'hoa-cuoi': 800_000, makeup: 1.3 * M };
const all = Object.keys(minCosts);

test('nhỏ hơn gói rẻ nhất trên Forever: báo không đủ cho dịch vụ nào', () => {
  const e = budgetFloorErrors(500_000, 300, all, minCosts);
  assert.match(e.budget, /gói rẻ nhất trên Forever khoảng 800\.000đ/);
  assert.equal(e.categorySlugs, undefined);
});

test('chỉ đủ vài dịch vụ đã chọn: báo tối thiểu và số dịch vụ vừa ngân sách', () => {
  const e = budgetFloorErrors(50 * M, 300, all, minCosts);
  assert.match(e.budget, /chưa đủ cho 4 dịch vụ đã chọn: tối thiểu khoảng 147\.100\.000đ cho 300 khách/);
  assert.match(e.categorySlugs, /chỉ đủ khoảng 3 dịch vụ/);
});

test('đủ tiền, không kiểm dịch vụ (slugs null), hoặc chưa có dữ liệu giá: không báo', () => {
  assert.deepEqual(budgetFloorErrors(50 * M, 300, ['decor', 'makeup'], minCosts), {});
  assert.deepEqual(budgetFloorErrors(2 * M, 300, null, minCosts), {});
  assert.deepEqual(budgetFloorErrors(1_000, 300, all, {}), {});
});
