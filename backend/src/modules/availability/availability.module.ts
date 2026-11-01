import { Module } from '@nestjs/common';
import { AvailabilityController, VendorAvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({ controllers: [AvailabilityController, VendorAvailabilityController], providers: [AvailabilityService] })
export class AvailabilityModule {}
