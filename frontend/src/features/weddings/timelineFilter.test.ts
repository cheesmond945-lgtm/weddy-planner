/*
 * Unit test cho timelineFilter.ts: "Việc của tôi" và câu nhắn soạn sẵn gửi NCC, chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chatDraft, matchesOwner } from './timelineFilter.ts'

type I = Parameters<typeof matchesOwner>[0]
const item = (extra: Partial<I>): I => ({ id: 'i', kind: 'TASK', title: 'Việc', dueDate: '2027-03-01', isDone: false, status: 'Todo', orderCode: null, ...extra }) as I

describe('"Việc của tôi" = khung + việc tự thêm + việc chi tiết đang Waiting', () => {
  const frame = item({ kind: 'TASK' })
  const choose = item({ kind: 'CHOOSE' })
  const book = item({ kind: 'CATEGORY_DEADLINE' })
  const waiting = item({ kind: 'SERVICE_TASK', status: 'Waiting', owner: 'CUSTOMER' })
  const vendorTodo = item({ kind: 'SERVICE_TASK', status: 'Todo', owner: 'VENDOR' })
  const bothTodo = item({ kind: 'SERVICE_TASK', status: 'Todo', owner: 'BOTH' })
  const done = item({ kind: 'SERVICE_TASK', status: 'Done', isDone: true, owner: 'CUSTOMER' })

  it('mine', () => {
    for (const i of [frame, choose, book, waiting]) assert.equal(matchesOwner(i, 'mine'), true, i.kind + i.status)
    for (const i of [vendorTodo, bothTodo, done]) assert.equal(matchesOwner(i, 'mine'), false, i.kind + i.status)
  })

  it('vendor (việc do NCC làm) là phần còn lại của việc chi tiết; all lấy hết', () => {
    for (const i of [vendorTodo, bothTodo, done]) assert.equal(matchesOwner(i, 'vendor'), true)
    for (const i of [frame, choose, book, waiting]) assert.equal(matchesOwner(i, 'vendor'), false)
    for (const i of [frame, waiting, vendorTodo]) assert.equal(matchesOwner(i, 'all'), true)
  })
})

describe('chatDraft', () => {
  it('việc chờ khách: gửi thông tin, có tên việc (cắt tại dấu hai chấm) và mã đơn', () => {
    const d = chatDraft({ title: 'Gửi ảnh tham khảo: các góc chụp', orderCode: 'DH01', status: 'Waiting' })
    assert.match(d, /gửi bạn thông tin cho việc "Gửi ảnh tham khảo" của đơn DH01/)
  })
  it('việc cùng NCC: hỏi lịch', () => {
    assert.match(chatDraft({ title: 'Thử váy', orderCode: null, status: 'Todo' }), /hẹn lịch cho việc "Thử váy", bên mình tiện ngày nào/)
  })
})
