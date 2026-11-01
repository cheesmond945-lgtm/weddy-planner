import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { HallsService } from './halls.service';

/** Lịch bận theo sảnh phía NCC (docs/LICH_BAN_SANH.md): tab Lịch bận ở Lịch làm việc. */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/busy-dates')
export class VendorBusyController {
  constructor(private readonly halls: HallsService) {}

  /** ?from=YYYY-MM-DD&to=YYYY-MM-DD (tối đa 100 ngày): { enabled, halls, items } */
  @Get()
  list(@Req() req: any, @Query('from') from: string, @Query('to') to: string) {
    return this.halls.vendorCalendar(req.user.sub, from, to);
  }

  /** Đánh dấu bận thủ công: { packageIds, startDate, endDate?, reason } */
  @Post()
  add(@Req() req: any, @Body() body: { packageIds?: unknown; startDate?: unknown; endDate?: unknown; reason?: unknown }) {
    return this.halls.addManual(req.user.sub, body ?? {});
  }

  /** Gỡ một lần đánh dấu bận thủ công. */
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.halls.removeManual(req.user.sub, id);
  }
}

/** Các sảnh của NCC (form đơn chọn sảnh). */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/halls')
export class VendorHallsController {
  constructor(private readonly halls: HallsService) {}

  /** { enabled, halls: [{ id, name, hidden }] }; enabled = false nếu NCC không phải Trung tâm tổ chức sự kiện. */
  @Get()
  list(@Req() req: any) {
    return this.halls.vendorHalls(req.user.sub);
  }
}

/** Lịch bận theo sảnh phía khách, công khai: chỉ ngày bận, không lộ khách hay đơn khác. */
@Controller('halls')
export class HallsController {
  constructor(private readonly halls: HallsService) {}

  /** Số sảnh còn trống một ngày của các trung tâm sự kiện: ?date=YYYY-MM-DD&ids=<serviceId>,… (tối đa 100). */
  @Get('free')
  free(@Query('date') date: string, @Query('ids') ids: string) {
    return this.halls.freeOn(date, ids);
  }

  /** Ngày bận của một sảnh (gói): ?from=YYYY-MM-DD&to=YYYY-MM-DD (tối đa 100 ngày). */
  @Get(':packageId/busy')
  busy(@Param('packageId') packageId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.halls.hallDates(packageId, from, to);
  }
}
