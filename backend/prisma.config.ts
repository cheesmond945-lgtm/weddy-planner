import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7: chuỗi kết nối khai báo ở đây, không để trong schema.prisma
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
