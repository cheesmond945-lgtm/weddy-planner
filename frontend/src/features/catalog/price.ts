import { formatMoney } from '@/lib/format'

type Priced = { priceUnit?: 'TABLE' | 'PACKAGE' }

/** Trung tâm sự kiện báo giá theo bàn (10 khách), đã gồm sảnh; các danh mục khác là giá trọn gói. */
export const isTablePriced = (s: Priced) => s.priceUnit === 'TABLE'

/** "5.500.000đ" hoặc "5.500.000đ/bàn" */
export const formatUnitPrice = (amount: number, s: Priced) => `${formatMoney(amount)}${isTablePriced(s) ? '/bàn' : ''}`

/** Ghi chú dưới giá theo bàn: "Đã gồm sảnh · tối thiểu 20 bàn" */
export const tableNote = (minTables: number | null | undefined) => `Đã gồm sảnh${minTables ? ` · tối thiểu ${minTables} bàn` : ''}`

/** Gói tính theo bàn: theo đơn vị của gói nếu có, không thì theo dịch vụ */
const tablePriced = (p: { pricingUnit?: 'TABLE' | 'PACKAGE' }, s: Priced) => (p.pricingUnit ?? s.priceUnit) === 'TABLE'

/**
 * Số bàn tính phí = max(số bàn dự kiến, số bàn tối thiểu của gói, 1), cùng công thức packageCost ở backend (budget-engine.ts).
 * byMinimum: số bàn tối thiểu của gói lớn hơn số bàn dự kiến (khách phải đặt thêm bàn).
 */
export function chargedTables(expected: number | null | undefined, minTables: number | null | undefined) {
  const want = expected ?? 0
  const min = minTables ?? 0
  return { count: Math.max(want, min, 1), byMinimum: min > want, shortBy: Math.max(0, min - want) }
}

/** Tổng chi phí ước tính của gói: gói theo bàn = đơn giá × số bàn tính phí; gói khác = giá trọn gói. */
export function packageTotal(p: { price: number; minTables?: number | null; pricingUnit?: 'TABLE' | 'PACKAGE' }, s: Priced, expectedTables: number | null | undefined) {
  return tablePriced(p, s) ? p.price * chargedTables(expectedTables, p.minTables).count : p.price
}
