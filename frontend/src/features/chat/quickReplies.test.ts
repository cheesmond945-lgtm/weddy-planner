import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { quickReplies } from './quickReplies.ts'

const labels = (order: Parameters<typeof quickReplies>[0]['order'], categorySlug = 'nha-hang') => quickReplies({ order, categorySlug }).map((c) => c.label)

describe('quickReplies', () => {
  it('chưa có đơn: chi phí phát sinh, ưu đãi, lịch trống; tiệc thì đặt lịch tham quan, hạng mục khác xin ảnh thực tế', () => {
    assert.deepEqual(labels(null), ['Hỏi chi phí phát sinh', 'Hỏi ưu đãi', 'Hỏi lịch trống', 'Đặt lịch tham quan'])
    assert.deepEqual(labels(null, 'decor'), ['Hỏi chi phí phát sinh', 'Hỏi ưu đãi', 'Hỏi lịch trống', 'Xin ảnh thực tế'])
  })

  it('đã cọc: không còn hỏi giá / lịch trống, chuyển sang chốt chi tiết ngày cưới', () => {
    const l = labels({ orderCode: 'DH1', status: 'Deposited' })
    assert.deepEqual(l, ['Hẹn lịch trao đổi', 'Chốt chi tiết ngày cưới', 'Hỏi phần còn lại'])
  })

  it('chờ cọc nhắc mã đơn; hết hạn có "Gửi lại đơn"; hoàn thành chụp ảnh có hỏi ngày nhận ảnh', () => {
    assert.ok(quickReplies({ order: { orderCode: 'DH9', status: 'Pending' }, categorySlug: 'decor' }).every((c) => c.text.includes('DH9')))
    assert.equal(labels({ orderCode: 'DH2', status: 'Expired' })[0], 'Gửi lại đơn')
    assert.ok(labels({ orderCode: 'DH3', status: 'Completed' }, 'chup-anh').includes('Hỏi ngày nhận ảnh'))
  })
})
