import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Response } from 'express'

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
}

interface ErrorBody {
  code: string
  message: string
  details?: unknown
}

/** Mọi lỗi trả về dạng { error: { code, message, details? } } (xem docs/api/README.md). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()
    const { status, body } = this.toError(exception)

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception)
    }
    res.status(status).json({ error: body })
  }

  private toError(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const raw = exception.getResponse()
      const fallbackCode = CODE_BY_STATUS[status] ?? 'ERROR'

      if (typeof raw === 'string') {
        return { status, body: { code: fallbackCode, message: raw } }
      }
      const r = raw as { code?: string; message?: string | string[]; details?: unknown }
      const message = Array.isArray(r.message) ? r.message.join('; ') : (r.message ?? exception.message)
      return { status, body: { code: r.code ?? fallbackCode, message, ...(r.details !== undefined && { details: r.details }) } }
    }

    // Lỗi Prisma thường gặp (nhận diện theo tên để không phụ thuộc client đã generate)
    const prismaCode = (exception as { name?: string; code?: string })?.name === 'PrismaClientKnownRequestError'
      ? (exception as { code: string }).code
      : undefined
    if (prismaCode === 'P2002') {
      return { status: HttpStatus.CONFLICT, body: { code: 'CONFLICT', message: 'Dữ liệu đã tồn tại.' } }
    }
    if (prismaCode === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, body: { code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu.' } }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Đã có lỗi xảy ra, vui lòng thử lại sau.' },
    }
  }
}
