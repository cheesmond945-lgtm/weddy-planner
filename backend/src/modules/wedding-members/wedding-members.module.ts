import { Global, Module } from '@nestjs/common';
import { WeddingMembersController } from './wedding-members.controller';
import { WeddingMembersService } from './wedding-members.service';

/** Global: WeddingAccessGuard ở các module khác (weddings, chat, orders) cần WeddingMembersService. */
@Global()
@Module({ controllers: [WeddingMembersController], providers: [WeddingMembersService], exports: [WeddingMembersService] })
export class WeddingMembersModule {}
