import { CanActivate, ExecutionContext, HttpException, Injectable, SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const RATE_LIMIT_KEY = 'rateLimit';

interface RateLimitOptions {
  /** Số lần tối đa trong một cửa sổ */
  limit: number;
  /** Độ dài cửa sổ (ms) */
  windowMs: number;
}

/** Đếm theo IP + route, giữ trong bộ nhớ của tiến trình (chạy nhiều tiến trình thì mỗi tiến trình đếm riêng). */
const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Giới hạn tần suất đơn giản cho endpoint công khai dò được bằng cách thử mã (link mời, link xem).
 * Vượt giới hạn thì 429 RATE_LIMITED.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const opts = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, ctx.getHandler());
    if (!opts) return true;
    const req = ctx.switchToHttp().getRequest();
    const key = `${req.ip ?? req.socket?.remoteAddress ?? '?'}|${req.route?.path ?? req.url}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      return true;
    }
    if (++h.count > opts.limit) throw new HttpException({ code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh, hãy thử lại sau ít phút.' }, 429);
    return true;
  }
}

export const RateLimit = (limit: number, windowMs = 60_000) => applyDecorators(SetMetadata(RATE_LIMIT_KEY, { limit, windowMs }), UseGuards(RateLimitGuard));
