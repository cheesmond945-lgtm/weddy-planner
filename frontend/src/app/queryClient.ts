import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Không thử lại với lỗi phía người dùng (4xx), chỉ thử lại lỗi mạng/máy chủ
      retry: (count, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return count < 2
      },
    },
  },
})
