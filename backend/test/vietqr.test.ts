import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commissionContent, commissionMatchContents, depositContent, depositMatchContents, matchKey, normalizeContent, MAX_CONTENT_LENGTH } from '../src/integrations/vietqr/vietqr.ts';

describe('nội dung chuyển khoản VietQR (thương hiệu Forever)', () => {
  const ORDER = 'DH26110002';
  const STATEMENT = '1a2b3c4d-1111-2222-3333-444455556666';

  it('cọc dùng tiền tố FOREVER, hoa hồng dùng FOREVERHH, đều không quá 25 ký tự', () => {
    assert.equal(depositContent(ORDER), 'SEVQR FOREVERDH26110002');
    assert.equal(commissionContent(STATEMENT), 'SEVQR FOREVERHH1A2B3C4D');
    assert.ok(depositContent(ORDER).length <= MAX_CONTENT_LENGTH);
    assert.ok(commissionContent(STATEMENT).length <= MAX_CONTENT_LENGTH);
  });

  it('đối soát nhận cả nội dung theo tiền tố cũ (EVERLY, EVHH) để QR cũ vẫn khớp', () => {
    assert.deepEqual(depositMatchContents(ORDER).map(matchKey), ['FOREVERDH26110002', 'EVERLYDH26110002']);
    assert.deepEqual(commissionMatchContents(STATEMENT).map(matchKey), ['FOREVERHH1A2B3C4D', 'EVHH1A2B3C4D']);
  });

  it('ngân hàng chèn dấu cách / ký tự lạ vẫn khớp; cọc và hoa hồng không lẫn nhau', () => {
    const bank = normalizeContent('MBVCB.123.SEVQR FOREVER DH26110002.CT tu ABC');
    assert.ok(depositMatchContents(ORDER).map(matchKey).some((k) => bank.includes(k)));
    assert.ok(!commissionMatchContents(STATEMENT).map(matchKey).some((k) => bank.includes(k)));
    const old = normalizeContent('SEVQR EVERLYDH26110002');
    assert.ok(depositMatchContents(ORDER).map(matchKey).some((k) => old.includes(k)));
  });
});
