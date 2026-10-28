import { Body, Controller, Get, HttpException, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ContentBody, ListQuery, OrdersService } from './orders.service';

/** Đơn dịch vụ phía cặp đôi (docs/api/orders.md). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('orders')
export class CoupleOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.orders.getForCouple(req.user.sub, id);
  }

  /** Dịch vụ của đơn (kể cả khi NCC đang bị ẩn). */
  @Get(':id/service')
  service(@Req() req: any, @Param('id') id: string) {
    return this.orders.serviceOfOrder(req.user.sub, id);
  }

  @Post(':id/revision-requests')
  requestRevision(@Req() req: any, @Param('id') id: string, @Body() body: { note?: string }) {
    return this.orders.requestRevision(req.user.sub, id, body?.note ?? '');
  }
}

/** Đặt cọc qua VietQR + SePay (docs/api/payments.md): xem OrdersService.createDeposit. */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Req() req: any, @Body() body: { orderId?: string }) {
    return this.orders.createDeposit(req.user.sub, String(body?.orderId ?? ''));
  }

  /** Kiểm tra với SePay đã nhận đủ tiền cọc chưa và ghi nhận nếu đã nhận. */
  @Post('check')
  check(@Req() req: any, @Body() body: { orderId?: string }) {
    return this.orders.checkDeposit(req.user.sub, String(body?.orderId ?? ''));
  }
}

/** Đơn dịch vụ phía nhà cung cấp (docs/api/orders.md, phần Nhà cung cấp). */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/orders')
export class VendorOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any, @Query() q: ListQuery) {
    return this.orders.listForVendor(req.user.sub, q);
  }

  @Get('counts')
  counts(@Req() req: any) {
    return this.orders.countsForVendor(req.user.sub);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.orders.getForVendor(req.user.sub, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: { conversationId?: string; content?: ContentBody; send?: boolean }) {
    return this.orders.create(req.user.sub, body ?? {});
  }

  @Put(':id/draft')
  saveDraft(@Req() req: any, @Param('id') id: string, @Body() body: { content?: ContentBody }) {
    return this.orders.saveDraft(req.user.sub, id, body?.content ?? {});
  }

  @Post(':id/send')
  send(@Req() req: any, @Param('id') id: string, @Body() body: { content?: ContentBody }) {
    return this.orders.send(req.user.sub, id, body ?? {});
  }

  @Post(':id/payments')
  recordPayment(@Req() req: any, @Param('id') id: string, @Body() body: { installmentId?: string; amount?: number; paidAt?: string; method?: string }) {
    return this.orders.recordPayment(req.user.sub, id, body ?? {});
  }

  // CSDL không có phương án điều chỉnh sau khi xác nhận/đặt cọc.
  @Post(':id/adjustments')
  adjustments() {
    throw new HttpException({ code: 'ORDER_NOT_ADJUSTABLE', message: 'Hệ thống chưa hỗ trợ lập phương án điều chỉnh cho đơn đã đặt cọc.' }, 409);
  }

  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.orders.cancel(req.user.sub, id, body?.reason ?? '');
  }
}
