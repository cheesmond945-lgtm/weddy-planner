import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { setUnauthorizedHandler } from '@/api'
import { Toaster } from '@/components/ui/toast'
import { router } from '@/routes/router'
import { paths } from '@/routes/paths'
import { queryClient } from './queryClient'

// API trả 401: phiên đã bị xóa trong src/api, đưa người dùng về trang đăng nhập
setUnauthorizedHandler(() => {
  queryClient.clear()
  router.navigate(paths.login, { replace: true, state: { from: window.location.pathname } })
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  )
}
