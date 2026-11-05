import type { ImportType } from '@/types/wedding'

/*
 * Ghép cột tự động khi nhập Excel/CSV (P6): so tiêu đề cột (bỏ dấu, viết thường) với từ đồng nghĩa của từng trường.
 * Hàm thuần, có test ở columns.test.ts. Kiểm tra từng dòng nằm ở backend (import-rows.ts), FE gọi dryRun để xem trước.
 */

export interface ImportField {
  key: string
  label: string
  required?: boolean
  synonyms: string[]
}

export const IMPORT_FIELDS: Record<ImportType, ImportField[]> = {
  tasks: [
    { key: 'title', label: 'Việc', required: true, synonyms: ['viec', 'ten viec', 'cong viec', 'noi dung', 'task', 'title'] },
    { key: 'dueDate', label: 'Hạn', required: true, synonyms: ['han', 'han chot', 'ngay', 'deadline', 'han hoan thanh', 'due date', 'due'] },
    { key: 'note', label: 'Ghi chú', synonyms: ['ghi chu', 'note', 'notes', 'mo ta'] },
  ],
  expenses: [
    { key: 'title', label: 'Khoản chi', required: true, synonyms: ['khoan chi', 'ten khoan chi', 'ten', 'noi dung', 'muc', 'hang muc', 'chi phi', 'title'] },
    { key: 'amount', label: 'Số tiền', required: true, synonyms: ['so tien', 'tien', 'chi phi', 'gia', 'thanh tien', 'amount', 'cost'] },
  ],
}

/** Bỏ dấu tiếng Việt, viết thường, gộp khoảng trắng. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[_\-.:*()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Ghép tiêu đề cột với trường: khớp đúng từ đồng nghĩa trước, sau đó tiêu đề bắt đầu bằng từ đồng nghĩa.
 * Mỗi cột chỉ dùng cho một trường. Trả về { trường: chỉ số cột | null }.
 */
export function autoMap(headers: string[], type: ImportType): Record<string, number | null> {
  const folded = headers.map((h) => fold(String(h ?? '')))
  const used = new Set<number>()
  const out: Record<string, number | null> = {}
  const fields = IMPORT_FIELDS[type]
  for (const pass of ['exact', 'prefix'] as const) {
    for (const f of fields) {
      if (out[f.key] !== undefined && out[f.key] !== null) continue
      const idx = folded.findIndex((h, i) => !used.has(i) && f.synonyms.some((s) => (pass === 'exact' ? h === s : h.startsWith(s + ' '))))
      out[f.key] = idx === -1 ? null : idx
      if (idx !== -1) used.add(idx)
    }
  }
  return out
}

/** Dòng dữ liệu (mảng ô) -> { trường: chữ trong ô } theo cách ghép cột. */
export function mapRows(rows: unknown[][], mapping: Record<string, number | null>): Record<string, string>[] {
  return rows.map((r) => {
    const o: Record<string, string> = {}
    for (const [key, idx] of Object.entries(mapping)) o[key] = idx === null || idx === undefined ? '' : String(r[idx] ?? '').trim()
    return o
  })
}

/**
 * Chỉ cho chọn kiểu tháng/ngày/năm khi có ngày mà số thứ hai > 12 và không ngày nào có số đầu > 12 (P6).
 * Bản sao của canBeMonthFirst ở backend/src/modules/weddings/import-rows.ts.
 */
export function canBeMonthFirst(values: string[]): boolean {
  let secondOver12 = false
  for (const v of values) {
    const m = String(v).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})/)
    if (!m) continue
    if (+m[1] > 12) return false
    if (+m[2] > 12) secondOver12 = true
  }
  return secondOver12
}

export const IMPORT_MAX_ROWS = 500
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024
export const PREVIEW_ROWS = 50
