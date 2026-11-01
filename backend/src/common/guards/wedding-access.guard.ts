import { applyDecorators, CanActivate, ExecutionContext, HttpException, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_RANK, type MemberRole, type PlanTab } from '../../modules/wedding-members/wedding-access';
import { WeddingMembersService } from '../../modules/wedding-members/wedding-members.service';

export interface WeddingAccessOptions {
  /** Quyền tối thiểu (Viewer < Editor < Owner). Bỏ trống: thành viên nào cũng được. */
  role?: MemberRole;
  /** Cần được xem ít nhất một trong các subtab này. */
  tabs?: PlanTab[];
  /** Chưa có đám cưới vẫn cho qua (req.wedding = null), ví dụ GET/PUT /weddings/me lần đầu. */
  optional?: boolean;
}

const WEDDING_ACCESS_KEY = 'weddingAccess';

const forbidden = (code: string, message: string) => new HttpException({ code, message }, 403);

/**
 * Xác định "đám cưới đang dùng" của người gọi từ wedding_members, gắn vào req.wedding, rồi kiểm tra quyền và subtab.
 * Chỉ áp cho tài khoản cặp đôi; NCC đi qua nguyên trạng (controller hội thoại dùng chung hai vai trò).
 * Phải đứng sau JwtAuthGuard (đặt @UseGuards(JwtAuthGuard) ở controller, @WeddingAccess ở method).
 */
@Injectable()
export class WeddingAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly members: WeddingMembersService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<WeddingAccessOptions | undefined>(WEDDING_ACCESS_KEY, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest();
    if (!opts || req.user?.role !== 'Couple') return true;

    const access = await this.members.resolve(req.user.sub);
    req.wedding = access;
    if (!access) {
      if (opts.optional) return true;
      throw new HttpException({ code: 'WEDDING_NOT_SET', message: 'Hãy thiết lập thông tin đám cưới trước.' }, 409);
    }
    if (opts.role && ROLE_RANK[access.role] < ROLE_RANK[opts.role]) {
      throw access.role === 'Viewer'
        ? forbidden('WEDDING_READ_ONLY', 'Bạn đang xem với quyền chỉ xem nên chưa thể thay đổi.')
        : forbidden('WEDDING_FORBIDDEN', 'Chỉ chủ kế hoạch mới làm được thao tác này.');
    }
    if (opts.tabs && !opts.tabs.some((t) => access.tabs.includes(t))) {
      throw forbidden('TAB_FORBIDDEN', 'Bạn chưa được chia sẻ phần này của kế hoạch.');
    }
    return true;
  }
}

/** Gắn kiểm tra quyền trên đám cưới cho một endpoint phía cặp đôi. */
export const WeddingAccess = (opts: WeddingAccessOptions = {}) => applyDecorators(SetMetadata(WEDDING_ACCESS_KEY, opts), UseGuards(WeddingAccessGuard));
