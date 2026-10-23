import { Body, Controller, Get, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateProfileBody, VendorProfileService } from './vendor-profile.service';

/** API của NCC đang đăng nhập (docs/api/vendors.md). Tệp lưu ở Supabase Storage thay cho Cloudinary. */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me')
export class VendorMeController {
  constructor(private readonly profile: VendorProfileService) {}

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

  // multipart/form-data: file + purpose (VENDOR_DOCUMENT | VENDOR_PHOTO | PACKAGE_PHOTO)
  @Post('uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 11 * 1048576 } }))
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File | undefined, @Body('purpose') purpose: string) {
    return this.profile.upload(req.user.sub, purpose, file);
  }
}
