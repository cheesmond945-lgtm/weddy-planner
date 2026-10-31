import { Module } from '@nestjs/common';
import { HallsController, VendorBusyController, VendorHallsController } from './halls.controller';
import { HallsService } from './halls.service';

/** Lịch bận theo sảnh của Trung tâm tổ chức sự kiện (docs/LICH_BAN_SANH.md). Chặn đặt trùng nằm ở luồng đơn hàng (orders.service, hall-store.ts). */
@Module({ controllers: [VendorBusyController, VendorHallsController, HallsController], providers: [HallsService] })
export class HallsModule {}
