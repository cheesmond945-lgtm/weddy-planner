import { Link } from 'react-router'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { homeOf, paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'

export default function ForbiddenPage() {
  const { user } = useAuth()
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <PageTitle title="Bạn không có quyền truy cập trang này" />
      <div className="flex justify-center gap-2.5">
        <Button asChild>
          <Link to={user ? homeOf[user.role] : paths.services}>Về trang của tôi</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={paths.login}>Đăng nhập tài khoản khác</Link>
        </Button>
      </div>
    </div>
  )
}
