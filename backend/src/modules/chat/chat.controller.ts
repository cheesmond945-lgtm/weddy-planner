import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ChatService } from './chat.service';

/** Hội thoại phía cặp đôi (docs/api/chat.md). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('conversations')
export class CoupleChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Req() req: any) {
    return this.chat.listForCouple(req.user.sub);
  }

  @Post()
  start(@Req() req: any, @Body() body: { serviceId?: string; replace?: boolean }) {
    return this.chat.startForCouple(req.user.sub, String(body?.serviceId ?? ''), !!body?.replace);
  }

  @Get(':id/messages')
  messages(@Req() req: any, @Param('id') id: string) {
    return this.chat.messagesForCouple(req.user.sub, id);
  }

  @Post(':id/messages')
  send(@Req() req: any, @Param('id') id: string, @Body() body: { text?: string }) {
    return this.chat.sendForCouple(req.user.sub, id, body?.text ?? '');
  }
}

/** Hội thoại phía nhà cung cấp (docs/api/chat.md, phần Nhà cung cấp). */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/conversations')
export class VendorChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Req() req: any) {
    return this.chat.listForVendor(req.user.sub);
  }

  @Get(':id/messages')
  messages(@Req() req: any, @Param('id') id: string) {
    return this.chat.messagesForVendor(req.user.sub, id);
  }

  @Post(':id/messages')
  send(@Req() req: any, @Param('id') id: string, @Body() body: { text?: string }) {
    return this.chat.sendForVendor(req.user.sub, id, body?.text ?? '');
  }

  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.chat.markReadForVendor(req.user.sub, id);
  }
}
