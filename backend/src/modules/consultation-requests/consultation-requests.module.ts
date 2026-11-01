import { Module } from '@nestjs/common';
import { ConsultationRequestsController } from './consultation-requests.controller';
import { ConsultationRequestsService } from './consultation-requests.service';

@Module({ controllers: [ConsultationRequestsController], providers: [ConsultationRequestsService] })
export class ConsultationRequestsModule {}
