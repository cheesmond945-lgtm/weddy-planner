/*
 * Nhận diện loại hạng mục theo từ khóa, không phụ thuộc tên hiển thị (src/modules/catalog/category-kind.ts), chạy bằng: npm test.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { categoryKindOf, foldName } from '../src/modules/catalog/category-kind.ts';
import { serviceKeyOf } from '../src/modules/weddings/timeline-templates.ts';

describe('categoryKindOf', () => {
  it('tên CŨ và tên MỚI của trung tâm tiệc cưới đều là nha-hang (kể cả hoa/thường, thiếu dấu)', () => {
    for (const n of ['Trung tâm tổ chức sự kiện', 'Trung tâm tiệc cưới', 'trung tam tiec cuoi', 'TRUNG TÂM TIỆC CƯỚI', 'Nhà hàng', 'Sảnh tiệc', 'Trung tâm tiệc cưới & sự kiện']) {
      assert.equal(categoryKindOf(n), 'nha-hang', n);
    }
  });

  it('các hạng mục khác, tên hiện tại trong CSDL', () => {
    assert.equal(categoryKindOf('Chụp ảnh'), 'chup-anh');
    assert.equal(categoryKindOf('Quay phim'), 'chup-anh');
    assert.equal(categoryKindOf('Chụp ảnh & quay phim'), 'chup-anh');
    assert.equal(categoryKindOf('Trang phục'), 'trang-phuc');
    assert.equal(categoryKindOf('Váy cưới'), 'trang-phuc');
    assert.equal(categoryKindOf('Trang trí'), 'decor');
    assert.equal(categoryKindOf('Decor'), 'decor');
    assert.equal(categoryKindOf('Trang điểm'), 'makeup');
    assert.equal(categoryKindOf('Makeup'), 'makeup');
    assert.equal(categoryKindOf('Make up'), 'makeup');
    assert.equal(categoryKindOf('Hoa cưới'), 'hoa-cuoi');
  });

  it('loại cụ thể thắng từ khóa chung: "Trang trí sảnh tiệc cưới" là decor, "Hoa cưới" không bị "cưới" kéo sang nhà hàng', () => {
    assert.equal(categoryKindOf('Trang trí sảnh tiệc cưới'), 'decor');
    assert.equal(categoryKindOf('Hoa cưới'), 'hoa-cuoi');
    assert.equal(categoryKindOf('Trang điểm cô dâu'), 'makeup');
  });

  it('không khớp hoặc rỗng: undefined (không ném lỗi)', () => {
    assert.equal(categoryKindOf('Xe hoa'), 'hoa-cuoi'); // "hoa" là từ khóa; ghi nhận hành vi hiện tại
    assert.equal(categoryKindOf('Âm thanh ánh sáng'), undefined);
    assert.equal(categoryKindOf(''), undefined);
    assert.equal(categoryKindOf(null), undefined);
    assert.equal(categoryKindOf({ name: 'Trung tâm tiệc cưới' }), 'nha-hang');
  });

  it('mẫu timeline dùng cùng hàm: tên cũ và mới đều ra nha-hang', () => {
    assert.equal(serviceKeyOf('Trung tâm tổ chức sự kiện'), 'nha-hang');
    assert.equal(serviceKeyOf('Trung tâm tiệc cưới'), 'nha-hang');
    assert.equal(serviceKeyOf('Trang điểm'), 'makeup');
    assert.equal(serviceKeyOf(undefined), undefined);
  });

  it('foldName bỏ dấu, đ -> d, viết thường', () => {
    assert.equal(foldName('  Đồ  Cưới '), 'do cuoi');
  });
});
