import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrderAdjustmentsService } from './order-adjustments.service';
import { OrderTasksService } from './order-tasks.service';
import { ListQuery, OrdersService } from './orders.service';
import type { ContentInput } from './order-rules';

/**
 * Đơn dịch vụ phía cặp đôi (docs/api/orders.md, docs/THE_DON_PHIA_KHACH.md).
 */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('orders')
export class CoupleOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly adjustments: OrderAdjustmentsService,
  ) {}

  /** Xem trước đổi số khách (đơn tiệc đã cọc): ?guestCount= → số bàn, giá trị mới, cọc bổ sung */
  @Get(':id/guest-changes/quote')
  quoteGuestChange(@Req() req: any, @Param('id') id: string, @Query('guestCount') guestCount?: string) {
    return this.adjustments.quote(req.user.sub, id, guestCount);
  }

  /** Gửi yêu cầu đổi số khách: { guestCount, note? } → chờ NCC xác nhận */
  @HttpCode(200)
  @Post(':id/guest-changes')
  requestGuestChange(@Req() req: any, @Param('id') id: string, @Body() body: { guestCount?: unknown; note?: unknown }) {
    return this.adjustments.request(req.user.sub, id, body ?? {});
  }

  /** Mã QR nộp cọc bổ sung (NCC đã đồng ý, giá trị đơn tăng) */
  @HttpCode(200)
  @Post(':id/guest-changes/pay')
  payGuestChange(@Req() req: any, @Param('id') id: string) {
    return this.adjustments.payInfo(req.user.sub, id);
  }

  @HttpCode(200)
  @Post(':id/guest-changes/pay/check')
  checkGuestChangePay(@Req() req: any, @Param('id') id: string) {
    return this.adjustments.checkPay(req.user.sub, id);
  }

  /** Chế độ thử (PAYMENT_DEMO_MODE=true): ghi nhận cọc bổ sung ngay */
  @HttpCode(200)
  @Post(':id/guest-changes/pay/demo-confirm')
  demoGuestChangePay(@Req() req: any, @Param('id') id: string) {
    return this.adjustments.demoPay(req.user.sub, id);
  }

  /** Khách yêu cầu hủy đơn đã cọc (cọc không hoàn): { note? } */
  @HttpCode(200)
  @Post(':id/cancel-requests')
  requestCancel(@Req() req: any, @Param('id') id: string, @Body() body: { note?: unknown }) {
    return this.adjustments.requestCancel(req.user.sub, id, body ?? {});
  }

  /** Rút yêu cầu hủy */
  @Delete(':id/cancel-requests')
  withdrawCancel(@Req() req: any, @Param('id') id: string) {
    return this.adjustments.withdrawCancel(req.user.sub, id);
  }

  /** Mọi đơn đã gửi của khách (không có nháp), cho trang Kế hoạch; lọc tùy chọn theo ?status= */
  @Get()
  list(@Req() req: any, @Query('status') status?: string) {
    return this.orders.listForCouple(req.user.sub, { status });
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.orders.getForCouple(req.user.sub, id);
  }

  /** Dịch vụ của đơn (kể cả khi NCC đang bị ẩn). */
  @Get(':id/service')
  service(@Req() req: any, @Param('id') id: string) {
    return this.orders.serviceOfOrder(req.user.sub, id);
  }

  /** Yêu cầu chỉnh sửa (Pending; hoặc Deposited trước ngày thực hiện, tiền cọc giữ nguyên): { changes?: ['Item'|'Quantity'|'EventDate'|'Other'], note } */
  @HttpCode(200)
  @Post(':id/revision-requests')
  requestRevision(@Req() req: any, @Param('id') id: string, @Body() body: { changes?: unknown; note?: string }) {
    return this.orders.requestRevision(req.user.sub, id, body ?? {});
  }
}

