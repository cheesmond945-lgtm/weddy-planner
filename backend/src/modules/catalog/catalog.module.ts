import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({ controllers: [CatalogController, ServicesController], providers: [CatalogService, ServicesService] })
export class CatalogModule {}
