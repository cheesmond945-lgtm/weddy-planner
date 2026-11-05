/*
 * Quy tắc đánh giá (src/modules/reviews/review-rules.ts): thẻ gợi ý, hạn sửa 30 ngày, tên công khai, phản hồi của NCC. Hàm thuần, chạy bằng: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseTags, publicName, replyIssue, reviewEditable } from '../src/modules/reviews/review-rules.ts';

describe('review-rules', () => {
  it('thẻ: bỏ thẻ lạ, bỏ trùng, giữ thứ tự chuẩn', () => {
    assert.deepEqual(parseTags(['Giá hợp lý', 'abc', 'Đúng giờ', 'Đúng giờ', 3]), ['Đúng giờ', 'Giá hợp lý']);
    assert.deepEqual(parseTags('Đúng giờ'), []);
  });
  it('sửa được trong 30 ngày, quá thì khóa', () => {
    const at = new Date('2026-11-01T00:00:00Z');
    assert.equal(reviewEditable(at, new Date('2026-12-01T00:00:00Z')), true);
    assert.equal(reviewEditable(at, new Date('2026-12-01T00:00:01Z')), false);
    assert.equal(reviewEditable(null), false);
  });
  it('tên công khai: tên gọi + chữ đầu của họ', () => {
    assert.equal(publicName('Lý Phương Trang'), 'Trang L.');
    assert.equal(publicName('Minh'), 'Minh');
    assert.equal(publicName('  '), 'Khách hàng');
  });
  it('phản hồi của NCC: không rỗng, tối đa 1000 ký tự', () => {
    assert.equal(replyIssue(' '), 'Nhập nội dung phản hồi.');
    assert.equal(replyIssue('Cảm ơn anh chị'), null);
    assert.match(replyIssue('x'.repeat(1001))!, /1000/);
  });
});
