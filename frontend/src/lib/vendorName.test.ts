import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shortVendorName } from './vendorName.ts'

describe('shortVendorName', () => {
  it('tên dài: bỏ cụm chung chung, giữ phần riêng của thương hiệu', () => {
    assert.equal(shortVendorName('Trung Tâm Hội Nghị Tiệc Cưới Forevermark'), 'Forevermark')
    assert.equal(shortVendorName('Trung tâm Sự kiện & Tiệc Cưới CTM Palace'), 'CTM Palace')
    assert.equal(shortVendorName('Trung Tâm Sự Kiện Tiệc Cưới Cung Xuân'), 'Cung Xuân')
    assert.equal(shortVendorName('Sun Palace - Trung Tâm Tiệc Cưới & Sự Kiện'), 'Sun Palace')
    assert.equal(shortVendorName('Vélia Bridal - Wedding Dress & Custom Tailoring'), 'Vélia Bridal')
    assert.equal(shortVendorName('Hanoi Tower Wedding & Convention'), 'Hanoi Tower')
    assert.equal(shortVendorName('The Gallery - Flowers & Events'), 'The Gallery')
    assert.equal(shortVendorName('Chang Nguyen Makeup & Academy'), 'Chang Nguyen Makeup')
  })

  it('tên ngắn giữ nguyên', () => {
    for (const n of ['Mipec Place', 'Trống Đồng Palace', 'Ha Vy Wedding & Event', 'Tiệm hoa lách cách', 'Châu Florals - Studio']) assert.equal(shortVendorName(n), n)
  })
})
