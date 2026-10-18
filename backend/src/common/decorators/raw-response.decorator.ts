import { SetMetadata } from '@nestjs/common'

export const RAW_RESPONSE_KEY = 'rawResponse'

/**
 * Bỏ qua việc bọc { data } của TransformResponseInterceptor.
 * Dùng cho endpoint mà bên ngoài quy định định dạng (ví dụ callback IPN của VNPay).
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true)
