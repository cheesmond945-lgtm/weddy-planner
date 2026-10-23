import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

export interface JwtUser { sub: string; username: string; role: Role }

/** Kiểm tra header "Authorization: Bearer <token>" và (nếu có @Roles) vai trò */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Chưa đăng nhập');
    try {
      req.user = this.jwt.verify<JwtUser>(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập hết hạn');
    }
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(req.user.role)) throw new ForbiddenException('Không có quyền');
    return true;
  }
}
