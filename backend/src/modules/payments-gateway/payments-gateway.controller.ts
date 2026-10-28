import { Controller, Get, Logger, Query } from '@nestjs/common';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { IPN_MESSAGE, parseTxnRef, verifyResult, vnpayLive, type IpnCode } from '../../integrations/vnpay/vnpay';
import { CommissionPaymentsService } from '../commissions/commission-payments.service';
import { OrdersService } from '../orders/orders.service';

/**
 * IPN của VNPay: máy chủ VNPay gọi GET /api/payments/vnpay/ipn?vnp_... sau mỗi giao dịch (đặt cọc và hoa hồng).
 * Công khai (không đăng nhập), xác thực bằng chữ ký. Trả đúng định dạng VNPay quy định { RspCode, Message } (không bọc { data }).
 * Chỉ chạy được khi backend có địa chỉ công khai và URL này đã được khai báo với VNPay; chạy cục bộ thì trang quay về vẫn ghi nhận.
 */
@RawResponse()
@Controller('payments/vnpay')
export class PaymentsGatewayController {
  private readonly log = new Logger(PaymentsGatewayController.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly commissions: CommissionPaymentsService,
  ) {}

  @Get('ipn')
  async ipn(@Query() q: Record<string, string>) {
    const reply = (code: IpnCode) => ({ RspCode: code, Message: IPN_MESSAGE[code] });
    try {
      if (!vnpayLive()) return reply('99');
      const r = verifyResult(q ?? {});
      if (!r.valid) return reply('97');
      const t = parseTxnRef(r.txnRef);
      if (!t) return reply('01');
      const code = t.kind === 'DEPOSIT' ? await this.orders.ipnDeposit(t.id, r) : await this.commissions.ipn(t.id, r);
      this.log.log(`IPN VNPay ${t.kind} ${r.txnRef} (mã phản hồi ${q.vnp_ResponseCode}): trả ${code}`);
      return reply(code);
    } catch (e) {
      this.log.error(`IPN VNPay lỗi: ${(e as Error).message}`);
      return reply('99');
    }
  }
}
