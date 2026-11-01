import type { RegisterConsultationBody } from '@/types/admin'
import { http } from './client'

/** Đăng ký tư vấn hợp tác của nhà cung cấp (công khai, không cần đăng nhập). */
export const consultationApi = {
  register: (body: RegisterConsultationBody): Promise<{ ok: true }> => http.post('/consultation-requests', body),
}
