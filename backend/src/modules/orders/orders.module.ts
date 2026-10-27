import { Module } from '@nestjs/common';
import { CoupleOrdersController, PaymentsController, VendorOrdersController } from './orders.controller';
import { OrderAutoCompleteService } from './order-auto-complete.service';
import { OrdersService } from './orders.service';

@Module({ controllers: [CoupleOrdersController, PaymentsController, VendorOrdersController], providers: [OrdersService, OrderAutoCompleteService], exports: [OrdersService] })
export class OrdersModule {}
