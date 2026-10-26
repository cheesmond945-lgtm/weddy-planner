import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SavePackageBody, VendorPackagesService } from './vendor-packages.service';

/** Gói dịch vụ của NCC đang đăng nhập (docs/api/catalog.md, phần Nhà cung cấp). */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/packages')
export class VendorPackagesController {
  constructor(private readonly packages: VendorPackagesService) {}

  @Get()
  list(@Req() req: any) {
    return this.packages.list(req.user.sub);
  }

  @Post('suggest-description')
  suggestDescription(@Req() req: any, @Body() body: { name?: string | null; tags?: string[]; price?: number | null; capacity?: number | null }) {
    return this.packages.suggestDescription(req.user.sub, body ?? {});
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.packages.get(req.user.sub, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: SavePackageBody) {
    return this.packages.create(req.user.sub, body ?? {});
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: SavePackageBody) {
    return this.packages.update(req.user.sub, id, body ?? {});
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.packages.remove(req.user.sub, id);
  }

  /** Xóa bản cập nhật nháp của gói đã đăng (gói giữ nguyên bản đang đăng) */
  @Delete(':id/update')
  discardUpdate(@Req() req: any, @Param('id') id: string) {
    return this.packages.discardUpdate(req.user.sub, id);
  }

  @Post(':id/submit')
  submit(@Req() req: any, @Param('id') id: string) {
    return this.packages.submit(req.user.sub, id);
  }

  @Post(':id/hide')
  hide(@Req() req: any, @Param('id') id: string) {
    return this.packages.hide(req.user.sub, id);
  }

  @Post(':id/republish')
  republish(@Req() req: any, @Param('id') id: string) {
    return this.packages.republish(req.user.sub, id);
  }
}
