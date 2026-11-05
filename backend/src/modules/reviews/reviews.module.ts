import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CoupleReviewsController, VendorOwnReviewsController, VendorReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({ imports: [CatalogModule], controllers: [VendorReviewsController, CoupleReviewsController, VendorOwnReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
