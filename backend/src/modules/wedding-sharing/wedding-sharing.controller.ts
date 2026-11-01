import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimit } from '../../common/guards/rate-limit.guard';
import { WeddingAccess } from '../../common/guards/wedding-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { WeddingSharingService } from './wedding-sharing.service';

/** Owner quản lý link mời và link xem công khai (docs/api/sharing.md mục 1, 3). Editor và viewer không gọi được. */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('weddings/me')
export class WeddingSharingController {
  constructor(private readonly sharing: WeddingSharingService) {}

  @Get('invites')
  @WeddingAccess({ role: 'Owner' })
  listInvites(@Req() req: any) {
    return this.sharing.listInvites(req.wedding);
  }

  @Post('invites')
  @WeddingAccess({ role: 'Owner' })
  createInvite(@Req() req: any, @Body() body: { relation?: unknown; displayName?: unknown; role?: unknown; tabs?: unknown }) {
    return this.sharing.createInvite(req.wedding, req.user.sub, body ?? {});
  }

  @Delete('invites/:id')
  @WeddingAccess({ role: 'Owner' })
  revokeInvite(@Req() req: any, @Param('id') id: string) {
    return this.sharing.revokeInvite(req.wedding, id);
  }

  @Get('share-link')
  @WeddingAccess({ role: 'Owner' })
  getShareLink(@Req() req: any) {
    return this.sharing.getShareLink(req.wedding);
  }

  @Put('share-link')
  @WeddingAccess({ role: 'Owner' })
  putShareLink(@Req() req: any, @Body() body: { enabled?: unknown; tabs?: unknown }) {
    return this.sharing.putShareLink(req.wedding, body ?? {});
  }

  @Post('share-link/regenerate')
  @WeddingAccess({ role: 'Owner' })
  regenerateShareLink(@Req() req: any) {
    return this.sharing.regenerateShareLink(req.wedding);
  }
}

/** Người nhận link mời (docs/api/sharing.md mục 2). Xem lời mời không cần đăng nhập; nhận lời mời cần tài khoản cặp đôi. */
@Controller('invites')
export class InvitesController {
  constructor(private readonly sharing: WeddingSharingService) {}

  @Get(':token')
  @RateLimit(30)
  getInvite(@Param('token') token: string) {
    return this.sharing.getInvite(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  @Roles('Couple')
  @RateLimit(20)
  accept(@Req() req: any, @Param('token') token: string, @Body() body: { leaveOwnPlan?: unknown }) {
    return this.sharing.acceptInvite(token, req.user.sub, body ?? {});
  }
}

/** Xem kế hoạch qua link công khai, chỉ đọc, không cần đăng nhập (docs/api/sharing.md mục 4). */
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
