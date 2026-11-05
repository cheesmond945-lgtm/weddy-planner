import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyHall, hallFieldState, hallLine, hallLineIndex, hallTablesError, needsNoPackageConfirm, packageNote, suggestPackage, type LinkPackage } from './orderLines.ts'

const hall = (id: string, name: string, price: number, minTables: number | null = null, taskCount = 7): LinkPackage => ({ id, name, price, unit: 'Bàn', taskCount, minTables })
const pkg = (id: string, name: string, price = 5_000_000, taskCount = 4): LinkPackage => ({ id, name, price, unit: 'Gói', taskCount })
const line = (key: string, name: string, extra: Record<string, unknown> = {}) => ({ key, itemName: name, unit: 'Gói' as const, quantity: 1, unitPrice: 0, ...extra })

const vang = hall('h1', 'Sảnh Vàng Cánh Bướm', 4_000_000, 20)
const bac = hall('h2', 'Sảnh Bạc', 3_500_000, null)

describe('applyHall: tự tạo / cập nhật dòng sảnh', () => {
  it('đơn mới chỉ có dòng trống: chọn sảnh biến dòng trống thành dòng sảnh (Bàn, giá, số bàn tối thiểu)', () => {
    const out = applyHall([line('a', '')], vang, null, 'new')
    assert.equal(out.length, 1)
    assert.deepEqual([out[0].itemName, out[0].unit, out[0].quantity, out[0].unitPrice, out[0].packageId, out[0].key], ['Sảnh Vàng Cánh Bướm', 'Bàn', 20, 4_000_000, 'h1', 'a'])
  })
  it('đã có dòng tự nhập: dòng sảnh chèn lên đầu, dòng tự nhập giữ nguyên', () => {
    const out = applyHall([line('a', 'Trang trí cổng', { unitPrice: 1_000_000 })], vang, null, 'new')
    assert.deepEqual(out.map((i) => i.itemName), ['Sảnh Vàng Cánh Bướm', 'Trang trí cổng'])
    assert.equal(out[0].key, 'new')
  })
  it('đổi sảnh: dòng 1 đổi theo tại chỗ, dòng khác không đổi; số bàn tối thiểu mặc định 1', () => {
    const first = applyHall([line('a', '')], vang, null, 'new')
    const items = [...first, line('b', 'Hoa bàn tiệc', { unitPrice: 500_000 })]
    const out = applyHall(items, bac, 'h1', 'new')
    assert.deepEqual(out.map((i) => [i.itemName, i.packageId, i.quantity]), [['Sảnh Bạc', 'h2', 1], ['Hoa bàn tiệc', undefined, 1]])
    assert.equal(out[0].key, 'a')
  })
  it('giữ id dòng khi đổi sảnh (sửa sau cọc khớp theo id)', () => {
    const out = applyHall([{ ...hallLine(vang, undefined, 'a'), id: 'ID1' }], bac, 'h1', 'new')
    assert.equal(out[0].id, 'ID1')
  })
  it('sửa sau cọc (inPlaceOnly): đơn cũ chưa có dòng sảnh thì không thêm dòng', () => {
    const items = [line('a', 'Tiệc 20 bàn', { unitPrice: 4_000_000 })]
    const out = applyHall(items, vang, null, 'new', { inPlaceOnly: true })
    assert.equal(out.length, 1)
    assert.equal(out[0].itemName, 'Tiệc 20 bàn')
  })
})

describe('applyHall: dòng sảnh luôn nhảy theo gói', () => {
  it('đổi sảnh ghi đè số bàn và đơn giá đã sửa bằng mặc định của sảnh mới', () => {
    const out = applyHall([{ ...hallLine(bac, undefined, 'a'), quantity: 30, unitPrice: 1 }], vang, 'h2', 'new')
    assert.deepEqual([out[0].itemName, out[0].quantity, out[0].unitPrice, out[0].packageId], ['Sảnh Vàng Cánh Bướm', 20, 4_000_000, 'h1'])
  })
  it('đơn lệch sảnh (dòng gắn sảnh khác với ô Sảnh): thay đúng dòng đó, không chèn thêm', () => {
    const items = [{ ...line('a', 'rxnyfg', { unitPrice: 5_500_000, quantity: 21 }), packageId: 'h2' }]
    const out = applyHall(items, vang, 'h1', 'new', { hallIds: ['h1', 'h2'] })
    assert.equal(out.length, 1)
    assert.deepEqual([out[0].itemName, out[0].quantity, out[0].unitPrice, out[0].packageId, out[0].key], ['Sảnh Vàng Cánh Bướm', 20, 4_000_000, 'h1', 'a'])
  })
})

