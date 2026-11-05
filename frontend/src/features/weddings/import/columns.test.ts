/*
 * Unit test cho columns.ts (ghép cột khi nhập Excel/CSV), chạy bằng test runner có sẵn của Node:
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { autoMap, canBeMonthFirst, mapRows } from './columns.ts'

describe('autoMap', () => {
  it('ghép theo từ đồng nghĩa, bỏ dấu và hoa thường', () => {
    assert.deepEqual(autoMap(['CÔNG VIỆC', 'hạn chót', 'Cột lạ'], 'tasks'), { title: 0, dueDate: 1, note: null })
  })

  it('mỗi cột chỉ dùng cho một trường, khớp đúng được ưu tiên hơn khớp đầu chữ', () => {
    // "Chi phí" là từ đồng nghĩa của cả Khoản chi và Số tiền: cột "Số tiền" khớp đúng nên Số tiền lấy cột đó
    assert.deepEqual(autoMap(['Chi phí', 'Số tiền'], 'expenses'), { title: 0, amount: 1 })
    assert.deepEqual(autoMap(['Hạn hoàn thành (dd/mm/yyyy)', 'Việc'], 'tasks'), { title: 1, dueDate: 0, note: null })
  })

  it('file mẫu và file tải về tự ghép đủ cột', () => {
    assert.deepEqual(autoMap(['Khoản chi', 'Số tiền'], 'expenses'), { title: 0, amount: 1 })
    assert.deepEqual(autoMap(['Việc', 'Hạn', 'Ghi chú', 'Hạng mục'], 'tasks'), { title: 0, dueDate: 1, note: 2 })
  })
})

describe('mapRows', () => {
  it('lấy chữ trong ô theo cách ghép, cột không ghép là chuỗi rỗng', () => {
    assert.deepEqual(mapRows([[' An ', 5, null]], { title: 0, amount: 1, extra: null }), [{ title: 'An', amount: '5', extra: '' }])
  })
})

describe('canBeMonthFirst', () => {
  it('chỉ cho chọn khi có số thứ hai > 12 và không số đầu nào > 12', () => {
    assert.equal(canBeMonthFirst(['03/15/2027', '04/01/2027']), true)
    assert.equal(canBeMonthFirst(['03/05/2027']), false)
    assert.equal(canBeMonthFirst(['03/15/2027', '20/01/2027']), false)
  })
})
