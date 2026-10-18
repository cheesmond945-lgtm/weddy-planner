import { env } from '@/lib/env'
import { authStore } from '@/store/auth'
import type { ApiErrorBody, ApiSuccess } from '@/types/api'

/** Lỗi trả về từ API dạng { error: { code, message } }. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

let onUnauthorized: () => void = () => {}

/** Đăng ký việc cần làm khi API trả 401 (đăng xuất, chuyển về trang đăng nhập). */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

type Query = Record<string, string | number | boolean | undefined | null>

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  query?: Query
  body?: unknown
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(env.apiUrl.replace(/\/$/, '') + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

/** Gọi API, trả về cả { data, meta }. */
export async function requestRaw<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  const { query, body, headers, ...init } = options
  const token = authStore.getToken()
  const isForm = body instanceof FormData

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ.')
  }

  const payload = res.status === 204 ? null : await res.json().catch(() => null)

  if (!res.ok) {
    if (res.status === 401 && token) {
      authStore.clear()
      onUnauthorized()
    }
    const err = (payload as ApiErrorBody | null)?.error
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN_ERROR', err?.message ?? 'Đã có lỗi xảy ra.', err?.details)
  }

  return (payload ?? { data: undefined }) as ApiSuccess<T>
}

/** Gọi API, chỉ trả về phần data. */
export async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  return (await requestRaw<T>(path, options)).data
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
}
