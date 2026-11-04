import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUTO_COMPLETE_DAYS, autoCompleteCutoff } from '../src/modules/orders/order-rules.ts';

/** Điều kiện lọc của autoComplete: event_date < autoCompleteCutoff(hôm nay). event_date là cột Date nên là 00:00 UTC. */
const due = (event: string, today: string) => new Date(`${event}T00:00:00Z`) < autoCompleteCutoff(today);

describe('tự hoàn tất: event_date < hôm nay − 7', () => {
  it('hằng số là 7 ngày', () => assert.equal(AUTO_COMPLETE_DAYS, 7));
  it('đúng 7 ngày sau ngày thực hiện: chưa tự hoàn tất', () => assert.equal(due('2027-06-15', '2027-06-22'), false));
  it('ngày thứ 8 sau ngày thực hiện: tự hoàn tất', () => assert.equal(due('2027-06-15', '2027-06-23'), true));
  it('trước và đúng ngày thực hiện: không', () => {
    assert.equal(due('2027-06-15', '2027-06-14'), false);
    assert.equal(due('2027-06-15', '2027-06-15'), false);
  });
  it('qua tháng, qua năm', () => assert.equal(due('2026-12-28', '2027-01-05'), true));
});
