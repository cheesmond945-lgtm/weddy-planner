import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import { openAuthDialog } from './authDialog'

/**
 * Bọc một thao tác chỉ dành cho cặp đôi (như requireLogin trong prototype):
 * chưa đăng nhập thì mở modal, đăng nhập xong mới làm tiếp.
 */
export function useRequireCouple() {
  const { user } = useAuth()
  return (action: () => void) => {
    if (!user) openAuthDialog('login', null, action)
    else if (user.role !== 'COUPLE') toast('Chức năng này dành cho tài khoản cặp đôi')
    else action()
  }
}
