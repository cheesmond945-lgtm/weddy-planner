import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrderTasksService } from './order-tasks.service';
import { ListQuery, OrdersService } from './orders.service';
import type { ContentInput } from './order-rules';

/** Đơn dịch vụ phía cặp đôi (docs/api/orders.md, docs/THE_DON_PHIA_KHACH.md). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('orders')
export class CoupleOrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Mọi đơn đã gửi của khách (không có nháp), cho trang Kế hoạch; lọc tùy chọn theo ?status= */
  @Get()
  list(@Req() req: any, @Query('status') status?: string) {
    return this.orders.listForCouple(req.user.sub, { status });
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.orders.getForCouple(req.user.sub, id);
  }

  /** Yêu cầu chỉnh sửa (Pending; hoặc Deposited trước ngày thực hiện, tiền cọc giữ nguyên): { changes?: ['Item'|'Quantity'|'EventDate'|'Other'], note } */
  @HttpCode(200)
  @Post(':id/revision-requests')
  requestRevision(@Req() req: any, @Param('id') id: string, @Body() body: { changes?: unknown; note?: string }) {
    return this.orders.requestRevision(req.user.sub, id, body ?? {});
  }
}

/** Đặt cọc (docs/api/payments.md). VNPay thật hoặc giả lập theo PAYMENT_MODE: xem OrdersService.createDeposit và paymentMode() trong order-rules.ts. */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly orders: OrdersService) {}

  @HttpCode(200)
  @Post()
  create(@Req() req: any, @Body() body: { orderId?: string; method?: string }) {
    return this.orders.createDeposit(req.user.sub, String(body?.orderId ?? ''), String(body?.method ?? ''), req.ip);
  }

  /** Kết quả VNPay quay về trang đơn (body = các tham số vnp_* trên URL quay về). */
  @HttpCode(200)
  @Post('vnpay/confirm')
  confirm(@Req() req: any, @Body() body: Record<string, string>) {
    return this.orders.confirmDeposit(req.user.sub, body ?? {});
  }
}

/** Đơn dịch vụ phía nhà cung cấp (docs/api/orders.md, phần Nhà cung cấp). */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me/orders')
export class VendorOrdersController {
  constructor(private readonly orders: OrdersService, private readonly tasks: OrderTasksService) {}

  @Get()
  list(@Req() req: any, @Query() q: ListQuery) {
    return this.orders.listForVendor(req.user.sub, q);
  }

  @Get('counts')
  counts(@Req() req: any) {
    return this.orders.countsForVendor(req.user.sub);
  }

  /** Tiến độ việc của các đơn đang thực hiện: { [orderId]: { open, overdueVendor, overdueCustomer, dueSoonVendor } }. */
  @Get('progress')
  progress(@Req() req: any) {
    return this.tasks.progress(req.user.sub);
  }

  /** Lịch làm việc: ?from=YYYY-MM-DD&to=YYYY-MM-DD (tối đa 100 ngày). */
  @Get('calendar')
  calendar(@Req() req: any, @Query('from') from: string, @Query('to') to: string) {
    return this.tasks.calendar(req.user.sub, from, to);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.orders.getForVendor(req.user.sub, id);
  }

  /** "Tiến độ đơn": việc chi tiết gắn với đơn và tóm tắt. */
  @Get(':id/tasks')
  taskList(@Req() req: any, @Param('id') id: string) {
    return this.tasks.list(req.user.sub, id);
  }

  /** NCC đánh dấu xong / mở lại việc của NCC (hoặc hai bên): { isDone }. */
  @Patch(':id/tasks/:taskId')
  taskDone(@Req() req: any, @Param('id') id: string, @Param('taskId') taskId: string, @Body() body: { isDone?: unknown }) {
    return this.tasks.setDone(req.user.sub, id, taskId, body?.isDone);
  }

  @Post()
  create(@Req() req: any, @Body() body: { conversationId?: string; content?: ContentInput; send?: boolean }) {
    return this.orders.create(req.user.sub, body ?? {});
  }

  @Put(':id/draft')
  saveDraft(@Req() req: any, @Param('id') id: string, @Body() body: { content?: ContentInput }) {
    return this.orders.saveDraft(req.user.sub, id, body?.content ?? {});
  }

  /** Gửi đơn nháp, hoặc "Cập nhật đơn" (Pending, NeedRevision). */
  @HttpCode(200)
  @Post(':id/send')
  send(@Req() req: any, @Param('id') id: string, @Body() body: { content?: ContentInput }) {
    return this.orders.send(req.user.sub, id, body ?? {});
  }

  /** Sửa đơn sau cọc (Deposited). */
  @Patch(':id')
  edit(@Req() req: any, @Param('id') id: string, @Body() body: { content?: ContentInput; changeNote?: string }) {
    return this.orders.editDeposited(req.user.sub, id, body ?? {});
  }

  /** Từ chối yêu cầu chỉnh sửa của khách với đơn đã cọc: { note? } */
  @HttpCode(200)
  @Post(':id/revision-requests/reject')
  rejectRevision(@Req() req: any, @Param('id') id: string, @Body() body: { note?: string }) {
    return this.orders.rejectRevision(req.user.sub, id, body ?? {});
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string; note?: string }) {
    return this.orders.cancel(req.user.sub, id, body ?? {});
  }

  @HttpCode(200)
  @Post(':id/complete')
  complete(@Req() req: any, @Param('id') id: string) {
    return this.orders.complete(req.user.sub, id);
  }

  @HttpCode(200)
  @Post(':id/final-invoice')
  finalInvoice(@Req() req: any, @Param('id') id: string) {
    return this.orders.finalInvoice(req.user.sub, id);
  }
}
