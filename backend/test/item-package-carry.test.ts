/*
 * Sửa sau cọc: gói của dòng theo NCC gửi lên (NCC đổi được gói khi khách muốn đổi; việc chi tiết đổi theo ở packageSwitchPlan,
 * test/package-switch.test.ts). Dòng gắn sảnh cũ đổi theo sảnh mới. Chạy bằng: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { carryItemPackages, parseContent } from '../src/modules/orders/order-rules.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const I1 = '11111111-1111-4111-8111-111111111111';
const I2 = '22222222-2222-4222-8222-222222222222';
const current = [
  { id: I1, packageId: A },
  { id: I2, packageId: null },
];

describe('carryItemPackages', () => {
  it('đổi tên dòng gắn gói vẫn giữ gói (client gửi kèm gói của dòng)', () => {
    const out = carryItemPackages([{ id: I1, itemName: 'Tên hoàn toàn mới', packageId: A }], current);
    assert.equal(out[0].packageId, A);
  });
  it('NCC đổi gói của dòng sau cọc: theo gói client gửi', () => {
    assert.equal(carryItemPackages([{ id: I2, packageId: B }], current)[0].packageId, B);
    assert.equal(carryItemPackages([{ id: I1, packageId: B }], current)[0].packageId, B);
    assert.equal(carryItemPackages([{ id: I1, packageId: null }], current)[0].packageId, null);
  });
  it('dòng mới gắn gói được', () => {
    const out = carryItemPackages([{ packageId: A }, { packageId: null }], current);
    assert.deepEqual(out.map((x) => x.packageId), [A, null]);
  });
  it('đổi sảnh: dòng đang gắn sảnh cũ chuyển sang sảnh mới, dòng gắn gói khác giữ nguyên', () => {
    const cur = [{ id: I1, packageId: A }, { id: I2, packageId: B }];
    const out = carryItemPackages([{ id: I1, packageId: A }, { id: I2, packageId: B }], cur, { from: A, to: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });
    assert.deepEqual(out.map((x) => x.packageId), ['cccccccc-cccc-4ccc-8ccc-cccccccccccc', B]);
  });
  it('giữ nguyên sảnh: không đổi gì', () => {
    assert.equal(carryItemPackages([{ id: I1, packageId: A }], current, { from: A, to: A })[0].packageId, A);
  });
});

describe('parseContent giữ id dòng và gói của dòng', () => {
  const base = { customerName: 'A', customerPhone: '0900000000', eventDate: '2099-01-01', depositPercent: 30 };
  it('id hợp lệ được giữ, id sai định dạng thành null; trước cọc đổi tên vẫn giữ packageId do client gửi', () => {
    const p = parseContent({ ...base, items: [{ id: I1, itemName: 'Đổi tên', quantity: 1, unitPrice: 1_000_000, packageId: A }, { id: 'xyz', itemName: 'Khác', quantity: 1, unitPrice: 1, packageId: B }] }, 'send');
    assert.equal(p.items[0].id, I1);
    assert.equal(p.items[0].packageId, A);
    assert.equal(p.items[1].id, null);
    assert.equal(p.items[1].packageId, B);
  });
});
