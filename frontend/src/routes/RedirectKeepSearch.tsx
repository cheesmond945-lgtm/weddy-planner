import { Navigate, useLocation } from 'react-router'

/** Chuyển sang đường dẫn mới, giữ nguyên query (?category=...) của link cũ. */
export function RedirectKeepSearch({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={{ pathname: to, search }} replace />
}
