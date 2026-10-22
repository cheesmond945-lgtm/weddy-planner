import { Controller, Get, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { StorageService } from '../../integrations/storage/storage.service';

@RawResponse()
@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  // GET /api/health — kiểm tra nhanh kết nối DB + đường dẫn ảnh
  @Get()
  async check() {
    const [users, packages, albums] = await Promise.all([
      this.prisma.users.count(),
      this.prisma.service_packages.count(),
      this.prisma.package_albums.count(),
    ]);
    const sample = await this.prisma.package_albums.findFirst({ where: { is_cover: true } });
    return {
      db: 'ok',
      counts: { users, packages, albums },
      sampleImage: sample ? this.storage.publicAlbumUrl(sample.url) : null,
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
