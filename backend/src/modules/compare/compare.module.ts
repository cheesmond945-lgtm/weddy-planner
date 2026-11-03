import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { CatalogModule } from '../catalog/catalog.module';
import { WeddingsModule } from '../weddings/weddings.module';
import { CompareController } from './compare.controller';

@Module({
  imports: [CatalogModule, WeddingsModule, AvailabilityModule],
  controllers: [CompareController],
})
export class CompareModule {}
