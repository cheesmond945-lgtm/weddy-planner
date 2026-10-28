import { Module } from '@nestjs/common';
import { VendorMeController } from './vendor-me.controller';
import { VendorPackagesController } from './vendor-packages.controller';
import { VendorPackagesService } from './vendor-packages.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { VendorProfileService } from './vendor-profile.service';
import { VendorsController } from './vendors.controller';

@Module({
  controllers: [VendorsController, VendorMeController, VendorPackagesController],
  imports: [NotificationsModule],
  providers: [VendorProfileService, VendorPackagesService],
})
export class VendorsModule {}
