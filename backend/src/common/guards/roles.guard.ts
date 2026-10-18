import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthRequest } from '../decorators/current-user.decorator.js'
import { ROLES_KEY } from '../decorators/roles.decorator.js'
import type { Role } from '../enums/role.enum.js'

/** Chặn theo @Roles(). Phải đứng sau JwtAuthGuard. Không có @Roles() thì cho qua. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()])
    if (!roles?.length) return true

    const user = context.switchToHttp().getRequest<AuthRequest>().user
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.' })
    }
    return true
  }
}
