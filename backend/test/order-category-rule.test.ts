/*
 * Luật "mỗi hạng mục tối đa MỘT đơn Deposited cùng lúc" (src/modules/orders/order-rules.ts), chạy bằng: npm test
 * Tái hiện lỗi đã gặp: chi.bui12 có DH26100010 đang Deposited mà vẫn cọc được DH26100024 / DH26100017 cùng hạng mục Trang trí.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { categoryTakenMessage, depositedConflict, type CategoryOrder } from '../src/modules/orders/order-rules.ts';

const DECOR = 'cat-decor';
const PHOTO = 'cat-photo';
const order = (id: string, status: string, categoryId: string, vendorName = 'Ha Vy Wedding & Event'): CategoryOrder => ({
  id,
  status,
  categoryId,
  code: id,
  vendorName,
  categoryName: categoryId === DECOR ? 'Trang trí' : 'Chụp ảnh',
});

describe('depositedConflict', () => {
  const orders = [order('DH26100010', 'Deposited', DECOR), order('DH26100030', 'Deposited', PHOTO), order('DH26100009', 'Completed', DECOR), order('DH26100016', 'Cancelled', DECOR)];

  it('đơn cùng hạng mục đã có đơn Deposited khác: bị chặn (lỗi đã gặp)', () => {
    assert.equal(depositedConflict(orders, DECOR, 'DH26100017')?.id, 'DH26100010');
    assert.equal(depositedConflict(orders, DECOR, 'DH26100024')?.id, 'DH26100010');
  });

  it('hạng mục khác không ảnh hưởng', () => {
    assert.equal(depositedConflict([order('DH26100010', 'Deposited', DECOR)], PHOTO, 'DH26100099'), undefined);
  });

  it('chính đơn đó (đã Deposited) không tự chặn mình', () => {
    assert.equal(depositedConflict([order('DH26100010', 'Deposited', DECOR)], DECOR, 'DH26100010'), undefined);
  });

  it('đơn Completed, Cancelled, Pending, Expired không giữ chỗ', () => {
    const others = ['Completed', 'Cancelled', 'Pending', 'Expired', 'NeedRevision', 'Draft'].map((s, i) => order(`X${i}`, s, DECOR));
    assert.equal(depositedConflict(others, DECOR, 'NEW'), undefined);
  });

  it('sau khi đơn Deposited bị hủy thì cọc / gửi đơn mới được', () => {
    assert.equal(depositedConflict([order('DH26100010', 'Cancelled', DECOR)], DECOR, 'DH26100017'), undefined);
  });

  it('hạng mục không xác định thì không chặn', () => {
    assert.equal(depositedConflict(orders, null, 'NEW'), undefined);
  });
});

describe('categoryTakenMessage', () => {
  const o = order('DH26100010', 'Deposited', DECOR);
  it('nói rõ đơn nào, NCC nào, hạng mục nào và việc cần làm', () => {
    const couple = categoryTakenMessage('COUPLE', o);
    assert.match(couple, /Trang trí/);
    assert.match(couple, /DH26100010/);
    assert.match(couple, /Ha Vy Wedding & Event/);
    assert.match(couple, /hủy đơn đó/);
    const vendor = categoryTakenMessage('VENDOR', o);
    assert.match(vendor, /Khách đã đặt cọc đơn DH26100010/);
    assert.match(vendor, /gửi đơn mới sau khi đơn đó được hủy/);
  });
});
