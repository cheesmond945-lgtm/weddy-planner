/* Quy tắc link xem công khai (sharing-rules.ts). Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const r = require('../dist/modules/wedding-sharing/sharing-rules');

test('tab: bỏ trùng, theo thứ tự chuẩn, tắt được mọi tab miễn còn ít nhất 1', () => {
  assert.deepEqual(r.normalizeTabs(['budget', 'overview', 'budget']), ['overview', 'budget']);
  // Tab Khách mời đã bỏ: gửi 'guests' là không hợp lệ
  assert.equal(r.normalizeTabs(['guests', 'overview']), null);
  assert.deepEqual(r.normalizeTabs(['budget']), ['budget']);
  assert.equal(r.normalizeTabs([]), null);
  assert.equal(r.normalizeTabs(['chat']), null);
  assert.equal(r.normalizeTabs('overview'), null);
});

test('mã link: 43 ký tự, cố định theo id, khác nhau theo id và khóa; DB chỉ lưu SHA-256', () => {
  const a = r.linkToken('k1', 'id-1');
  assert.ok(r.isTokenShape(a));
  assert.equal(a, r.linkToken('k1', 'id-1'));
  assert.notEqual(a, r.linkToken('k1', 'id-2'));
  assert.notEqual(a, r.linkToken('k2', 'id-1'));
  assert.match(r.hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(r.hashToken(a), a);
  assert.equal(r.isTokenShape('abc'), false);
  assert.equal(r.isTokenShape(`${a}!`), false);
});
