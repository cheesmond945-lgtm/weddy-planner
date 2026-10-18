import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { Role } from '../enums/role.enum.js'

/** Thông tin lấy từ JWT. TẠM THỜI: các trường chốt theo docs/api/auth.md. */
export interface AuthUser {
  sub: string
  role: Role
}

export type AuthRequest = Request & { user?: AuthUser }

/** Lấy người dùng hiện tại (do JwtAuthGuard gắn vào request). @CurrentUser('sub') để lấy một trường. */
export const CurrentUser = createParamDecorator((field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest<AuthRequest>().user
  return field ? user?.[field] : user
})
