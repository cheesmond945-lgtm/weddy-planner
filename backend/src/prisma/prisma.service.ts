import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Thiếu DATABASE_URL trong backend/.env');
    // Tối đa 5 kết nối mỗi backend, để vài backend chạy cùng lúc vẫn không chiếm hết kết nối của Supabase
    super({ adapter: new PrismaPg({ connectionString, max: 5 }) });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
