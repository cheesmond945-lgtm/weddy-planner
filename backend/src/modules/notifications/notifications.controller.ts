import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

/** Thông báo của cặp đôi đang đăng nhập (đơn mới, đơn hoàn tất, đơn bị hủy…). NCC dùng /vendors/me/notifications, Admin dùng /admin/notifications. */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query('limit') limit?: string) {
    return this.notifications.list(req.user.sub, limit);
  }

  @Post('read-all')
  readAll(@Req() req: any) {
    return this.notifications.markAllRead(req.user.sub);
  }

  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }
}
