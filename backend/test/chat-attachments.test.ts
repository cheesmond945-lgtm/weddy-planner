/*
 * Tệp đính kèm trong chat (src/modules/chat/chat-attachments.ts): kiểu tệp cho phép, loại tin, nhãn. Hàm thuần, không đụng CSDL.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attachmentLabel, extOfMime, kindOfMime, normalizeMime, parseDuration } from '../src/modules/chat/chat-attachments.ts';

describe('normalizeMime', () => {
  it('bỏ tham số codecs của ghi âm trình duyệt', () => {
    assert.equal(normalizeMime('audio/webm;codecs=opus', 'voice.webm'), 'audio/webm');
  });
  it('tên khác về tên chuẩn; thiếu kiểu thì đoán theo đuôi', () => {
    assert.equal(normalizeMime('audio/x-m4a', 'a.m4a'), 'audio/mp4');
    assert.equal(normalizeMime('application/octet-stream', 'Báo giá.xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
  it('chặn tệp chạy được / không nằm trong danh sách', () => {
    assert.equal(normalizeMime('application/x-msdownload', 'setup.exe'), null);
    assert.equal(normalizeMime('', 'script.js'), null);
  });
});

describe('kindOfMime / attachmentLabel / extOfMime / parseDuration', () => {
  it('ảnh, ghi âm, còn lại là tệp (kể cả video)', () => {
    assert.deepEqual(['image/png', 'audio/ogg', 'video/mp4', 'application/pdf'].map(kindOfMime), ['Image', 'Audio', 'File', 'File']);
  });
  it('nhãn tin cuối', () => {
    assert.equal(attachmentLabel('Image', 'a.png'), '📷 Ảnh');
    assert.equal(attachmentLabel('File', 'Hợp đồng.pdf'), '📎 Hợp đồng.pdf');
  });
  it('đuôi tệp: giữ đuôi gốc nếu khớp kiểu, không thì lấy theo kiểu', () => {
    assert.equal(extOfMime('image/jpeg', 'anh.JPEG'), 'jpeg');
    assert.equal(extOfMime('audio/webm', 'blob'), 'webm');
  });
  it('độ dài ghi âm', () => {
    assert.equal(parseDuration('12.4'), 12);
    assert.equal(parseDuration('abc'), null);
    assert.equal(parseDuration(9999), 300);
  });
});