/** Đặt cọc qua VietQR + SePay (docs/api/payments.md): xem OrdersService.createDeposit. */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly orders: OrdersService) {}

  @HttpCode(200)
  @Post()
  create(@Req() req: any, @Body() body: { orderId?: string }) {
    return this.orders.createDeposit(req.user.sub, String(body?.orderId ?? ''));
  }

  /** Chế độ thử (PAYMENT_DEMO_MODE=true): ghi nhận đã cọc ngay. Tắt chế độ thì trả 404. */
  @Post('demo-confirm')
  demoConfirm(@Req() req: any, @Body() body: { orderId?: string }) {
    return this.orders.confirmDemoDeposit(req.user.sub, String(body?.orderId ?? ''));
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
  constructor(
    private readonly orders: OrdersService,
    private readonly tasks: OrderTasksService,
    private readonly adjustments: OrderAdjustmentsService,
  ) {}

  /** Đồng ý yêu cầu đổi số khách (tăng giá trị thì chờ khách nộp cọc bổ sung) */
  @HttpCode(200)
  @Post(':id/guest-changes/approve')
  approveGuestChange(@Req() req: any, @Param('id') id: string) {
    return this.adjustments.approve(req.user.sub, id);
  }

  /** Từ chối yêu cầu đổi số khách: { note? } */
  @HttpCode(200)
  @Post(':id/guest-changes/reject')
  rejectGuestChange(@Req() req: any, @Param('id') id: string, @Body() body: { note?: unknown }) {
    return this.adjustments.reject(req.user.sub, id, body ?? {});
  }

  /** Từ chối yêu cầu hủy của khách: { note? }. Đồng ý: POST :id/cancel với reason CUSTOMER_REQUEST */
  @HttpCode(200)
  @Post(':id/cancel-requests/reject')
  rejectCancel(@Req() req: any, @Param('id') id: string, @Body() body: { note?: unknown }) {
    return this.adjustments.rejectCancel(req.user.sub, id, body ?? {});
  }

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

  /** Bảng việc (kanban): mọi việc chi tiết của các đơn đang thực hiện, kèm mã đơn, tên khách, ngày thực hiện. */
  @Get('tasks')
  board(@Req() req: any) {
    return this.tasks.board(req.user.sub);
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

  /** Thêm việc RIÊNG cho đơn đã cọc: { title, note?, owner, date, addToPackage? }. Đã chốt ngày; addToPackage thêm luôn vào gói (chỉ áp cho đơn sau). */
  @Post(':id/tasks')
  taskAdd(@Req() req: any, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.tasks.addTask(req.user.sub, id, body ?? {});
  }

  /**
   * Một việc chi tiết của đơn: đổi trạng thái ({ status: 'Todo' | 'Waiting' | 'Done' }, mọi việc, vẫn nhận { isDone } của FE cũ)
   * hoặc sửa việc riêng 'ORD:' ({ title?, note?, owner? }).
   */
  @Patch(':id/tasks/:taskId')
  taskStatus(@Req() req: any, @Param('id') id: string, @Param('taskId') taskId: string, @Body() body: Record<string, unknown>) {
    return this.tasks.patchTask(req.user.sub, id, taskId, body ?? {});
  }

  /** "Bỏ việc khỏi đơn": việc 'PKG:' hoặc 'ORD:' chưa xong; không đụng gói và đơn khác, không bỏ được thanh toán. */
  @Delete(':id/tasks/:taskId')
  taskRemove(@Req() req: any, @Param('id') id: string, @Param('taskId') taskId: string) {
    return this.tasks.removeTask(req.user.sub, id, taskId);
  }

  /** "Chốt ngày này" (không gửi date) hoặc "Đổi ngày" ({ date: 'YYYY-MM-DD' }) của một việc. */
  @Patch(':id/tasks/:taskId/schedule')
  taskSchedule(@Req() req: any, @Param('id') id: string, @Param('taskId') taskId: string, @Body() body: { date?: unknown; undo?: unknown; confirmed?: unknown }) {
    return this.tasks.confirmSchedule(req.user.sub, id, taskId, body?.date, { undo: body?.undo === true, confirmed: typeof body?.confirmed === 'boolean' ? body.confirmed : undefined });
  }

  /** "Bỏ chốt": xóa xác nhận ngày, giữ nguyên ngày. */
  @Delete(':id/tasks/:taskId/schedule')
  taskUnconfirm(@Req() req: any, @Param('id') id: string, @Param('taskId') taskId: string) {
    return this.tasks.unconfirmSchedule(req.user.sub, id, taskId);
  }

  @Post()
  create(@Req() req: any, @Body() body: { conversationId?: string; content?: ContentInput; send?: boolean }) {
    return this.orders.create(req.user.sub, body ?? {});
  }

  @Put(':id/draft')
  saveDraft(@Req() req: any, @Param('id') id: string, @Body() body: { content?: ContentInput; expectedVersion?: string }) {
    return this.orders.saveDraft(req.user.sub, id, body?.content ?? {}, body?.expectedVersion);
  }

  /** Gửi đơn nháp, hoặc "Chỉnh sửa đơn" (Pending, NeedRevision). */
  @HttpCode(200)
  @Post(':id/send')
  send(@Req() req: any, @Param('id') id: string, @Body() body: { content?: ContentInput; expectedVersion?: string }) {
    return this.orders.send(req.user.sub, id, body ?? {});
  }

  /** Sửa đơn sau cọc (Deposited). */
  @Patch(':id')
  edit(@Req() req: any, @Param('id') id: string, @Body() body: { content?: ContentInput; changeNote?: string; expectedVersion?: string }) {
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

  /** Hoàn tất đơn. Chưa ghi nhận đã nhận tiền mặt phần còn lại: gửi { restReceived: true } để ghi nhận cùng lúc, không thì 409 REST_PAYMENT_NOT_RECORDED. */
  @HttpCode(200)
  @Post(':id/complete')
  complete(@Req() req: any, @Param('id') id: string, @Body() body: { restReceived?: unknown }) {
    return this.orders.complete(req.user.sub, id, body ?? {});
  }

  /** Ghi nhận đã nhận đủ tiền mặt phần còn lại (đợt 2). */
  @HttpCode(200)
  @Post(':id/rest-payment')
  recordRestPayment(@Req() req: any, @Param('id') id: string) {
    return this.orders.recordRestPayment(req.user.sub, id);
  }

  /** Bỏ ghi nhận đợt 2. */
  @Delete(':id/rest-payment')
  clearRestPayment(@Req() req: any, @Param('id') id: string) {
    return this.orders.clearRestPayment(req.user.sub, id);
  }

  @HttpCode(200)
  @Post(':id/final-invoice')
  finalInvoice(@Req() req: any, @Param('id') id: string) {
    return this.orders.finalInvoice(req.user.sub, id);
  }
}
