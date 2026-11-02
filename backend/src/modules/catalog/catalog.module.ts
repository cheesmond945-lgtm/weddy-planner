import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ServicesController } from './services.controller';
import { SearchAiService } from './search-ai.service';
import { SearchService } from './search.service';
import { ServicesService } from './services.service';

@Module({ controllers: [CatalogController, ServicesController], providers: [CatalogService, ServicesService, SearchService, SearchAiService], exports: [ServicesService] })
export class CatalogModule {}
