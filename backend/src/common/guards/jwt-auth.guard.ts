import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { AuthRequest, AuthUser } from '../decorators/current-user.decorator.js'

/** Kiểm tra header Authorization: Bearer <token>, gắn payload vào request.user. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>()
    const [type, token] = request.headers.authorization?.split(' ') ?? []

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Bạn cần đăng nhập.' })
    }

    try {
      request.user = await this.jwt.verifyAsync<AuthUser>(token)
    } catch {
      throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' })
    }
    return true
  }
}
