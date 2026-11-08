import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    // Biên dịch sẵn layout và trang hay vào ngay khi bật dev server, lần mở đầu không phải chờ
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/app/App.tsx',
        './src/routes/router.tsx',
        './src/layouts/*.tsx',
        './src/pages/couple/ServicesPage.tsx',
        './src/pages/auth/LoginPage.tsx',
      ],
    },
  },
})
