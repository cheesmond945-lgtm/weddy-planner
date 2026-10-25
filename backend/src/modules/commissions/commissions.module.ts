import { Module } from '@nestjs/common';
import { CommissionsController } from './commissions.controller';
import { CommissionPaymentsService } from './commission-payments.service';
import { CommissionRemindersService } from './commission-reminders.service';
import { CommissionsService } from './commissions.service';

@Module({ controllers: [CommissionsController], providers: [CommissionsService, CommissionRemindersService, CommissionPaymentsService] })
export class CommissionsModule {}
