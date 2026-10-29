/*
 * Unit test cho timelineGroups.ts (cách xem THEO THỜI GIAN), chạy bằng test runner có sẵn của Node: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { countServices, groupByTime } from './timelineGroups.ts'

type Item = Parameters<typeof groupByTime>[0][number]
const item = (id: string, dueDate: string, extra: Partial<Item> = {}): Item =>
  ({ id, kind: 'TASK', title: id, dueDate, isDone: false, isCustom: false, category: null, ...extra }) as unknown as Item
const cat = (slug: string) => ({ id: slug, slug, name: slug })

describe('groupByTime', () => {
  const today = '2026-10-29'

  it('sắp theo hạn tăng dần, cùng hạn giữ thứ tự cũ (thứ tự mẫu)', () => {
    const groups = groupByTime([item('c', '2026-12-05'), item('a1', '2026-11-02'), item('a2', '2026-11-02'), item('b', '2026-11-20')], today)
    assert.deepEqual(groups.flatMap((g) => g.items.map((i) => i.id)), ['a1', 'a2', 'b', 'c'])
  })

  it('chia nhóm theo tháng với tiêu đề "Tháng m/yyyy"', () => {
    const groups = groupByTime([item('a', '2026-11-02'), item('b', '2026-11-30'), item('c', '2026-12-01'), item('d', '2027-01-15')], today)
    assert.deepEqual(groups.map((g) => [g.title, g.items.length]), [['Tháng 11/2026', 2], ['Tháng 12/2026', 1], ['Tháng 1/2027', 1]])
  })

  it('việc quá hạn (chưa xong, hạn trước hôm nay) gom vào "Quá hạn" trên cùng', () => {
    const groups = groupByTime([item('ok', '2026-11-02'), item('late2', '2026-10-12'), item('late1', '2026-10-01'), item('today', '2026-10-29')], today)
    assert.equal(groups[0].title, 'Quá hạn')
    assert.deepEqual(groups[0].items.map((i) => i.id), ['late1', 'late2'])
    assert.deepEqual(groups.slice(1).flatMap((g) => g.items.map((i) => i.id)), ['today', 'ok']) // hạn đúng hôm nay chưa quá hạn
  })

  it('việc đã xong không vào "Quá hạn" dù hạn đã qua', () => {
    const groups = groupByTime([item('done', '2026-10-01', { isDone: true }), item('late', '2026-10-02')], today)
    assert.deepEqual(groups.map((g) => [g.key, g.items.map((i) => i.id)]), [['overdue', ['late']], ['2026-10', ['done']]])
  })

  it('việc của nhiều dịch vụ đan xen trong cùng một danh sách', () => {
    const groups = groupByTime(
      [item('v1', '2026-11-02', { category: cat('nha-hang') }), item('d1', '2026-11-03', { category: cat('decor') }), item('v2', '2026-11-04', { category: cat('nha-hang') }), item('p1', '2026-11-05', { category: cat('chup-anh') })],
      today,
    )
    assert.equal(groups.length, 1)
    assert.deepEqual(groups[0].items.map((i) => i.category!.slug), ['nha-hang', 'decor', 'nha-hang', 'chup-anh'])
  })

  it('danh sách rỗng: không có nhóm', () => {
    assert.deepEqual(groupByTime([], today), [])
  })
})

describe('countServices', () => {
  it('đếm số hạng mục khác nhau, bỏ qua việc không thuộc hạng mục', () => {
    assert.equal(countServices([item('a', '2026-11-01', { category: cat('decor') }), item('b', '2026-11-02', { category: cat('decor') }), item('c', '2026-11-03', { category: cat('hoa-cuoi') }), item('d', '2026-11-04')]), 2)
  })
})
