import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminConsultationsService, ConsultationQueryDto, UpdateConsultationDto } from './admin-consultations.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminPaymentsService, RecordPaymentDto, StatementQueryDto } from './admin-payments.service';
import { AdminReviewsService, ReviewQueryDto, VendorQueryDto } from './admin-reviews.service';
import { AdminUsersService, SaveUserDto, UserQueryDto } from './admin-users.service';

/** Cổng quản trị (docs/api/admin.md). Chỉ role Admin. */
@UseGuards(JwtAuthGuard)
@Roles('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly consultations: AdminConsultationsService,
    private readonly users: AdminUsersService,
    private readonly reviews: AdminReviewsService,
    private readonly payments: AdminPaymentsService,
    private readonly notifications: AdminNotificationsService,
  ) {}

  @Get('counts')
  counts() {
    return this.dashboard.counts();
  }

  @Get('dashboard')
  dash() {
    return this.dashboard.dashboard();
  }

  // ----- Thông báo của Admin đang đăng nhập -----
  @Get('notifications')
  listNotifications(@Req() req: any, @Query('limit') limit?: string) {
    return this.notifications.list(req.user.sub, limit);
  }

  @Post('notifications/read-all')
  readAllNotifications(@Req() req: any) {
    return this.notifications.markAllRead(req.user.sub);
  }

  @Post('notifications/:id/read')
  readNotification(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }

  // ----- Yêu cầu tư vấn -----
  @Get('consultation-requests')
  listConsultations(@Query() q: ConsultationQueryDto) {
    return this.consultations.list(q);
  }

  @Patch('consultation-requests/:id')
  updateConsultation(@Param('id') id: string, @Body() body: UpdateConsultationDto) {
    return this.consultations.update(id, body ?? {});
  }

  @Delete('consultation-requests/:id')
  removeConsultation(@Param('id') id: string) {
    return this.consultations.remove(id);
  }

  // ----- Người dùng -----
  @Get('users')
  listUsers(@Query() q: UserQueryDto) {
    return this.users.list(q);
  }

  @Post('users')
  createUser(@Body() body: SaveUserDto) {
    return this.users.create(body ?? {});
  }

  // Sửa NCC có đổi email thì cấp mật khẩu mới gửi tới email mới (cần identityVerified)
  @Patch('users/:id')
  updateUser(@Req() req: any, @Param('id') id: string, @Body() body: SaveUserDto) {
    return this.users.update(id, body ?? {}, req.user.sub);
  }

  @Post('users/:id/lock')
  lockUser(@Param('id') id: string) {
    return this.users.setStatus(id, true);
  }

  @Post('users/:id/unlock')
  unlockUser(@Param('id') id: string) {
    return this.users.setStatus(id, false);
  }

  @Delete('users/:id')
  deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.users.remove(id, req.user.sub);
  }

  // ----- Duyệt hồ sơ nhà cung cấp -----
  @Get('vendors')
  listVendors(@Query() q: VendorQueryDto) {
    return this.reviews.listVendors(q);
  }

  @Get('vendors/:id')
  getVendor(@Param('id') id: string) {
    return this.reviews.getVendor(id);
  }

  @Post('vendors/:id/approve')
  approveVendor(@Param('id') id: string) {
    return this.reviews.reviewVendor(id);
  }

  @Post('vendors/:id/request-revision')
  vendorRevision(@Param('id') id: string, @Body() body: { note?: string }) {
    return this.reviews.reviewVendor(id, body?.note ?? '');
  }

  // ----- Duyệt gói dịch vụ -----
  @Get('packages')
  listPackages(@Query() q: VendorQueryDto) {
    return this.reviews.listPackages(q);
  }

  @Get('packages/:id')
  getPackage(@Param('id') id: string) {
    return this.reviews.getPackage(id);
  }

  @Post('packages/:id/approve')
  approvePackage(@Param('id') id: string) {
    return this.reviews.reviewPackage(id);
  }

  @Post('packages/:id/request-revision')
  packageRevision(@Param('id') id: string, @Body() body: { note?: string }) {
    return this.reviews.reviewPackage(id, body?.note ?? '');
  }

  // ----- Thanh toán hoa hồng -----
  @Get('commissions')
  listStatements(@Query() q: StatementQueryDto) {
    return this.payments.list(q);
  }

  @Get('commissions/:id')
  statementDetail(@Param('id') id: string) {
    return this.payments.detail(id);
  }

  /** Ghi nhận đã thanh toán khi NCC chuyển khoản ngoài VNPay (tuỳ chọn mở khóa tài khoản NCC) */
  @Post('commissions/:id/record-payment')
  recordPayment(@Param('id') id: string, @Body() body: RecordPaymentDto) {
    return this.payments.recordPayment(id, body ?? {});
  }
}