describe('hallLineIndex', () => {
  it('hallLineIndex tìm dòng theo sảnh', () => {
    assert.equal(hallLineIndex([line('a', 'x'), hallLine(vang, undefined, 'b')], 'h1'), 1)
    assert.equal(hallLineIndex([line('a', 'x')], null), -1)
  })
})

describe('hallTablesError', () => {
  it('số bàn dưới tối thiểu bị chặn; đủ thì qua; gói không có quy tắc thì qua', () => {
    assert.match(hallTablesError({ ...hallLine(vang), quantity: 10 }, vang)!, /tối thiểu 20 bàn/)
    assert.equal(hallTablesError({ ...hallLine(vang), quantity: 20 }, vang), undefined)
    assert.equal(hallTablesError({ ...hallLine(bac), quantity: 1 }, bac), undefined)
  })
})

describe('packageNote và đổi tên dòng gắn gói', () => {
  it('ghi chú dưới dòng gắn gói / sảnh, trước và sau cọc', () => {
    assert.equal(packageNote({ ...line('a', 'x'), packageId: 'p1' }, pkg('p1', 'Gói Cô dâu'), 'package'), 'Gắn gói Gói Cô dâu · 4 công việc sẽ tạo khi khách cọc')
    assert.equal(packageNote(hallLine(vang), vang, 'hall'), 'Gắn sảnh Sảnh Vàng Cánh Bướm · 7 công việc sẽ tạo khi khách cọc')
    assert.match(packageNote(hallLine(vang), vang, 'hall', true)!, /đã tạo khi khách cọc/)
    assert.equal(packageNote(line('a', 'x'), undefined, 'package'), null)
  })
  it('đổi tên dòng không làm mất packageId (liên kết chỉ theo gói)', () => {
    const l = { ...hallLine(vang, undefined, 'a'), itemName: 'Tên khác hẳn' }
    assert.equal(l.packageId, 'h1')
    assert.equal(packageNote(l, vang, 'hall')?.includes('Gắn sảnh'), true)
  })
})

describe('suggestPackage: gợi ý gắn gói khi tên trùng hoặc gần trùng', () => {
  const list = [pkg('p1', 'Gói Cô dâu'), pkg('p2', 'Makeup Dự tiệc')]
  it('trùng tên (bỏ dấu, hoa thường) hoặc chứa nhau thì gợi ý', () => {
    assert.equal(suggestPackage(line('a', 'goi co dau'), list)?.id, 'p1')
    assert.equal(suggestPackage(line('a', 'Gói Cô dâu cao cấp'), list)?.id, 'p1')
    assert.equal(suggestPackage(line('a', 'Dự tiệc'), list)?.id, 'p2')
  })
  it('đã gắn gói, tên quá ngắn hoặc không liên quan thì không gợi ý', () => {
    assert.equal(suggestPackage(line('a', 'Gói Cô dâu', { packageId: 'p1' }), list), null)
    assert.equal(suggestPackage(line('a', 'Ab'), list), null)
    assert.equal(suggestPackage(line('a', 'Phí đi lại'), list), null)
  })
})

describe('needsNoPackageConfirm: nhắc khi quên gắn gói', () => {
  it('lĩnh vực không có sảnh: không dòng nào gắn gói thì hỏi; có một dòng gắn thì không', () => {
    assert.equal(needsNoPackageConfirm([line('a', 'x')], false), true)
    assert.equal(needsNoPackageConfirm([line('a', 'x'), line('b', 'y', { packageId: 'p1' })], false), false)
  })
  it('Trung tâm tiệc cưới đã có sảnh nên không hỏi kiểu này', () => {
    assert.equal(needsNoPackageConfirm([line('a', 'x')], true), false)
  })
})

describe('hallFieldState: NCC Trung tâm tiệc cưới chưa có sảnh', () => {
  it('vẫn thấy ô Sảnh (kèm nhắc) dù chưa có sảnh nào; lĩnh vực khác không có ô Sảnh', () => {
    assert.equal(hallFieldState(true, 0), 'empty')
    assert.equal(hallFieldState(true, 3), 'select')
    assert.equal(hallFieldState(false, 0), 'none')
    assert.equal(hallFieldState(false, 5), 'none')
  })
})
