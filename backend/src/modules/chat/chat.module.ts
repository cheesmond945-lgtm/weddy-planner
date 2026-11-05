import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { WeddingsModule } from '../weddings/weddings.module';
import { ConversationsController, VendorConversationsController } from './chat.controller';
import { ChatAutoReplyService } from './chat-auto-reply.service';
import { ChatService } from './chat.service';

@Module({ imports: [CatalogModule, WeddingsModule], controllers: [ConversationsController, VendorConversationsController], providers: [ChatService, ChatAutoReplyService], exports: [ChatService] })
export class ChatModule {}
