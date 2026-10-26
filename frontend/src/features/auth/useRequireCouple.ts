import { useLocation, useNavigate } from 'react-router'
import { toast } from '@/components/ui/toast'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'

/**
 * Bọc một thao tác chỉ dành cho cặp đôi (như requireLogin trong prototype):
 * chưa đăng nhập thì sang trang /login, đăng nhập xong quay lại trang đang xem.
 * `resume`: tham số thêm vào URL quay lại để trang làm tiếp việc dở (ví dụ chat=<id> để mở lại khung chat).
 */
export function useRequireCouple() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return <T>(action: () => T, resume?: Record<string, string>): T | undefined => {
    if (!user) {
      const search = new URLSearchParams(location.search)
      for (const [k, v] of Object.entries(resume ?? {})) search.set(k, v)
      const qs = search.toString()
      navigate(paths.login, { state: { from: location.pathname + (qs ? `?${qs}` : '') } })
    } else if (user.role !== 'COUPLE') toast('Chức năng này dành cho tài khoản cặp đôi')
    else return action()
  }
}
