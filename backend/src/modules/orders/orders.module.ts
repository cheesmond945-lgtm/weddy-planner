import { Module } from '@nestjs/common';
import { CoupleOrdersController, PaymentsController, VendorOrdersController } from './orders.controller';
import { OrderJobsService } from './order-jobs.service';
import { OrderTasksService } from './order-tasks.service';
import { OrdersService } from './orders.service';

@Module({ controllers: [CoupleOrdersController, PaymentsController, VendorOrdersController], providers: [OrdersService, OrderJobsService, OrderTasksService], exports: [OrdersService, OrderJobsService] })
export class OrdersModule {}
