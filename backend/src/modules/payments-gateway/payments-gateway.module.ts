import { Module } from '@nestjs/common';
import { CommissionsModule } from '../commissions/commissions.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsGatewayController } from './payments-gateway.controller';

/** Callback của cổng thanh toán (IPN VNPay) cho đặt cọc và hoa hồng. */
@Module({ imports: [OrdersModule, CommissionsModule], controllers: [PaymentsGatewayController] })
export class PaymentsGatewayModule {}
