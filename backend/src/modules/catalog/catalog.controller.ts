import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

const num = (v?: string) => (v === undefined || v === '' ? undefined : Number(v));

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  // GET /api/catalog/categories
  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  // GET /api/catalog/packages?categoryId=&city=&q=&minPrice=&maxPrice=&page=1&pageSize=12
  @Get('packages')
  packages(@Query() q: Record<string, string>) {
    return this.catalog.listPackages({
      categoryId: q.categoryId || undefined,
      city: q.city || undefined,
      q: q.q || undefined,
      minPrice: num(q.minPrice),
      maxPrice: num(q.maxPrice),
      page: num(q.page),
      pageSize: num(q.pageSize),
    });
  }

  // GET /api/catalog/packages/:id
  @Get('packages/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.packageDetail(id);
  }
}
