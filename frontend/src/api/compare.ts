import type { CompareResult } from '@/types/compare'
import { http } from './client'

/** Hợp đồng: docs/api/compare.md. `picked`: gói khách chọn ở dropdown theo id dịch vụ (BE tính lại các dòng và tóm tắt). */
export const compareApi = {
  compare: (serviceIds: string[], picked: Record<string, string> = {}, signal?: AbortSignal): Promise<CompareResult> =>
    http.get('/compare', {
      query: {
        serviceIds: serviceIds.join(','),
        packageIds:
          Object.entries(picked)
            .map(([s, p]) => `${s}:${p}`)
            .join(',') || undefined,
      },
      signal,
    }),
}
