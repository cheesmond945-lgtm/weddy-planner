import { mockCompare } from '@/mocks/compare'
import type { CompareResult } from '@/types/compare'
import { http } from './client'
import { isMock, mockDelay } from './mock'

/** Hợp đồng: docs/api/compare.md */
export const compareApi = {
  compare: (serviceIds: string[]): Promise<CompareResult> =>
    isMock('compare')
      ? mockDelay(null, 250).then(() => mockCompare.compare(serviceIds))
      : http.get('/compare', { query: { serviceIds: serviceIds.join(',') } }),
}
