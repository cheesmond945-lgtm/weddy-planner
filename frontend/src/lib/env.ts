/** Biến môi trường dùng chung. Chỉ đọc import.meta.env ở file này. */
export const env = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api',
  useMock: import.meta.env.VITE_USE_MOCK === 'true',
}
