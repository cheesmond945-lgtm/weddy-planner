import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { WeddingsModule } from '../weddings/weddings.module';
import { CompareController } from './compare.controller';

@Module({ imports: [CatalogModule, WeddingsModule], controllers: [CompareController] })
export class CompareModule {}
