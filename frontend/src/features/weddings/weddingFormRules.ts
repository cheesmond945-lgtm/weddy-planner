/** Lỗi theo từng trường của form thông tin đám cưới */
export type WeddingFormErrors = Partial<Record<'brideName' | 'groomName' | 'date' | 'ward' | 'guestCount' | 'budget' | 'services', string>>

export interface WeddingFormValues {
  brideName: string
  groomName: string
  /** YYYY-MM-DD */
  date: string
  ward: string
  /** Chuỗi trong ô nhập */
  guestCount: string
  budget: number
  services: string[]
}

/** Tiền làm tròn lên 100.000đ để ghi trong câu báo lỗi: "15.900.000đ" */
const vnd = (x: number) => `${(Math.ceil(x / 100_000) * 100_000).toLocaleString('vi-VN')}đ`

/**
 * Kiểm tra form thông tin đám cưới (WeddingForm). Hàm thuần, có test ở weddingFormRules.test.ts.
 * todayIso: ngày hôm nay dạng YYYY-MM-DD (truyền vào để test được).
 * minCosts: chi phí thấp nhất từng hạng mục theo số khách (GET /categories/min-costs); có thì kiểm tra ngân sách tối thiểu:
 * - nhỏ hơn gói rẻ nhất trên Forever: không làm được dịch vụ nào;
 * - nhỏ hơn tổng giá thấp nhất của các dịch vụ đã chọn: chỉ đủ vài dịch vụ, phải tăng ngân sách hoặc bỏ bớt dịch vụ.
 */
export function validateWeddingForm(v: WeddingFormValues, todayIso: string, minCosts?: Record<string, number>): WeddingFormErrors {
  const errs: WeddingFormErrors = {}
  const guests = v.guestCount ? Number(v.guestCount) : NaN
  if (!v.brideName.trim()) errs.brideName = 'Vui lòng nhập tên cô dâu.'
  if (!v.groomName.trim()) errs.groomName = 'Vui lòng nhập tên chú rể.'
  if (!v.date) errs.date = 'Vui lòng chọn ngày tổ chức.'
  else if (v.date <= todayIso) errs.date = 'Ngày tổ chức phải sau hôm nay.'
  if (!v.ward) errs.ward = 'Vui lòng chọn nơi tổ chức.'
  if (!(guests >= 1)) errs.guestCount = 'Vui lòng nhập số khách dự kiến (từ 1).'
  if (!(v.budget > 0)) errs.budget = 'Vui lòng nhập tổng ngân sách lớn hơn 0.'
  if (!v.services.length) errs.services = 'Vui lòng chọn ít nhất 1 dịch vụ.'
  if (v.budget > 0 && minCosts && Object.keys(minCosts).length) {
    const cheapest = Math.min(...Object.values(minCosts))
    const costs = v.services.map((s) => minCosts[s]).filter((c): c is number => c > 0).sort((a, b) => a - b)
    const need = costs.reduce((t, c) => t + c, 0)
    if (v.budget < cheapest) {
      errs.budget = `Ngân sách quá thấp: gói rẻ nhất trên Forever khoảng ${vnd(cheapest)}, chưa đủ cho dịch vụ nào.`
    } else if (costs.length && v.budget < need && !errs.services) {
      // Số dịch vụ rẻ nhất vừa ngân sách (cộng dần từ rẻ đến đắt)
      let fit = 0
      for (let t = 0; fit < costs.length && t + costs[fit] <= v.budget; fit++) t += costs[fit]
      const who = Number.isFinite(guests) && guests >= 1 ? ` cho ${guests.toLocaleString('vi-VN')} khách` : ''
      errs.budget = `Ngân sách chưa đủ cho ${costs.length} dịch vụ đã chọn: tối thiểu khoảng ${vnd(need)}${who}. Hãy tăng ngân sách hoặc bỏ bớt dịch vụ.`
      errs.services = `Với ngân sách này chỉ đủ khoảng ${fit} dịch vụ. Bỏ bớt dịch vụ hoặc tăng ngân sách.`
    }
  }
  return errs
}
