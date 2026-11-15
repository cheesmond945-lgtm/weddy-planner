/*
 * Đổi ngày cưới: đơn nào bị ảnh hưởng (src/modules/weddings/timeline-rules.ts dateChangeIssue), chạy bằng: npm test
 * Quy tắc nhóm chốt: đã cọc tiệc thì chặn đổi ngày cưới; đơn làm đúng ngày cưới cũ thì gửi yêu cầu đổi ngày cho NCC.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { customerDateWarning, dateChangeIssue } from '../src/modules/weddings/timeline-rules.ts';

const OLD = '2026-11-13';
const NEW = '2026-12-05';
const order = (o: { status: string; eventDate: string; venue?: boolean }) => ({ orderCode: 'DH1', vendorName: 'NCC', ...o });

describe('dateChangeIssue', () => {
  it('đã cọc tiệc cưới ngày cũ: chặn đổi (VENUE_LOCKED)', () => {
    const issue = dateChangeIssue(order({ status: 'Deposited', eventDate: OLD, venue: true }), NEW, OLD);
    assert.equal(issue?.kind, 'VENUE_LOCKED');
    assert.equal(issue?.blocksChange, true);
  });

  it('đổi ngày cưới sang đúng ngày tiệc đã cọc: không chặn', () => {
    assert.equal(dateChangeIssue(order({ status: 'Deposited', eventDate: NEW, venue: true }), NEW, OLD), null);
  });

  it('tiệc chưa cọc: không chặn', () => {
    assert.equal(dateChangeIssue(order({ status: 'Pending', eventDate: OLD, venue: true }), NEW, OLD), null);
  });

  it('dịch vụ khác đã cọc, đúng ngày cưới cũ: WEDDING_DAY, không chặn', () => {
    const issue = dateChangeIssue(order({ status: 'Deposited', eventDate: OLD }), NEW, OLD);
    assert.equal(issue?.kind, 'WEDDING_DAY');
    assert.equal(issue?.blocksChange, false);
    assert.match(customerDateWarning(order({ status: 'Deposited', eventDate: OLD }), issue!, NEW), /yêu cầu đổi ngày thực hiện sang 05\/12\/2026/);
  });

  it('dịch vụ làm trước ngày cưới (chụp ngoại cảnh): chỉ nhắc (DIFFERENT)', () => {
    assert.equal(dateChangeIssue(order({ status: 'Deposited', eventDate: '2026-10-20' }), NEW, OLD)?.kind, 'DIFFERENT');
  });

  it('dời ngày cưới sớm hơn, đơn sau ngày cưới mới: AFTER_WEDDING', () => {
    assert.equal(dateChangeIssue(order({ status: 'Deposited', eventDate: '2026-12-20' }), NEW, OLD)?.kind, 'AFTER_WEDDING');
  });

  it('không biết ngày cưới cũ: giữ cách cũ (DIFFERENT)', () => {
    assert.equal(dateChangeIssue(order({ status: 'Deposited', eventDate: OLD }), NEW)?.kind, 'DIFFERENT');
  });

  it('đơn đã hoàn thành / hủy: không ảnh hưởng', () => {
    assert.equal(dateChangeIssue(order({ status: 'Completed', eventDate: OLD, venue: true }), NEW, OLD), null);
    assert.equal(dateChangeIssue(order({ status: 'Cancelled', eventDate: OLD }), NEW, OLD), null);
  });
});
