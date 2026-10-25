import { Module } from '@nestjs/common';
import { AdminConsultationsService } from './admin-consultations.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminReviewsService } from './admin-reviews.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';

@Module({
  controllers: [AdminController],
  providers: [AdminDashboardService, AdminConsultationsService, AdminUsersService, AdminReviewsService, AdminPaymentsService, AdminNotificationsService],
})
export class AdminModule {}
