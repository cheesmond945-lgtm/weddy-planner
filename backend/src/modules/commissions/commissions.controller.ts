import { Controller, Get, Param, Post, UseGuards, Req } from '@nestjs/common';
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

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.commissions.get(req.user.sub, id);
  }

  @Post(':id/payments')
  submitPayment() {
    return this.commissions.submitPayment();
  }
}
