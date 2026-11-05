import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Paginated } from '../../common/utils/pagination';
import { ReviewBody, ReviewsService } from './reviews.service';

/** Đánh giá công khai của một nhà cung cấp (serviceId = vendor_profiles.id). */
@Controller('services/:serviceId/reviews')
export class VendorReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  async list(@Param('serviceId') serviceId: string, @Query() q: { page?: string; pageSize?: string }) {
    const r = await this.reviews.listForVendor(serviceId, q);
    return Paginated.of(r.items, r.total, r);
  }

  @Get('summary')
  summary(@Param('serviceId') serviceId: string) {
    return this.reviews.summary(serviceId);
  }
}

/** Đánh giá phía cặp đôi (docs/api/reviews.md). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller()
export class CoupleReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('orders/:orderId/reviews')
  itemsOfOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return this.reviews.itemsOfOrder(req.user.sub, orderId);
  }

  @Post('order-items/:itemId/review')
  create(@Req() req: any, @Param('itemId') itemId: string, @Body() body: ReviewBody) {
    return this.reviews.create(req.user.sub, itemId, body);
  }

  @Put('order-items/:itemId/review')
  update(@Req() req: any, @Param('itemId') itemId: string, @Body() body: ReviewBody) {
    return this.reviews.update(req.user.sub, itemId, body);
  }
}

/** Nhà cung cấp: đọc đánh giá của khách theo đơn và phản hồi một lần (docs/api/reviews.md). */
@UseGuards(JwtAuthGuard)
@Roles('Vendor')
@Controller('vendors/me')
export class VendorOwnReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('orders/:orderId/reviews')
  itemsOfOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return this.reviews.itemsOfVendorOrder(req.user.sub, orderId);
  }

  @Put('reviews/:reviewId/reply')
  reply(@Req() req: any, @Param('reviewId') reviewId: string, @Body() body: { content?: unknown }) {
    return this.reviews.reply(req.user.sub, reviewId, body ?? {});
  }
}
