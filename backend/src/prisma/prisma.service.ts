import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { omitMissingColumns } from './db-features';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Thiếu DATABASE_URL trong backend/.env');
    // Supabase (chế độ session) chỉ cho tối đa 15 kết nối dùng chung cả nhóm: mỗi backend chỉ giữ ít kết nối (đổi bằng DB_POOL_MAX)
    const max = Number(process.env.DB_POOL_MAX) || 5;
    // Cột của file SQL chưa chạy: bỏ khỏi truy vấn mặc định (db-features.ts). Kiểu trả về vẫn đủ cột, giá trị là undefined
    const omit = omitMissingColumns();
    super({ adapter: new PrismaPg({
        connectionString,
        max,
        // DB ở xa (~120ms/lượt, mở kết nối mới ~1.5s): giữ kết nối sống lâu thay vì đóng sau 10s rảnh (mặc định của pg)
        idleTimeoutMillis: 10 * 60_000,
        keepAlive: true,
        connectionTimeoutMillis: 15_000,
      }), ...(Object.keys(omit).length && { omit: omit as never }) });
  }
  private keepWarm?: NodeJS.Timeout;

  async onModuleInit() {
    await this.$connect();
    // Mở sẵn vài kết nối song song để request đầu tiên không phải chờ bắt tay SSL, rồi ping định kỳ cho khỏi bị đóng
    const warm = Math.min(3, Number(process.env.DB_POOL_MAX) || 5);
    const ping = () => Promise.allSettled(Array.from({ length: warm }, () => this.$queryRaw`select 1`));
    await ping();
    this.keepWarm = setInterval(() => void ping(), 30_000);
    this.keepWarm.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.keepWarm);
    await this.$disconnect();
  }
}
