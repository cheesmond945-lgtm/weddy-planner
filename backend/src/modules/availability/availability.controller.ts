import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AvailabilityService } from './availability.service';

/** Lịch khả dụng phía khách, không cần đăng nhập, chỉ trả trạng thái (docs/api/availability.md). */
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get('services')
  forServices(@Query('ids') ids: string, @Query('date') date: string) {
    return this.availability.forServices(ids, date);
  }

  @Get('packages/:packageId')
  packageMonth(@Param('packageId') packageId: string, @Query('month') month: string) {
    return this.availability.packageMonth(packageId, month);
  }
}

/** NCC cập nhật lịch theo gói, khai sảnh dùng chung, xem nhắc cập nhật. */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/availability')
export class VendorAvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get('reminder')
  reminder(@Req() req: any) {
    return this.availability.reminder(req.user.sub);
  }

  @Get('packages/:packageId')
  month(@Req() req: any, @Param('packageId') packageId: string, @Query('month') month: string) {
    return this.availability.vendorMonth(req.user.sub, packageId, month);
  }

  @Put('packages/:packageId')
  setDays(@Req() req: any, @Param('packageId') packageId: string, @Body() body: { dates?: unknown; status?: unknown }) {
    return this.availability.setDays(req.user.sub, packageId, body);
  }

  @Put('packages/:packageId/resource')
  setResource(@Req() req: any, @Param('packageId') packageId: string, @Body() body: { name?: unknown }) {
    return this.availability.setResource(req.user.sub, packageId, body);
  }
}
