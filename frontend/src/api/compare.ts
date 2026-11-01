import type { CompareResult } from '@/types/compare'
import { http } from './client'

/** Hợp đồng: docs/api/compare.md */
export const compareApi = {
  compare: (serviceIds: string[]): Promise<CompareResult> =>
    http.get('/compare', { query: { serviceIds: serviceIds.join(',') } }),
}
