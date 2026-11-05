/*
 * Tỷ lệ cọc tối thiểu 10% khi lưu nháp / gửi / cập nhật đơn (parseContent), chạy bằng: npm test
 * Lỗi đã gặp: nhập 5% vẫn lưu nháp được, chỉ bị chặn khi gửi.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEPOSIT_PERCENT_MIN, parseContent } from '../src/modules/orders/order-rules.ts';

const future = '2099-01-01';
const base = { customerName: 'A', customerPhone: '0900000000', eventDate: future, items: [{ itemName: 'Gói', unit: 'Gói', quantity: 1, unitPrice: 10_000_000 }] };
const code = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (e) {
    const err = e as { getResponse?: () => { code?: string; details?: Record<string, string> } };
    return err.getResponse?.() ?? e;
  }
};

describe('tỷ lệ cọc tối thiểu', () => {
  it('mức tối thiểu là 10%', () => assert.equal(DEPOSIT_PERCENT_MIN, 10));

  for (const mode of ['draft', 'send'] as const) {
    it(`${mode}: 5% bị chặn, 9% bị chặn`, () => {
      for (const p of [5, 9, 0.5]) {
        const r = code(() => parseContent({ ...base, depositPercent: p }, mode)) as { details?: Record<string, string> } | null;
        assert.ok(r?.details?.depositPercent, `${mode} ${p}% phải bị chặn`);
      }
    });
    it(`${mode}: 10% và 30% và 99% qua`, () => {
      for (const p of [10, 30, 99]) assert.equal(parseContent({ ...base, depositPercent: p }, mode).depositPercent, p);
    });
    it(`${mode}: 0, 100, âm bị chặn`, () => {
      for (const p of [0, 100, -5, 150]) assert.ok((code(() => parseContent({ ...base, depositPercent: p }, mode)) as { details?: Record<string, string> } | null)?.details?.depositPercent);
    });
  }

  it('không gửi tỷ lệ: mặc định 30%; gửi thì bắt buộc nhập', () => {
    assert.equal(parseContent({ ...base }, 'draft').depositPercent, 30);
    assert.ok((code(() => parseContent({ ...base }, 'send')) as { details?: Record<string, string> } | null)?.details?.depositPercent);
  });

  it('sửa sau cọc (edit) giữ tỷ lệ đã chốt: đơn cũ dưới 10% vẫn sửa được', () => {
    assert.equal(parseContent({ ...base, depositPercent: 5 }, 'edit').depositPercent, 5);
  });
});
