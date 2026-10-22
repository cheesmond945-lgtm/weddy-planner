/** Biến môi trường dùng chung. Chỉ đọc import.meta.env ở file này. */
export const env = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api',
  useMock: import.meta.env.VITE_USE_MOCK === 'true',
  /** Các nhóm API đã có backend thật, ngăn cách bằng dấu phẩy (vd "catalog,auth"); các nhóm còn lại vẫn dùng dữ liệu giả khi VITE_USE_MOCK=true. */
  realApis: ((import.meta.env.VITE_REAL_APIS as string | undefined) ?? '').split(',').map((s) => s.trim()).filter(Boolean),
}
