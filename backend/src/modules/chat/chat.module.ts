import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { WeddingsModule } from '../weddings/weddings.module';
import { ConversationsController, VendorConversationsController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({ imports: [CatalogModule, WeddingsModule], controllers: [ConversationsController, VendorConversationsController], providers: [ChatService], exports: [ChatService] })
export class ChatModule {}
