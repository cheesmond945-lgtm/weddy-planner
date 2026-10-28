import { Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationQuery, NotificationsService } from './notifications.service';

/** Thông báo của người đang đăng nhập, mọi vai trò (docs/api/notifications.md). */
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query() q: NotificationQuery) {
    return this.notifications.list(req.user.sub, q);
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.notifications.unreadCount(req.user.sub);
  }

  @HttpCode(200)
  @Post('read-all')
  readAll(@Req() req: any) {
    return this.notifications.markAllRead(req.user.sub);
  }

  @HttpCode(200)
  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }
}
