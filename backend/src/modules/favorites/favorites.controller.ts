import { Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FavoritesService } from './favorites.service';

/** Dịch vụ yêu thích của cặp đôi (docs/api/favorites.md). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@Req() req: any) {
    return this.favorites.list(req.user.sub);
  }

  @Put(':serviceId')
  add(@Req() req: any, @Param('serviceId') serviceId: string) {
    return this.favorites.add(req.user.sub, serviceId);
  }

  @Delete(':serviceId')
  remove(@Req() req: any, @Param('serviceId') serviceId: string) {
    return this.favorites.remove(req.user.sub, serviceId);
  }
}
