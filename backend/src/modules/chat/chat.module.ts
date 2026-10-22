import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { WeddingsModule } from '../weddings/weddings.module';
import { CoupleChatController, VendorChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({ imports: [CatalogModule, WeddingsModule], controllers: [CoupleChatController, VendorChatController], providers: [ChatService], exports: [ChatService] })
export class ChatModule {}
