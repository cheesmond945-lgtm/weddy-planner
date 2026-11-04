import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { WeddingsController } from './weddings.controller';
import { PlanTabsController } from './plan-tabs.controller';
import { AiSuggestService } from './ai-suggest.service';
import { BudgetCalcService } from './budget-calc.service';
import { BudgetService } from './budget.service';
import { ImportExportService } from './import-export.service';
import { OverviewService } from './overview.service';
import { TimelineService } from './timeline.service';
import { WeddingsService } from './weddings.service';
import { PublicPlansController, WeddingSharingController } from '../wedding-sharing/wedding-sharing.controller';
import { WeddingSharingService } from '../wedding-sharing/wedding-sharing.service';

@Module({
  imports: [CatalogModule],
  // Chia sẻ (thư mục wedding-sharing) đăng ký ở đây vì xem công khai dùng lại các service của các tab
  controllers: [WeddingsController, PlanTabsController, WeddingSharingController, PublicPlansController],
  providers: [WeddingsService, TimelineService, AiSuggestService, BudgetCalcService, BudgetService, OverviewService, ImportExportService, WeddingSharingService],
  exports: [WeddingsService, BudgetCalcService],
})
export class WeddingsModule {}
