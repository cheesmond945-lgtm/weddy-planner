import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7: chuỗi kết nối khai báo ở đây, không để trong schema.prisma
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // db:pull cần Session pooler (DIRECT_URL, cổng 5432); app chạy qua Transaction pooler (DATABASE_URL, xem src/prisma/prisma.service.ts)
  datasource: { url: process.env.DIRECT_URL ? env('DIRECT_URL') : env('DATABASE_URL') },
});
