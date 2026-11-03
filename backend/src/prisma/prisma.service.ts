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
    super({ adapter: new PrismaPg({ connectionString, max }), ...(Object.keys(omit).length && { omit: omit as never }) });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
