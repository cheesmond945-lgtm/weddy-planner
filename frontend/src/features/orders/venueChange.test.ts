/*
 * Unit test cho venueChange.ts (yêu cầu chỉnh sửa đơn tiệc cưới), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { estimateTotal, hallOption, sortHalls, tableRange, venueChanges, venueNote, venueNotices, type VenueCurrent } from './venueChange.ts'

const cur: VenueCurrent = { hallId: 'xanh', date: '2027-03-24', tables: 35, otherFixed: 0, otherPerTable: 0, total: 210_000_000, deposit: 63_000_000, weddingDate: '2027-03-24', guestCount: 300 }
const goAmAp = { id: 'go', name: 'Sảnh Gỗ Ấm Áp', price: 5_800_000, capacity: 400, minTables: 20 }
const ngoaiTroi = { id: 'nt', name: 'Lễ Đường Ngoài Trời', price: 5_500_000, capacity: 300, minTables: null }
const hoaHong = { id: 'hh', name: 'Sảnh Hoa Hồng', price: 6_200_000, capacity: 600, minTables: 40 }
const fmt = (n: number) => `${n.toLocaleString('vi-VN')}đ`

describe('hallOption: các trường hợp chính', () => {
  it('1. giữ sảnh, đổi số bàn trong khoảng: chọn được', () => {
    assert.equal(hallOption(goAmAp, 30, false).ok, true)
  })
  it('2-3. sảnh khác, kín ngày đó: không chọn được', () => {
    assert.equal(hallOption(goAmAp, 30, true).reason, 'đã kín ngày này')
  })
  it('vượt sức chứa (tính theo bàn)', () => {
    assert.equal(hallOption(ngoaiTroi, 35, false).reason, 'chỉ chứa tối đa 30 bàn')
  })
  it('dưới số bàn tối thiểu', () => {
    assert.equal(hallOption(hoaHong, 35, false).reason, 'tối thiểu 40 bàn')
  })
  it('8. sảnh đang dùng, giữ đúng số bàn cũ: hợp lệ dù nay dưới tối thiểu', () => {
    const keep = { currentHallId: 'hh', currentTables: 35 }
    assert.equal(hallOption(hoaHong, 35, false, keep).ok, true)
    assert.equal(hallOption(hoaHong, 36, false, keep).reason, 'tối thiểu 40 bàn')
    assert.equal(hallOption(hoaHong, 35, true, keep).reason, 'đã kín ngày này')
  })
})

describe('hiển thị theo bàn và sắp xếp', () => {
  it('khoảng số bàn', () => {
    assert.equal(tableRange(goAmAp), '20 – 40 bàn')
    assert.equal(tableRange(ngoaiTroi), 'tối đa 30 bàn')
    assert.equal(tableRange({ id: 'x', name: 'x', price: 1 }), null)
  })
  it('19. đang dùng trước, chọn được, không chọn được ở cuối', () => {
    const halls = [ngoaiTroi, goAmAp, { id: 'xanh', name: 'Xanh', price: 6_000_000 }, hoaHong]
    const ok = (h: { id: string }) => h.id === 'go'
    assert.deepEqual(sortHalls(halls, 'xanh', ok).map((h) => h.id), ['xanh', 'go', 'nt', 'hh'])
  })
})

describe('tạm tính, cảnh báo, lời nhắn', () => {
  it('16. dòng khác tính theo bàn nhân theo số bàn mới', () => {
    assert.equal(estimateTotal(goAmAp, 30, { ...cur, otherPerTable: 1_000_000, otherFixed: 5_000_000 }), 30 * 6_800_000 + 5_000_000)
  })
  it('15. tạm tính thấp hơn cọc: chặn', () => {
    const n = venueNotices(cur, { hallId: 'go', date: cur.date, tables: 10 }, 58_000_000, fmt)
    assert.equal(n[0].level, 'error')
  })
  it('10. đổi ngày khác ngày cưới: nhắc đổi ngày cưới', () => {
    const n = venueNotices(cur, { hallId: 'xanh', date: '2027-01-04', tables: 35 }, null, fmt)
    assert.match(n[0].text, /Ngày cưới của bạn đang là 24\/03\/2027/)
  })
  it('7. số bàn ít hơn số khách dự kiến: chỉ nhắc', () => {
    const n = venueNotices(cur, { hallId: 'xanh', date: cur.date, tables: 25 }, 150_000_000, fmt)
    assert.deepEqual(n.map((x) => x.level), ['warn'])
  })
  it('tự đánh dấu loại thay đổi', () => {
    assert.deepEqual(venueChanges(cur, { hallId: 'go', date: '2027-03-24', tables: 30 }), ['Item', 'Quantity'])
    assert.deepEqual(venueChanges(cur, { ...cur }), [])
  })
  it('lời nhắn chỉ ghi phần đã đổi, ghi rõ giá niêm yết; 12. chưa kiểm tra được lịch', () => {
    assert.equal(venueNote(cur, { hallId: 'go', date: '2027-03-25', tables: 30 }, goAmAp, fmt), 'Đổi sang Sảnh Gỗ Ấm Áp; 35 → 30 bàn; dời ngày 24/03/2027 → 25/03/2027; tạm tính 174.000.000đ (giá niêm yết)')
    assert.match(venueNote(cur, { hallId: 'xanh', date: '2027-03-25', tables: 35 }, undefined, fmt, true), /chưa kiểm tra được lịch sảnh/)
  })
})
