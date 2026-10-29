import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtUser } from '../../common/guards/jwt-auth.guard';
import { onPublish } from './realtime.bus';

const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim());

/**
 * Socket.IO tại /socket.io (cùng cổng với API). FE kết nối với `auth: { token }` (JWT như header Authorization);
 * token sai hoặc hết hạn thì ngắt. Mỗi người dùng vào phòng `user:<id>`, nhận các sự kiện của realtime.bus:
 * - message { conversationId, orderId?, type }: có tin mới trong hội thoại (gồm tin hệ thống và thẻ đơn, nên đơn đổi trạng thái cũng báo qua đây)
 * - read { conversationId }: một bên đã đọc hội thoại
 * - notification { type, referenceType?, referenceId? }: có thông báo mới
 */
@WebSocketGateway({ cors: { origin: origins, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly log = new Logger('Realtime');
  private unsubscribe?: () => void;

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly jwt: JwtService) {}

  afterInit() {
    this.unsubscribe = onPublish((e) => {
      this.server.to(e.users.map((id) => `user:${id}`)).emit(e.event, e.data);
    });
  }

  handleConnection(client: Socket) {
    const token = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    try {
      if (typeof token !== 'string' || !token) throw new Error('missing token');
      const user = this.jwt.verify<JwtUser>(token);
      void client.join(`user:${user.sub}`);
    } catch {
      client.emit('unauthorized');
      client.disconnect(true);
    }
  }

  onModuleDestroy() {
    this.unsubscribe?.();
    this.log.log('Đã dừng realtime');
  }
}
