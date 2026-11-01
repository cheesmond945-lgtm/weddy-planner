import { Module } from '@nestjs/common';
import { VietqrModule } from '../../integrations/vietqr/vietqr.module';
import { CommissionsController } from './commissions.controller';
import { CommissionPaymentsService } from './commission-payments.service';
import { CommissionRemindersService } from './commission-reminders.service';
import { CommissionsService } from './commissions.service';

@Module({ imports: [VietqrModule], controllers: [CommissionsController], providers: [CommissionsService, CommissionRemindersService, CommissionPaymentsService], exports: [CommissionPaymentsService] })
export class CommissionsModule {}
