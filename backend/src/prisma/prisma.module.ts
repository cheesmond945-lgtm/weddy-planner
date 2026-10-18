import { Global, Module } from '@nestjs/common'
import { HealthController } from './health.controller.js'
import { PrismaService } from './prisma.service.js'

@Global()
@Module({
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
