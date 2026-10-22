import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './integrations/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, CatalogModule, VendorsModule, HealthModule],
})
export class AppModule {}
