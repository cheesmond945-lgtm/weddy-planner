/*
 * Cờ `send` khi tạo đơn (POST /vendors/me/orders), chạy bằng: npm test
 * Lỗi đã gặp: `const send = !body.send` làm "Gửi đơn" ra đơn nháp và "Lưu nháp" lại gửi cho khách.
 * Đúng tài liệu (docs/api/orders.md): send = true gửi luôn, thiếu / false = lưu nháp.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { wantsSend } from '../src/modules/orders/order-rules.ts';

describe('wantsSend', () => {
  it('send = true: Gửi đơn (Draft → Pending)', () => {
    assert.equal(wantsSend({ send: true }), true);
  });

  it('send = false hoặc thiếu: Lưu nháp (khách không thấy)', () => {
    assert.equal(wantsSend({ send: false }), false);
    assert.equal(wantsSend({}), false);
    assert.equal(wantsSend(undefined), false);
    assert.equal(wantsSend(null), false);
  });

  it('chỉ đúng boolean true mới gửi (chuỗi, số không tính)', () => {
    assert.equal(wantsSend({ send: 'true' }), false);
    assert.equal(wantsSend({ send: 1 }), false);
  });

  it('orders.service dùng wantsSend, không còn đảo cờ', () => {
    // chạy từ thư mục backend (npm test)
    const src = readFileSync('src/modules/orders/orders.service.ts', 'utf8');
    assert.ok(src.includes('const send = wantsSend(body);'));
    assert.ok(!src.includes('!body.send'));
  });
});
