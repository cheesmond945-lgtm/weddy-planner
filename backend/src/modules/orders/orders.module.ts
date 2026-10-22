import { Module } from '@nestjs/common';
import { CoupleOrdersController, PaymentsController, VendorOrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({ controllers: [CoupleOrdersController, PaymentsController, VendorOrdersController], providers: [OrdersService], exports: [OrdersService] })
export class OrdersModule {}
