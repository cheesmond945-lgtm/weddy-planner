import { BadRequestException, type ValidationError } from '@nestjs/common'

export interface FieldError {
  field: string
  messages: string[]
}

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property
    const own = e.constraints ? [{ field, messages: Object.values(e.constraints) }] : []
    return [...own, ...flatten(e.children ?? [], field)]
  })
}

/** Lỗi ValidationPipe → { error: { code: "VALIDATION_ERROR", message, details: [{ field, messages }] } }. */
export function validationExceptionFactory(errors: ValidationError[]) {
  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Dữ liệu gửi lên không hợp lệ.',
    details: flatten(errors),
  })
}
