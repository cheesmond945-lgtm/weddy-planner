import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

/** Query phân trang dùng chung: ?page=1&pageSize=20 (xem docs/api/README.md). */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE

  get skip() {
    return (this.page - 1) * this.pageSize
  }

  get take() {
    return this.pageSize
  }
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Service trả về Paginated, interceptor sẽ chuyển thành { data: items, meta }. */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}

  static of<T>(items: T[], total: number, query: Pick<PaginationQueryDto, 'page' | 'pageSize'>) {
    return new Paginated(items, {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    })
  }
}
