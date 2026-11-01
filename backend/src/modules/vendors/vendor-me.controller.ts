import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AiQuotaService } from '../../integrations/ai/ai-quota.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateProfileBody, VendorProfileService } from './vendor-profile.service';

/** API của NCC đang đăng nhập (docs/api/vendors.md). Tệp lưu ở Supabase Storage thay cho Cloudinary. */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me')
export class VendorMeController {
  constructor(private readonly profile: VendorProfileService, private readonly notifications: NotificationsService, private readonly quota: AiQuotaService) {}

  @Get('profile')
  getProfile(@Req() req: any) {
    return this.profile.getProfile(req.user.sub);
  }

  @Patch('profile')
  saveProfile(@Req() req: any, @Body() body: UpdateProfileBody) {
    return this.profile.save(req.user.sub, body ?? {}, false);
  }

  @Post('profile/submit')
  submitProfile(@Req() req: any, @Body() body: UpdateProfileBody) {
    return this.profile.save(req.user.sub, body ?? {}, true);
  }

  /** Số lượt "Tạo với AI" còn lại hôm nay của NCC (dùng chung cho hồ sơ và gói). */
  @Get('ai-quota')
  aiQuota(@Req() req: any) {
    return this.quota.status(req.user.sub);
  }

  @Post('profile/suggest-description')
  suggestDescription(@Req() req: any, @Body() body: { style?: string; businessName?: string | null; ward?: string | null; province?: string | null; hint?: string | null }) {
    return this.profile.suggestDescription(req.user.sub, body ?? {});
  }

  // ----- Thông báo của NCC đang đăng nhập -----
  @Get('notifications')
  listNotifications(@Req() req: any, @Query('limit') limit?: string) {
    return this.notifications.list(req.user.sub, limit);
  }

  @Post('notifications/read-all')
  readAllNotifications(@Req() req: any) {
    return this.notifications.markAllRead(req.user.sub);
  }

  @Post('notifications/:id/read')
  readNotification(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }

  // multipart/form-data: file + purpose (VENDOR_DOCUMENT | VENDOR_PHOTO | PACKAGE_PHOTO)
  @Post('uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 11 * 1048576 } }))
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File | undefined, @Body('purpose') purpose: string) {
    return this.profile.upload(req.user.sub, purpose, file);
  }
}
