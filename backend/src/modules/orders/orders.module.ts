import { Module } from '@nestjs/common';
import { CoupleOrdersController, PaymentsController, VendorOrdersController } from './orders.controller';
import { OrderAutoCompleteService } from './order-auto-complete.service';
import { CatalogModule } from '../catalog/catalog.module';
import { VietqrModule } from '../../integrations/vietqr/vietqr.module';
import { OrdersService } from './orders.service';

@Module({ imports: [VietqrModule, CatalogModule], controllers: [CoupleOrdersController, PaymentsController, VendorOrdersController], providers: [OrdersService, OrderAutoCompleteService], exports: [OrdersService] })
export class OrdersModule {}
