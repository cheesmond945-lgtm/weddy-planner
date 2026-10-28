import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

/** Giá trị trễ một nhịp (ô tìm kiếm không gọi API mỗi phím gõ). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Sau khi duyệt, ghi nhận…: tải lại số liệu tổng quan và số mục trên menu. */
export function useRefreshAdminSummary() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'counts'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }
}
