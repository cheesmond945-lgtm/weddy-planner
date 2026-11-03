/*
 * Unit test cho datePicker.ts (ô ngày của popover Đổi ngày), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canGoNext, canGoPrev, pickerDays, placePopover } from './datePicker.ts'

const opts = { value: '2027-05-25', today: '2027-05-10', eventDate: '2027-05-20', min: '2027-05-10', max: '2027-09-17' }
const byDate = (d: ReturnType<typeof pickerDays>, date: string) => d.find((x) => x.date === date)!

describe('pickerDays', () => {
  const days = pickerDays('2027-05', opts)

  it('lưới đủ tuần, bắt đầu thứ Hai: tháng 5/2027 mùng 1 là Chủ nhật nên đệm 6 ô đầu', () => {
    assert.equal(days.length % 7, 0)
    assert.equal(days[0].date, '2027-04-26')
    assert.equal(days[0].inMonth, false)
    assert.equal(days[6].date, '2027-05-02')
    assert.equal(byDate(days, '2027-05-01').inMonth, true)
  })

  it('đánh dấu ngày hiện tại của việc (tô đặc), hôm nay (viền), ngày thực hiện (chấm)', () => {
    assert.equal(byDate(days, '2027-05-25').selected, true)
    assert.equal(days.filter((d) => d.selected).length, 1)
    assert.equal(byDate(days, '2027-05-10').isToday, true)
    assert.equal(byDate(days, '2027-05-20').isEvent, true)
    assert.equal(days.filter((d) => d.isEvent).length, 1)
  })

  it('trước hôm nay bị mờ; từ hôm nay trở đi chọn được; sau ngày thực hiện + 120 bị mờ', () => {
    assert.equal(byDate(days, '2027-05-09').disabled, true)
    assert.equal(byDate(days, '2027-05-10').disabled, false)
    const sep = pickerDays('2027-09', opts)
    assert.equal(byDate(sep, '2027-09-17').disabled, false)
    assert.equal(byDate(sep, '2027-09-18').disabled, true)
  })

  it('không biết ngày thực hiện: không có chấm, không giới hạn ngày muộn', () => {
    const d = pickerDays('2028-01', { ...opts, eventDate: '', max: undefined })
    assert.equal(d.some((x) => x.isEvent), false)
    assert.equal(d.some((x) => x.disabled && x.date > opts.min), false)
  })

  it('ô đệm của tháng khác vẫn có thể chọn được nếu trong khoảng cho phép', () => {
    const pad = byDate(days, '2027-06-01')
    assert.equal(pad.inMonth, false)
    assert.equal(pad.disabled, false)
  })
})

describe('chuyển tháng', () => {
  it('không lùi quá tháng của hôm nay; không tiến quá tháng của ngày muộn nhất', () => {
    assert.equal(canGoPrev('2027-05', '2027-05-10'), false)
    assert.equal(canGoPrev('2027-06', '2027-05-10'), true)
    assert.equal(canGoNext('2027-09', '2027-09-17'), false)
    assert.equal(canGoNext('2027-08', '2027-09-17'), true)
    assert.equal(canGoNext('2030-01', undefined), true)
  })
})

/*
 * Lịch mở trong hộp thoại "Chi tiết đơn": Radix Dialog modal đặt body { pointer-events: none }, popover portal ra body nên phải tự đặt pointer-events: auto
 * (DatePickPopover.tsx), nếu không bấm xuyên qua. Phần vị trí kiểm ở đây; phần bấm được kiểm thủ công (xem báo cáo).
 */
describe('placePopover (lịch mở trong hộp thoại / thẻ hẹp)', () => {
  const view = { width: 1000, height: 700 }
  const size = { width: 280, height: 340 }

  it('mép phải lịch thẳng mép phải nút, mở xuống khi đủ chỗ', () => {
    assert.deepEqual(placePopover({ top: 100, bottom: 126, right: 600 }, view, size), { top: 132, left: 320 })
  })

  it('gần mép dưới thì lật lên trên nút', () => {
    assert.equal(placePopover({ top: 600, bottom: 626, right: 600 }, view, size).top, 600 - 340 - 6)
  })

  it('không đủ chỗ cả hai phía thì mở xuống', () => {
    assert.equal(placePopover({ top: 150, bottom: 176, right: 600 }, { width: 1000, height: 400 }, size).top, 182)
  })

  it('nút sát mép màn hình: kẹp lại, không tràn ra ngoài', () => {
    assert.equal(placePopover({ top: 0, bottom: 26, right: 100 }, view, size).left, 8)
    assert.equal(placePopover({ top: 0, bottom: 26, right: 5000 }, view, size).left, 1000 - 280 - 8)
  })
})
