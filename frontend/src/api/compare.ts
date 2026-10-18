import { mockCompare } from '@/mocks/compare'
import type { CompareResult } from '@/types/compare'
import { http } from './client'
import { USE_MOCK, mockDelay } from './mock'

/** Hợp đồng: docs/api/compare.md */
export const compareApi = {
  compare: (serviceIds: string[]): Promise<CompareResult> =>
    USE_MOCK
      ? mockDelay(null, 250).then(() => mockCompare.compare(serviceIds))
      : http.get('/compare', { query: { serviceIds: serviceIds.join(',') } }),
}
