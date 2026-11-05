/*
 * Ưu đãi tặng bánh cưới, tháp ly của Trung tâm tiệc cưới theo sức chứa (src/modules/vendors/venue-gift.ts), chạy bằng: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GIFT_SENTENCE, GIFT_TASK_TITLE, giftDescription, giftTasks, hasGift, plainTitle } from '../src/modules/vendors/venue-gift.ts';

const t = (title: string, id?: string) => ({ ...(id && { id }), title, note: null, owner: 'VENDOR' as const, offsetDays: -5 });
const MENU = 'Chốt thực đơn chính thức: món, đồ uống, bánh, tháp ly';
const PROGRAM = 'Chốt chương trình tiệc: giờ đón khách, giờ khai tiệc, nghi thức cắt bánh, rót rượu, nhạc';
const DESC = 'Sảnh Hoa tại Trung tâm A. Sảnh phù hợp cho khoảng 500 khách. Giá tham khảo từ 5.000.000đ/mâm.';

describe('venue-gift', () => {
  it('sức chứa từ 500 mới tặng', () => {
    assert.equal(hasGift(500), true);
    assert.equal(hasGift(499), false);
    assert.equal(hasGift(null), false);
  });

  it('được tặng: thêm việc tặng sau "Gửi thực đơn in", không thêm trùng', () => {
    const out = giftTasks([t(MENU, 'a'), t('Gửi thực đơn in đặt trên từng mâm', 'b'), t('Tổng duyệt', 'c')], true);
    assert.deepEqual(out.map((x) => x.title), [MENU, 'Gửi thực đơn in đặt trên từng mâm', GIFT_TASK_TITLE, 'Tổng duyệt']);
    assert.equal(giftTasks(out, true).length, 4);
  });

  it('không tặng: bỏ việc tặng, bỏ chữ bánh, tháp ly và cắt bánh trong việc chung', () => {
    const out = giftTasks([t(MENU, 'a'), t(PROGRAM, 'b'), t(GIFT_TASK_TITLE, 'c')], false);
    assert.deepEqual(out.map((x) => x.title), ['Chốt thực đơn chính thức: món, đồ uống', 'Chốt chương trình tiệc: giờ đón khách, giờ khai tiệc, các nghi thức, nhạc']);
    assert.equal(plainTitle('Chốt số mâm chính thức'), 'Chốt số mâm chính thức');
  });

  it('mô tả: câu tặng trước câu giá; không tặng thì bỏ, không thêm trùng', () => {
    const gift = giftDescription(DESC, true);
    assert.equal(gift, `Sảnh Hoa tại Trung tâm A. Sảnh phù hợp cho khoảng 500 khách. ${GIFT_SENTENCE} Giá tham khảo từ 5.000.000đ/mâm.`);
    assert.equal(giftDescription(gift, true), gift);
    assert.equal(giftDescription(gift, false), DESC);
    // Câu tặng cũ kèm điều kiện được thay bằng câu mới
    assert.equal(giftDescription('A. Tặng kèm bánh cưới và tháp ly khi đủ điều kiện ưu đãi của gói. Giá B.', true), `A. ${GIFT_SENTENCE} Giá B.`);
    assert.equal(giftDescription('A. Tặng kèm bánh cưới và tháp ly. Giá B.', false), 'A. Giá B.');
    assert.equal(giftDescription('', true), '');
  });
});
