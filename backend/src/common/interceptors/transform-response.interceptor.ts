import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, StreamableFile } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { map, type Observable } from 'rxjs'
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator.js'
import { Paginated } from '../utils/pagination.js'

/**
 * Bọc kết quả thành công: { data }.
 * Service trả Paginated thì thành { data: items, meta }. Bỏ qua khi có @RawResponse() hoặc trả file.
 */
@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [context.getHandler(), context.getClass()])
    if (raw) return next.handle()

    return next.handle().pipe(
      map((result: unknown) => {
        if (result instanceof StreamableFile) return result
        if (result instanceof Paginated) return { data: result.items, meta: result.meta }
        return { data: result ?? null }
      }),
    )
  }
}
