import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ChatService } from './chat.service';

/**
 * Hội thoại dùng chung cho cặp đôi và NCC (docs/api/chat.md): vai trò lấy từ JWT, mỗi người chỉ thấy
 * hội thoại của mình. Chỉ cặp đôi mới bắt đầu được hội thoại (POST /conversations).
 */
@UseGuards(JwtAuthGuard)
@Roles('Couple', 'Vendor')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Req() req: any) {
    return this.chat.list(req.user);
  }

  @Post()
  start(@Req() req: any, @Body() body: { serviceId?: string; replace?: boolean }) {
    if (req.user.role !== 'Couple') throw new ForbiddenException('Không có quyền');
    return this.chat.startForCouple(req.user.sub, String(body?.serviceId ?? ''), !!body?.replace);
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.chat.unreadCount(req.user);
  }

  @Get(':id/messages')
  messages(@Req() req: any, @Param('id') id: string, @Query('after') after?: string) {
    return this.chat.messages(req.user, id, after);
  }

  @Post(':id/messages')
  send(@Req() req: any, @Param('id') id: string, @Body() body: { text?: string }) {
    return this.chat.send(req.user, id, body?.text ?? '');
  }

  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.chat.markRead(req.user, id);
  }
}

/** Bí danh của ConversationsController cho phía NCC, giữ đường dẫn cũ /vendors/me/conversations. */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/conversations')
export class VendorConversationsController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Req() req: any) {
    return this.chat.list(req.user);
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.chat.unreadCount(req.user);
  }

  @Get(':id/messages')
  messages(@Req() req: any, @Param('id') id: string, @Query('after') after?: string) {
    return this.chat.messages(req.user, id, after);
  }

  @Post(':id/messages')
  send(@Req() req: any, @Param('id') id: string, @Body() body: { text?: string }) {
    return this.chat.send(req.user, id, body?.text ?? '');
  }

  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.chat.markRead(req.user, id);
  }
}
