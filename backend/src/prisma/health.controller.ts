import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PrismaService } from './prisma.service.js'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Kiểm tra API và kết nối DB. */
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`
    return { status: 'ok', db: 'up' }
  }
}
