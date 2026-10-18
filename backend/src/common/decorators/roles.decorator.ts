import { SetMetadata } from '@nestjs/common'
import type { Role } from '../enums/role.enum.js'

export const ROLES_KEY = 'roles'

/** Giới hạn role được gọi endpoint. Dùng cùng @UseGuards(JwtAuthGuard, RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)
