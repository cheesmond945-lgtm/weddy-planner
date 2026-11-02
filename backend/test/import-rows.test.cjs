/* Chuẩn hóa dữ liệu nhập Excel/CSV và CSV có BOM (import-rows.ts). Không cần DB. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const m = require('../dist/modules/weddings/import-rows');

test('số tiền nhận "5tr", "5 triệu", "500k", "1,5tr", "5.000.000đ"', () => {
  assert.equal(m.parseMoney('5tr'), 5_000_000);
  assert.equal(m.parseMoney('5 triệu'), 5_000_000);
  assert.equal(m.parseMoney('1,5tr'), 1_500_000);
  assert.equal(m.parseMoney('1.5 tr'), 1_500_000);
  assert.equal(m.parseMoney('500k'), 500_000);
  assert.equal(m.parseMoney('500 nghìn'), 500_000);
  assert.equal(m.parseMoney('2 tỷ'), 2_000_000_000);
  assert.equal(m.parseMoney('5.000.000đ'), 5_000_000);
  assert.equal(m.parseMoney('5,000,000 VND'), 5_000_000);
  assert.equal(m.parseMoney(3500000), 3_500_000);
  for (const bad of ['', 'abc', '0', '-5tr', '5.5', '5tr abc']) assert.equal(m.parseMoney(bad), null, bad);
});

test('ngày: ISO, ngày/tháng/năm, tháng/ngày/năm, serial Excel; ngày sai thì null', () => {
  assert.equal(m.parseDate('2027-03-15'), '2027-03-15');
  assert.equal(m.parseDate('15/03/2027'), '2027-03-15');
  assert.equal(m.parseDate('5-3-27'), '2027-03-05');
  assert.equal(m.parseDate('03/15/2027', 'MDY'), '2027-03-15');
  assert.equal(m.parseDate('03/15/2027'), null);
  assert.equal(m.parseDate('31/02/2027'), null);
  assert.equal(m.parseDate(46461), '2027-03-15');
  assert.equal(m.parseDate('hôm nay'), null);
});

test('chỉ cho chọn tháng/ngày/năm khi có số thứ hai > 12 và không số đầu nào > 12', () => {
  assert.equal(m.canBeMonthFirst(['03/15/2027', '04/01/2027']), true);
  assert.equal(m.canBeMonthFirst(['03/05/2027', '04/01/2027']), false);
  assert.equal(m.canBeMonthFirst(['03/15/2027', '20/01/2027']), false);
  assert.equal(m.canBeMonthFirst(['2027-03-15']), false);
});

test('khách: báo trùng trong file và với danh sách có sẵn, có phản hồi thì tính là đã mời', () => {
  const existing = new Set([m.guestKey('Trần Bình', 'Bride')]);
  const r = m.normalizeGuests(
    [
      { name: 'Nguyễn An', side: 'Nhà trai', group: 'bạn bè', partySize: '2', invited: '', rsvp: 'Sẽ đến' },
      { name: 'nguyen an', side: 'trai' },
      { name: 'Tran Binh', side: 'Nhà gái' },
      { name: 'Ai đó', side: 'hàng xóm' },
      { name: 'Chú Tư', side: 'CR', group: 'Hội đồng hương', partySize: '0' },
    ],
    existing,
  );
  assert.deepEqual(r[0].value, { fullName: 'Nguyễn An', side: 'Groom', group: 'Bạn bè', partySize: 2, isInvited: true, rsvp: 'Attending' });
  assert.equal(r[0].warnings.length, 1);
  assert.match(r[1].errors[0], /Trùng/);
  assert.match(r[2].errors[0], /Đã có/);
  assert.match(r[3].errors[0], /Không hiểu bên/);
  assert.match(r[4].errors.join(' '), /Số người/);
});

test('công việc: hạn phải từ hôm nay đến trước ngày cưới', () => {
  const opts = { dateOrder: 'DMY', today: '2026-10-29', weddingDate: '2027-05-01' };
  const r = m.normalizeTasks(
    [
      { title: 'Đặt thiệp', dueDate: '15/01/2027', note: 'màu kem' },
      { title: 'Muộn', dueDate: '02/05/2027' },
      { title: '', dueDate: '' },
    ],
    opts,
  );
  assert.deepEqual(r[0].value, { title: 'Đặt thiệp', dueDate: '2027-01-15', note: 'màu kem' });
  assert.match(r[1].errors[0], /trước ngày cưới/);
  assert.equal(r[2].errors.length, 2);
});

test('CSV có BOM, CRLF, bọc ngoặc kép và chặn công thức', () => {
  const s = m.toCsv(['Tên', 'Ghi chú'], [['An, Bình', 'nói "chào"'], ['=1+1', -5]]);
  assert.ok(s.startsWith('﻿'));
  assert.equal(s, '﻿Tên,Ghi chú\r\n"An, Bình","nói ""chào"""\r\n\'=1+1,-5\r\n');
});
