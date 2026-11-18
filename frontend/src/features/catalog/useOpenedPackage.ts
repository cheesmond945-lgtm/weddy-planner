import { useSearchParams } from 'react-router'
import type { ServiceDetail, ServicePackage } from '@/types/catalog'

/** Tham số URL của gói đang mở trong khung chi tiết gói: /services/<id>?goi=<id gói> (thẻ gói trong chat mở thẳng tới đây) */
export const PACKAGE_PARAM = 'goi'

/** Gói đang mở theo URL (?goi=), để thẻ gói trong chat mở đúng gói; mở / đóng khung thì cập nhật URL (không thêm lịch sử). */
export function useOpenedPackage(service: ServiceDetail) {
  const [params, setParams] = useSearchParams()
  const id = params.get(PACKAGE_PARAM)
  const opened = id ? (service.packages.find((p) => p.id === id) ?? null) : null
  const setOpened = (p: ServicePackage | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (p) next.set(PACKAGE_PARAM, p.id)
        else next.delete(PACKAGE_PARAM)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  return [opened, setOpened] as const
}
