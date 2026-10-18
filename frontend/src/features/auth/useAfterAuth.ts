import { useNavigate } from 'react-router'
import { weddingsApi } from '@/api/weddings'
import { toast } from '@/components/ui/toast'
import { openWeddingSetup } from '@/features/weddings/components/WeddingDialogs'
import { homeOf, paths } from '@/routes/paths'
import type { Session } from '@/types/auth'

/**
 * Sau khi đăng nhập/đăng ký (authDone trong prototype):
 * - NCC, Admin: sang khu vực quản lý.
 * - Cặp đôi chưa có thông tin đám cưới: mở hộp thiết lập, xong mới làm tiếp việc đang dở.
 * - Cặp đôi đã có: mở trang đang định vào / làm tiếp việc đang dở.
 */
export function useAfterAuth() {
  const navigate = useNavigate()

  return async (session: Session, message: string, redirectTo?: string | null, then?: (() => void) | null) => {
    toast(message)
    const { role } = session.user
    if (role !== 'COUPLE') {
      navigate(homeOf[role], { replace: true })
      return
    }

    // Đang ở trang /login, /register riêng thì phải rời trang để thấy giao diện cặp đôi
    const onAuthPage = [paths.login, paths.register].includes(window.location.pathname as never)
    if (redirectTo) navigate(redirectTo)
    else if (onAuthPage) navigate(paths.services, { replace: true })

    const wedding = await weddingsApi.getMine().catch(() => undefined)
    if (wedding === null) {
      // Không có việc dở và không có trang định vào: thiết lập xong thì sang Timeline
      openWeddingSetup(then ?? (redirectTo ? () => {} : null))
      return
    }
    then?.()
  }
}
