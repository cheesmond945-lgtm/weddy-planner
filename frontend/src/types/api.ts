/** Khuôn response chung, theo docs/api/README.md. */
export interface ApiSuccess<T> {
  data: T
  meta?: PageMeta
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}
