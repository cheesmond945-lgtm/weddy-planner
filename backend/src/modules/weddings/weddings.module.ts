import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { WeddingsController } from './weddings.controller';
import { AiSuggestService } from './ai-suggest.service';
import { TimelineService } from './timeline.service';
import { WeddingsService } from './weddings.service';

@Module({ imports: [CatalogModule], controllers: [WeddingsController], providers: [WeddingsService, TimelineService, AiSuggestService], exports: [WeddingsService] })
export class WeddingsModule {}
