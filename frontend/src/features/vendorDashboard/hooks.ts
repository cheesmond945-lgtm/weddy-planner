import { useMemo } from 'react'
import { useNow } from '@/lib/clock'
import { useCommissionStatements } from '@/features/commissions/hooks'
import { useVendorConversations } from '@/features/vendorChat/hooks'
import { useOrders } from '@/features/vendorOrders/hooks'
import { usePackages } from '@/features/vendorPackages/hooks'
import { useVendorProfile } from '@/features/vendors/hooks'
import { orderStats, recentOrders, todoItems, upcomingOrders } from './summary'

// Trang Tổng quan cần mọi đơn để tổng hợp; 100 là trang lớn nhất API cho phép (README mục 6)
const ALL_ORDERS = { page: 1, pageSize: 100 }

/**
 * Dữ liệu trang Tổng quan: chỉ dùng lại hook các trang khác (hồ sơ, đơn, hội thoại, gói, hoa hồng),
 * nên số liệu khớp với trang tương ứng. Danh sách nào lỗi thì coi như rỗng, trang vẫn hiện được.
 */
export function useVendorDashboard() {
  const profile = useVendorProfile()
  const orders = useOrders(ALL_ORDERS)
  const conversations = useVendorConversations(15_000)
  const packages = usePackages()
  const commissions = useCommissionStatements()
  // Việc cần làm, hạn cọc, số liệu theo ngày: tính lại mỗi 30 giây
  const tick = Math.floor(useNow().getTime() / 30_000)

  const data = useMemo(() => {
    const o = orders.data?.data ?? []
    const st = commissions.data ?? []
    return {
      stats: orderStats(o),
      currentCommission: st.find((s) => s.status === 'OPEN'),
      todos: todoItems({ orders: o, conversations: conversations.data ?? [], packages: packages.data ?? [], statements: st }),
      upcoming: upcomingOrders(o),
      recent: recentOrders(o),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.data, conversations.data, packages.data, commissions.data, tick])

  return {
    profile: profile.data,
    isPending: profile.isPending || orders.isPending,
    error: profile.error ?? orders.error,
    refetch: () => {
      void profile.refetch()
      void orders.refetch()
    },
    ...data,
  }
}
