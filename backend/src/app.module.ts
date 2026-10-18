import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js'
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { CatalogModule } from './modules/catalog/catalog.module.js'
import { ChatModule } from './modules/chat/chat.module.js'
import { CommissionsModule } from './modules/commissions/commissions.module.js'
import { ConsultationRequestsModule } from './modules/consultation-requests/consultation-requests.module.js'
import { FavoritesModule } from './modules/favorites/favorites.module.js'
import { NotificationsModule } from './modules/notifications/notifications.module.js'
import { OrdersModule } from './modules/orders/orders.module.js'
import { PaymentsModule } from './modules/payments/payments.module.js'
import { SearchModule } from './modules/search/search.module.js'
import { UsersModule } from './modules/users/users.module.js'
import { VendorsModule } from './modules/vendors/vendors.module.js'
import { WeddingsModule } from './modules/weddings/weddings.module.js'
import { PrismaModule } from './prisma/prisma.module.js'

@Module({
  imports: [
    // JwtService dùng chung cho JwtAuthGuard (và module auth sau này)
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET
        if (!secret) throw new Error('Thiếu JWT_SECRET trong backend/.env')
        return {
          secret,
          signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as JwtSignOptions['expiresIn'] },
        }
      },
    }),
    PrismaModule,

    AuthModule,
    UsersModule,
    WeddingsModule,
    SearchModule,
    FavoritesModule,
    ConsultationRequestsModule,
    VendorsModule,
    CatalogModule,
    ChatModule,
    OrdersModule,
    PaymentsModule,
    CommissionsModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
  ],
})
export class AppModule {}
