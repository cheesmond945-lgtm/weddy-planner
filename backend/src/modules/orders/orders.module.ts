import { Module } from '@nestjs/common';
import { CoupleOrdersController, PaymentsController, VendorOrdersController } from './orders.controller';
import { OrderJobsService } from './order-jobs.service';
import { OrderTasksService } from './order-tasks.service';
import { CatalogModule } from '../catalog/catalog.module';
import { VietqrModule } from '../../integrations/vietqr/vietqr.module';
import { OrdersService } from './orders.service';
import { OrderAdjustmentsService } from './order-adjustments.service';

@Module({ imports: [VietqrModule, CatalogModule], controllers: [CoupleOrdersController, PaymentsController, VendorOrdersController], providers: [OrdersService, OrderJobsService, OrderTasksService, OrderAdjustmentsService], exports: [OrdersService, OrderJobsService] })
export class OrdersModule {}
