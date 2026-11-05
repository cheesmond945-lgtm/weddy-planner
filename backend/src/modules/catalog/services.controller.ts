import { Controller, Get, HttpException, Param, Query, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtUser } from '../../common/guards/jwt-auth.guard';
import { QUERY_MAX_LENGTH } from './search.config';
import { SearchService } from './search.service';
import { ServicesService } from './services.service';

const num = (v?: string) => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Danh sách phong cách từ tham số "a,b" */
const list = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

/** Các đường dẫn frontend gọi (docs/api/catalog.md), tách riêng khỏi /catalog/* cũ. */
@Controller()
export class ServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly search: SearchService,
    private readonly jwt: JwtService,
  ) {}

  /** Endpoint công khai: có token hợp lệ thì biết người xem (số bàn dự kiến, hạn mức AI theo tài khoản); không có thì là khách vãng lai */
  private viewer(req: Request): string | null {
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) return null;
    try {
      return this.jwt.verify<JwtUser>(token).sub;
    } catch {
      return null;
    }
  }

  @Get('categories')
  categories() {
    return this.services.categories();
  }

  /** Chi phí thấp nhất từng hạng mục cho số khách (?guests=300): form thông tin đám cưới kiểm tra ngân sách tối thiểu */
  @Get('categories/min-costs')
  minCosts(@Query('guests') guests = '0') {
    const n = Math.min(Math.max(0, Math.floor(Number(guests) || 0)), 5000);
    return this.services.minCosts(n);
  }

  @Get('services/locations')
  locations() {
    return this.services.locations();
  }

  /** Khu vực lọc (phường/xã chính thức) lấy từ dữ liệu NCC đang hiển thị */
  @Get('services/areas')
  areas() {
    return this.services.areas();
  }

  @Get('services/styles')
  styles() {
    return this.services.styles();
  }

  /**
   * Tìm kiếm 2 tầng (chạy khi bấm Enter / nút Tìm kiếm). q tối đa QUERY_MAX_LENGTH ký tự.
   * ai=1 mới được gọi AI (tầng 2); không có thì trả mode NEEDS_AI để FE hiện "Đang hiểu yêu cầu của bạn…" rồi gọi lại.
   */
  @Get('services/search')
  async searchServices(@Query() q: Record<string, string>, @Req() req: Request) {
    if ((q.q ?? '').length > QUERY_MAX_LENGTH) {
      throw new HttpException({ code: 'VALIDATION_ERROR', message: `Từ khóa tối đa ${QUERY_MAX_LENGTH} ký tự.` }, 400);
    }
    return this.search.search(
      {
        q: q.q ?? '',
        category: q.category || undefined,
        area: q.area || undefined,
        priceMin: num(q.priceMin),
        priceMax: num(q.priceMax),
        page: num(q.page),
        pageSize: num(q.pageSize),
        allowAi: q.ai === '1',
      },
      { userId: this.viewer(req), ip: req.ip ?? 'unknown' },
    );
  }

  @Get('services')
  async list(@Query() q: Record<string, string>, @Req() req: Request) {
    const expected = await this.services.expectedFor(this.viewer(req));
    return this.services.list({
      q: q.q || undefined,
      category: q.category || undefined,
      location: q.location || undefined,
      area: q.area || undefined,
      styles: list(q.styles),
      priceMin: num(q.priceMin),
      priceMax: num(q.priceMax),
      page: num(q.page),
      pageSize: num(q.pageSize),
      expected: expected ?? undefined,
    });
  }

  @Get('services/:id')
  detail(@Param('id') id: string) {
    return this.services.detail(id);
  }
}
