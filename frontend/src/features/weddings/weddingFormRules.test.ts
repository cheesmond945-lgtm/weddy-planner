/*
 * Unit test cho weddingFormRules.ts (form thông tin đám cưới), chạy bằng test runner có sẵn của Node:
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateWeddingForm, type WeddingFormValues } from './weddingFormRules.ts'

const TODAY = '2026-11-02'
const valid: WeddingFormValues = {
  brideName: 'Lan',
  groomName: 'Minh',
  date: '2027-05-20',
  ward: 'Phường Cầu Giấy',
  guestCount: '300',
  budget: 300_000_000,
  services: ['trang-tri'],
}

describe('validateWeddingForm', () => {
  it('form hợp lệ: không có lỗi', () => {
    assert.deepEqual(validateWeddingForm(valid, TODAY), {})
  })

  it('ngày trong quá khứ hoặc hôm nay: báo lỗi ngày', () => {
    assert.equal(validateWeddingForm({ ...valid, date: '2026-10-01' }, TODAY).date, 'Ngày tổ chức phải sau hôm nay.')
    assert.equal(validateWeddingForm({ ...valid, date: TODAY }, TODAY).date, 'Ngày tổ chức phải sau hôm nay.')
    assert.equal(validateWeddingForm({ ...valid, date: '' }, TODAY).date, 'Vui lòng chọn ngày tổ chức.')
  })

  it('ngân sách 0: báo lỗi ngân sách', () => {
    assert.equal(validateWeddingForm({ ...valid, budget: 0 }, TODAY).budget, 'Vui lòng nhập tổng ngân sách lớn hơn 0.')
    assert.ok(validateWeddingForm({ ...valid, budget: -5 }, TODAY).budget)
  })

  it('chưa chọn khu vực: báo lỗi khu vực', () => {
    assert.equal(validateWeddingForm({ ...valid, ward: '' }, TODAY).ward, 'Vui lòng chọn nơi tổ chức.')
  })

  it('số khách rỗng / 0 / không phải số: báo lỗi', () => {
    for (const guestCount of ['', '0', 'abc']) assert.ok(validateWeddingForm({ ...valid, guestCount }, TODAY).guestCount, guestCount)
  })

  it('không chọn dịch vụ nào: báo lỗi', () => {
    assert.ok(validateWeddingForm({ ...valid, services: [] }, TODAY).services)
  })
})
