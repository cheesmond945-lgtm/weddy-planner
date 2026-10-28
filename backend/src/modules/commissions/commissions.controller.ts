import { Body, Controller, Get, Param, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CommissionPaymentsService } from './commission-payments.service';
import { CommissionsService } from './commissions.service';

/** Hoa hồng của NCC đang đăng nhập (docs/api/commissions.md). */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService, private readonly payments: CommissionPaymentsService) {}

  @Get()
  list(@Req() req: any) {
    return this.commissions.list(req.user.sub);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.commissions.get(req.user.sub, id);
  }

  /** Bắt đầu thanh toán hoa hồng qua VietQR: trả mã QR, số tiền và nội dung chuyển khoản. */
  @Post(':id/pay')
  pay(@Req() req: any, @Param('id') id: string) {
    return this.payments.pay(req.user.sub, id);
  }

  /** Kiểm tra với SePay đã nhận đủ hoa hồng chưa và ghi nhận nếu đã nhận. */
  @Post(':id/check')
  check(@Req() req: any, @Param('id') id: string) {
    return this.payments.check(req.user.sub, id);
  }

  @Post(':id/payments')
  submitPayment() {
    return this.commissions.submitPayment();
  }
}
