import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './integrations/mail/mail.module';
import { StorageModule } from './integrations/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { HealthModule } from './modules/health/health.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { CompareModule } from './modules/compare/compare.module';
import { WeddingsModule } from './modules/weddings/weddings.module';
import { ChatModule } from './modules/chat/chat.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ConsultationRequestsModule } from './modules/consultation-requests/consultation-requests.module';

@Module({
  imports: [PrismaModule, StorageModule, MailModule, AuthModule, CatalogModule, VendorsModule, HealthModule, FavoritesModule, CompareModule, WeddingsModule, ChatModule, OrdersModule, CommissionsModule, AdminModule, ConsultationRequestsModule, NotificationsModule],
})
export class AppModule {}
