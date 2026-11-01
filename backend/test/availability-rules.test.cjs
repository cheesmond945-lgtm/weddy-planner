/*
 * Unit test cho availability-rules.ts (lịch khả dụng theo gói), chạy sau khi build:
 *   npm test
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const r = require('../dist/modules/availability/availability-rules');

const silver = { id: 'p-silver', name: 'Silver', resource: 'Sảnh Hoa Sen' };
const gold = { id: 'p-gold', name: 'Gold', resource: '  sảnh hoa   sen ' };
const diamond = { id: 'p-diamond', name: 'Diamond', resource: null };
const all = [silver, gold, diamond];
const stored = (rows) => {
  const m = new Map();
  for (const [id, date, status] of rows) {
    if (!m.has(id)) m.set(id, new Map());
    m.get(id).set(date, status);
  }
  return m;
};

test('không có dòng là Chưa cập nhật; gói dùng lịch riêng giữ đúng trạng thái của nó', () => {
  const s = stored([['p-diamond', '2026-11-28', 'AVAILABLE']]);
  assert.equal(r.effectiveDay(silver, all, s, '2026-11-28').status, 'UNKNOWN');
  assert.deepEqual(r.effectiveDay(diamond, all, s, '2026-11-28'), { date: '2026-11-28', status: 'AVAILABLE', own: 'AVAILABLE', blockedBy: null });
});

test('cùng sảnh (không phân biệt hoa thường, khoảng trắng): một gói kín thì gói kia không còn trống', () => {
  const s = stored([
    ['p-silver', '2026-11-28', 'BOOKED'],
    ['p-gold', '2026-11-28', 'AVAILABLE'],
  ]);
  const g = r.effectiveDay(gold, all, s, '2026-11-28');
  assert.equal(g.status, 'BOOKED');
  assert.equal(g.own, 'AVAILABLE');
  assert.equal(g.blockedBy, 'Silver');
  // Gói khác sảnh không bị ảnh hưởng
  assert.equal(r.effectiveDay(diamond, all, s, '2026-11-28').status, 'UNKNOWN');
});

test('kín ưu tiên hơn giữ chỗ; giữ chỗ của gói cùng sảnh làm gói còn trống thành giữ chỗ', () => {
  const s = stored([
    ['p-silver', '2026-12-05', 'HELD'],
    ['p-gold', '2026-12-05', 'AVAILABLE'],
    ['p-gold', '2026-12-06', 'HELD'],
    ['p-silver', '2026-12-06', 'BOOKED'],
  ]);
  assert.deepEqual(r.effectiveDay(gold, all, s, '2026-12-05'), { date: '2026-12-05', status: 'HELD', own: 'AVAILABLE', blockedBy: 'Silver' });
  assert.deepEqual(r.effectiveDay(gold, all, s, '2026-12-06'), { date: '2026-12-06', status: 'BOOKED', own: 'HELD', blockedBy: 'Silver' });
  assert.deepEqual(r.effectiveDay(silver, all, s, '2026-12-06'), { date: '2026-12-06', status: 'BOOKED', own: 'BOOKED', blockedBy: null });
});

test('ngày và tháng hợp lệ', () => {
  assert.equal(r.validDate('2026-02-29'), false);
  assert.equal(r.validDate('2028-02-29'), true);
  assert.equal(r.validDate('2026-1-05'), false);
  assert.equal(r.monthDays('2026-02').length, 28);
  assert.equal(r.monthDays('2026-11')[29], '2026-11-30');
  assert.equal(r.monthDays('2026-13'), null);
  assert.equal(r.monthOffset('2027-01', new Date(Date.UTC(2026, 9, 30))), 3);
});
