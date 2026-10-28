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

  /** Kết quả quay về từ VNPay (body = các tham số vnp_* trên URL quay về). */
  @Post('vnpay/confirm')
  confirmPayment(@Req() req: any, @Body() body: Record<string, string>) {
    return this.payments.confirm(req.user.sub, body ?? {});
  }

  /** Thông tin lượt thanh toán của trang VNPay giả lập. */
  @Get('vnpay/intent/:ref')
  intent(@Req() req: any, @Param('ref') ref: string) {
    return this.payments.intent(req.user.sub, ref);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.commissions.get(req.user.sub, id);
  }

  /** Bắt đầu thanh toán hoa hồng qua VNPay: trả URL để chuyển trình duyệt tới. */
  @Post(':id/pay')
  pay(@Req() req: any, @Param('id') id: string) {
    return this.payments.pay(req.user.sub, id, req.ip);
  }

  @Post(':id/payments')
  submitPayment() {
    return this.commissions.submitPayment();
  }
}
