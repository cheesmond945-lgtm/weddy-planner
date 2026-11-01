/* Quy tắc lời mời và link chia sẻ (sharing-rules.ts). Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const r = require('../dist/modules/wedding-sharing/sharing-rules');

test('mặc định khi mời: Cô dâu/Chú rể chỉnh sửa 5 tab, Người thân chỉ xem 3 tab', () => {
  assert.deepEqual(r.inviteDefaults('Bride'), { role: 'Editor', tabs: ['overview', 'timeline', 'services', 'budget', 'guests'] });
  assert.deepEqual(r.inviteDefaults('Groom').role, 'Editor');
  assert.deepEqual(r.inviteDefaults('Relative'), { role: 'Viewer', tabs: ['overview', 'timeline', 'services'] });
});

test('tab: bỏ trùng, theo thứ tự chuẩn, tắt được mọi tab miễn còn ít nhất 1', () => {
  assert.deepEqual(r.normalizeTabs(['guests', 'overview', 'guests']), ['overview', 'guests']);
  assert.deepEqual(r.normalizeTabs(['budget']), ['budget']);
  assert.equal(r.normalizeTabs([]), null);
  assert.equal(r.normalizeTabs(['chat']), null);
  assert.equal(r.normalizeTabs('overview'), null);
});

test('mã link: 43 ký tự, cố định theo id, khác nhau theo loại và khóa; DB chỉ lưu SHA-256', () => {
  const a = r.linkToken('k1', 'invite', 'id-1');
  assert.ok(r.isTokenShape(a));
  assert.equal(a, r.linkToken('k1', 'invite', 'id-1'));
  assert.notEqual(a, r.linkToken('k1', 'share', 'id-1'));
  assert.notEqual(a, r.linkToken('k2', 'invite', 'id-1'));
  assert.match(r.hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(r.hashToken(a), a);
  assert.equal(r.isTokenShape('abc'), false);
  assert.equal(r.isTokenShape(`${a}!`), false);
});

test('trạng thái lời mời: thu hồi, đã dùng, hết hạn, còn hiệu lực', () => {
  const now = new Date('2026-10-30T00:00:00Z');
  const future = new Date('2026-11-01T00:00:00Z');
  assert.equal(r.inviteStatus({ used_date: null, revoked_date: null, expires_date: future }, now), 'VALID');
  assert.equal(r.inviteStatus({ used_date: null, revoked_date: null, expires_date: now }, now), 'EXPIRED');
  assert.equal(r.inviteStatus({ used_date: now, revoked_date: null, expires_date: future }, now), 'USED');
  assert.equal(r.inviteStatus({ used_date: now, revoked_date: now, expires_date: future }, now), 'REVOKED');
});

test('nhận lời mời khi đang có kế hoạch riêng (Q5)', () => {
  const owner = { role: 'Owner', sameWedding: false, conversations: 0, orders: 0, otherMembers: 0 };
  assert.equal(r.acceptDecision(null, false), 'JOIN');
  assert.equal(r.acceptDecision({ ...owner, sameWedding: true }, false), 'ALREADY_JOINED');
  assert.equal(r.acceptDecision({ ...owner, role: 'Viewer' }, true), 'LEAVE_OTHER_FIRST');
  assert.equal(r.acceptDecision(owner, false), 'CONFIRM_LEAVE_OWN_PLAN');
  assert.equal(r.acceptDecision(owner, true), 'DELETE_OWN_PLAN_THEN_JOIN');
  for (const k of ['conversations', 'orders', 'otherMembers']) assert.equal(r.acceptDecision({ ...owner, [k]: 1 }, true), 'OWN_PLAN_IN_USE');
});
