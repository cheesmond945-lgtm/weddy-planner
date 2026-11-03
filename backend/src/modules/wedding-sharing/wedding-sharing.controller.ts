import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimit } from '../../common/guards/rate-limit.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { WeddingSharingService } from './wedding-sharing.service';

/** Cặp đôi quản lý link xem kế hoạch công khai (docs/api/sharing.md mục 1). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('weddings/me')
export class WeddingSharingController {
  constructor(private readonly sharing: WeddingSharingService) {}

  @Get('share-link')
  getShareLink(@Req() req: any) {
    return this.sharing.getShareLink(req.user.sub);
  }

  @Put('share-link')
  putShareLink(@Req() req: any, @Body() body: { enabled?: unknown; tabs?: unknown }) {
    return this.sharing.putShareLink(req.user.sub, body ?? {});
  }

  @Post('share-link/regenerate')
  regenerateShareLink(@Req() req: any) {
    return this.sharing.regenerateShareLink(req.user.sub);
  }
}

/** Xem kế hoạch qua link công khai, chỉ đọc, không cần đăng nhập (docs/api/sharing.md mục 2). */
@Controller('public/plans')
export class PublicPlansController {
  constructor(private readonly sharing: WeddingSharingService) {}

  @Get(':token')
  @RateLimit(60)
  plan(@Param('token') token: string) {
    return this.sharing.publicPlan(token);
  }

  @Get(':token/:tab')
  @RateLimit(120)
  tab(@Param('token') token: string, @Param('tab') tab: string) {
    return this.sharing.publicTab(token, tab);
  }
}
