import { Controller, Get, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';

const num = (v?: string) => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Các đường dẫn frontend gọi (docs/api/catalog.md), tách riêng khỏi /catalog/* cũ. */
@Controller()
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get('categories')
  categories() {
    return this.services.categories();
  }

  @Get('services/locations')
  locations() {
    return this.services.locations();
  }

  @Get('services/styles')
  styles() {
    return this.services.styles();
  }

  @Get('services')
  list(@Query() q: Record<string, string>) {
    return this.services.list({
      q: q.q || undefined,
      category: q.category || undefined,
      location: q.location || undefined,
      priceMin: num(q.priceMin),
      priceMax: num(q.priceMax),
      page: num(q.page),
      pageSize: num(q.pageSize),
    });
  }

  @Get('services/:id')
  detail(@Param('id') id: string) {
    return this.services.detail(id);
  }
}
