import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { MAX_ATTACHMENT_BYTES } from './chat-attachments';
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
  send(@Req() req: any, @Param('id') id: string, @Body() body: { text?: string; replyToId?: unknown }) {
    return this.chat.send(req.user, id, body?.text ?? '', body?.replyToId);
  }

  /** Gửi ảnh / tệp / ghi âm (multipart: file, replyToId?, durationSec?) */
  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  sendAttachment(@Req() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: { replyToId?: unknown; durationSec?: unknown }) {
    return this.chat.sendAttachment(req.user, id, file, body ?? {});
  }

  /** Thu hồi tin của chính mình với mọi người */
  @Delete(':id/messages/:messageId')
  recall(@Req() req: any, @Param('id') id: string, @Param('messageId') messageId: string) {
    return this.chat.recall(req.user, id, messageId);
  }

  /** Thả / đổi cảm xúc ({ emoji }), emoji rỗng là gỡ */
  @Put(':id/messages/:messageId/reaction')
  react(@Req() req: any, @Param('id') id: string, @Param('messageId') messageId: string, @Body() body: { emoji?: unknown }) {
    return this.chat.react(req.user, id, messageId, body?.emoji ?? null);
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
  send(@Req() req: any, @Param('id') id: string, @Body() body: { text?: string; replyToId?: unknown }) {
    return this.chat.send(req.user, id, body?.text ?? '', body?.replyToId);
  }

  /** Gửi ảnh / tệp / ghi âm (multipart: file, replyToId?, durationSec?) */
  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  sendAttachment(@Req() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: { replyToId?: unknown; durationSec?: unknown }) {
    return this.chat.sendAttachment(req.user, id, file, body ?? {});
  }

  /** Thu hồi tin của chính mình với mọi người */
  @Delete(':id/messages/:messageId')
  recall(@Req() req: any, @Param('id') id: string, @Param('messageId') messageId: string) {
    return this.chat.recall(req.user, id, messageId);
  }

  /** Thả / đổi cảm xúc ({ emoji }), emoji rỗng là gỡ */
  @Put(':id/messages/:messageId/reaction')
  react(@Req() req: any, @Param('id') id: string, @Param('messageId') messageId: string, @Body() body: { emoji?: unknown }) {
    return this.chat.react(req.user, id, messageId, body?.emoji ?? null);
  }

  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.chat.markRead(req.user, id);
  }
}
