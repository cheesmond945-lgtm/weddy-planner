import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CompareController } from './compare.controller';

@Module({ imports: [CatalogModule], controllers: [CompareController] })
export class CompareModule {}
