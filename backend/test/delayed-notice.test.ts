/*
 * Thông báo gửi trễ, hủy được (src/modules/orders/delayed-notice.ts), chạy bằng: npm test.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DelayedNotices, SCHEDULE_NOTICE_DELAY_MS, SCHEDULE_UNDO_MS } from '../src/modules/orders/delayed-notice.ts';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('DelayedNotices', () => {
  it('cửa sổ hoàn tác 5 giây, thông báo gửi sau đó (có đệm 1 giây)', () => {
    assert.equal(SCHEDULE_UNDO_MS, 5000);
    assert.ok(SCHEDULE_NOTICE_DELAY_MS > SCHEDULE_UNDO_MS);
  });

  it('không hoàn tác: gửi sau độ trễ, không gửi sớm', async () => {
    const n = new DelayedNotices(30);
    const sent: string[] = [];
    n.schedule('t1', () => void sent.push('a'));
    await wait(5);
    assert.deepEqual(sent, []);
    assert.equal(n.size, 1);
    await wait(60);
    assert.deepEqual(sent, ['a']);
    assert.equal(n.size, 0);
  });

  it('hoàn tác trong lúc chờ: hủy được, khách không nhận gì', async () => {
    const n = new DelayedNotices(30);
    const sent: string[] = [];
    n.schedule('t1', () => void sent.push('a'));
    assert.equal(n.cancel('t1'), true);
    await wait(60);
    assert.deepEqual(sent, []);
    assert.equal(n.cancel('t1'), false); // đã gửi / không còn gì để hủy
  });

  it('đổi tiếp trong lúc chờ: chỉ gửi bản cuối, các việc khác độc lập', async () => {
    const n = new DelayedNotices(30);
    const sent: string[] = [];
    n.schedule('t1', () => void sent.push('first'));
    n.schedule('t1', () => void sent.push('last'));
    n.schedule('t2', () => void sent.push('other'));
    await wait(70);
    assert.deepEqual(sent.sort(), ['last', 'other']);
  });

  it('lỗi khi gửi chuyển cho onError, không làm sập', async () => {
    const n = new DelayedNotices(10);
    const errs: unknown[] = [];
    n.schedule('t1', () => Promise.reject(new Error('boom')), (e) => errs.push(e));
    await wait(40);
    assert.equal(errs.length, 1);
  });
});
