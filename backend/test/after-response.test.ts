/*
 * Việc phụ chạy sau response (src/common/after-response.ts), chạy bằng: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runAfter } from '../src/common/after-response.ts';

const tick = () => new Promise((r) => setTimeout(r, 20));

describe('runAfter', () => {
  it('không chạy đồng bộ trong request: trả về trước, việc phụ chạy sau', async () => {
    const order: string[] = [];
    runAfter('x', () => order.push('later'));
    order.push('response');
    await tick();
    assert.deepEqual(order, ['response', 'later']);
  });

  it('lỗi (đồng bộ hay bất đồng bộ) được bắt và ghi log, không ném ra ngoài', async () => {
    const logs: string[] = [];
    runAfter('thông báo', () => {
      throw new Error('hỏng đồng bộ');
    }, (m) => logs.push(m));
    runAfter('realtime', async () => {
      throw new Error('hỏng bất đồng bộ');
    }, (m) => logs.push(m));
    await tick();
    assert.equal(logs.length, 2);
    assert.match(logs[0], /thông báo: hỏng đồng bộ/);
    assert.match(logs[1], /realtime: hỏng bất đồng bộ/);
  });

  it('chạy việc phụ bất đồng bộ tới cùng', async () => {
    let done = false;
    runAfter('slow', async () => {
      await new Promise((r) => setTimeout(r, 5));
      done = true;
    });
    await tick();
    assert.equal(done, true);
  });
});
