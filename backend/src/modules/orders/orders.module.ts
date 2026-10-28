import { Module } from '@nestjs/common';
import { CoupleOrdersController, PaymentsController, VendorOrdersController } from './orders.controller';
import { OrderJobsService } from './order-jobs.service';
import { OrdersService } from './orders.service';

@Module({ controllers: [CoupleOrdersController, PaymentsController, VendorOrdersController], providers: [OrdersService, OrderJobsService], exports: [OrdersService, OrderJobsService] })
export class OrdersModule {}
