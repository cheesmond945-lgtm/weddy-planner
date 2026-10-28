import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CommissionsService } from './commissions.service';

/** Hoa hồng của NCC đang đăng nhập (docs/api/commissions.md). */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  @Get()
  list(@Req() req: any) {
    return this.commissions.list(req.user.sub);
  }

  @Get(':id/lines')
  lines(@Req() req: any, @Param('id') id: string) {
    return this.commissions.lines(req.user.sub, id);
  }

  @HttpCode(200)
  @Post(':id/pay')
  pay(@Req() req: any, @Param('id') id: string) {
    return this.commissions.pay(req.user.sub, id);
  }
}
