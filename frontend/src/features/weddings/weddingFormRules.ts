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

/**
 * Kiểm tra form thông tin đám cưới (WeddingForm). Hàm thuần, có test ở weddingFormRules.test.ts.
 * todayIso: ngày hôm nay dạng YYYY-MM-DD (truyền vào để test được).
 */
export function validateWeddingForm(v: WeddingFormValues, todayIso: string): WeddingFormErrors {
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
  return errs
}
