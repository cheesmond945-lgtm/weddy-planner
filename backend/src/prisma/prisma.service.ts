import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit() {
    await this.$connect()
    this.logger.log('Đã kết nối PostgreSQL')
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
