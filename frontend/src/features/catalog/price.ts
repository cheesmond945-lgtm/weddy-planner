import { formatMoney } from '@/lib/format'

/** Trung tâm sự kiện báo giá theo mâm (10 khách), đã gồm sảnh; các danh mục khác là giá trọn gói. */
export const isTablePriced = (s: { priceUnit?: 'TABLE' | 'PACKAGE' }) => s.priceUnit === 'TABLE'

/** "5.500.000đ" hoặc "5.500.000đ/mâm" */
export const formatUnitPrice = (amount: number, s: { priceUnit?: 'TABLE' | 'PACKAGE' }) => `${formatMoney(amount)}${isTablePriced(s) ? '/mâm' : ''}`

/** Ghi chú dưới giá theo mâm: "Đã gồm sảnh · tối thiểu 20 mâm" */
export const tableNote = (minTables: number | null | undefined) => `Đã gồm sảnh${minTables ? ` · tối thiểu ${minTables} mâm` : ''}`
