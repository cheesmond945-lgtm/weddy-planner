/* Đổi số khách khi tiệc đã cọc (order-adjustment-rules.ts). Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const r = require('../dist/modules/orders/order-adjustment-rules');

const M = 1_000_000;
// Đơn tiệc 30 bàn × 5tr = 150tr, thêm phí dịch vụ 10tr → 160tr; đã cọc 30% = 48tr; sảnh 400 khách, tối thiểu 25 bàn
const base = (over = {}) => ({
  orderTotal: 160 * M,
  deposit: 48 * M,
  table: { unitPrice: 5 * M, quantity: 30, amount: 150 * M },
  minTables: 25,
  capacity: 400,
  oldGuestCount: 300,
  newGuestCount: 350,
  eventDate: '2026-12-20',
  today: '2026-11-02',
  ...over,
});

test('tăng 300 → 350 khách: 35 bàn, giá trị mới 185tr, cọc bổ sung 10% phần tăng = 2,5tr', () => {
  const q = r.quoteGuestChange(base());
  assert.equal(q.ok, true);
  assert.deepEqual([q.oldTables, q.newTables, q.chargedTables], [30, 35, 35]);
  assert.equal(q.newAmount, 185 * M);
  assert.equal(q.extraDeposit, 2.5 * M);
  assert.equal(q.deadline, '2026-12-13');
});

test('giảm khách: không hoàn cọc, tính theo số bàn tối thiểu của sảnh', () => {
  const q = r.quoteGuestChange(base({ newGuestCount: 200 }));
  // 20 bàn < tối thiểu 25 → 25 × 5tr = 125tr + 10tr = 135tr
  assert.equal(q.chargedTables, 25);
  assert.equal(q.newAmount, 135 * M);
  assert.equal(q.extraDeposit, 0);
  // Giá trị đơn không thấp hơn số đã cọc
  const tiny = r.quoteGuestChange(base({ newGuestCount: 10, minTables: null, deposit: 100 * M }));
  assert.equal(tiny.newAmount, 100 * M);
});

test('quá hạn 7 ngày trước ngày tổ chức: không cho đổi', () => {
  assert.equal(r.quoteGuestChange(base({ today: '2026-12-13' })).ok, true);
  const late = r.quoteGuestChange(base({ today: '2026-12-14' }));
  assert.equal(late.ok, false);
  assert.equal(late.code, 'CUTOFF');
  assert.match(late.message, /13\/12\/2026/);
});

test('vượt sức chứa sảnh, trùng số khách, số không hợp lệ: báo lỗi', () => {
  assert.equal(r.quoteGuestChange(base({ newGuestCount: 450 })).code, 'CAPACITY');
  assert.equal(r.quoteGuestChange(base({ newGuestCount: 300 })).code, 'SAME');
  assert.equal(r.quoteGuestChange(base({ newGuestCount: 0 })).code, 'INVALID');
  assert.equal(r.quoteGuestChange(base({ newGuestCount: 12.5 })).code, 'INVALID');
});

test('dòng tiền bàn: dòng gắn sảnh của đơn, không có thì dòng đơn vị bàn/mâm', () => {
  const items = [
    { id: 'a', package_id: null, unit: 'Gói' },
    { id: 'b', package_id: 'hall', unit: 'Bàn' },
  ];
  assert.equal(r.tableLineOf(items, 'hall').id, 'b');
  assert.equal(r.tableLineOf([{ id: 'c', package_id: null, unit: 'Mâm' }], null).id, 'c');
  assert.equal(r.tableLineOf([{ id: 'd', package_id: null, unit: 'Gói' }], null), null);
});

test('sảnh tăng số bàn tối thiểu sau khi đặt: không tính vượt số bàn đã thỏa thuận trong đơn', () => {
  // Đơn 30 bàn × 6,5tr = 195tr, sảnh nay ghi tối thiểu 55 bàn
  const o = base({ orderTotal: 195 * M, deposit: 58.5 * M, table: { unitPrice: 6.5 * M, quantity: 30, amount: 195 * M }, minTables: 55, capacity: 800 });
  const up = r.quoteGuestChange({ ...o, newGuestCount: 320 });
  assert.equal(up.chargedTables, 32);
  assert.equal(up.newAmount, 208 * M);
  assert.equal(up.extraDeposit, 1.3 * M);
  const down = r.quoteGuestChange({ ...o, newGuestCount: 250 });
  // Không xuống dưới 30 bàn đã thỏa thuận (tối thiểu của sảnh lớn hơn), giá giữ nguyên, không hoàn cọc
  assert.equal(down.chargedTables, 30);
  assert.equal(down.newAmount, 195 * M);
  assert.equal(down.extraDeposit, 0);
});
