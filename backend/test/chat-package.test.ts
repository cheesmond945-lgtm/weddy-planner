/*
 * Nội dung tin Package (thẻ gói trong chat) (src/modules/chat/chat-package.ts), chạy bằng: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPackageMessage, packageContent, parsePackageContent, readableContent } from '../src/modules/chat/chat-package.ts';

const ID = '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f809a1b';

describe('tin Package', () => {
  it('ghi rồi đọc lại đúng id và tên gói (tên có dấu cách)', () => {
    assert.deepEqual(parsePackageContent(packageContent(ID, 'Sảnh Ivory Nến Lung Linh')), { id: ID, name: 'Sảnh Ivory Nến Lung Linh' });
  });

  it('content không đúng dạng: không có id, tên là cả content', () => {
    assert.deepEqual(parsePackageContent('pkg:không-phải-uuid Gói A'), { id: null, name: 'pkg:không-phải-uuid Gói A' });
    assert.deepEqual(parsePackageContent(null), { id: null, name: '' });
  });

  it('thẻ gói lưu là tin Text (CSDL chỉ cho các loại tin cố định), nhận ra theo nội dung', () => {
    assert.equal(isPackageMessage('Text', packageContent(ID, 'Gói A')), true);
    assert.equal(isPackageMessage('Text', 'pkg:' + ID + 'Gói A'), false);
    assert.equal(isPackageMessage('Image', packageContent(ID, 'Gói A')), false);
  });

  it('nội dung đọc được: tin Package thành "Gói <tên>", tin khác giữ nguyên', () => {
    assert.equal(readableContent('Text', packageContent(ID, 'Sảnh Song Hỷ')), 'Gói Sảnh Song Hỷ');
    assert.equal(readableContent('Text', 'pkg:abc xin chào'), 'pkg:abc xin chào');
  });
});
