import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WeddingAccess } from '../../common/guards/wedding-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { WeddingMembersService } from './wedding-members.service';

/** Người cùng lập kế hoạch của đám cưới đang dùng (docs/api/weddings.md mục Thành viên). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('weddings/me/members')
export class WeddingMembersController {
  constructor(private readonly members: WeddingMembersService) {}

  @Get()
  @WeddingAccess()
  list(@Req() req: any) {
    return this.members.list(req.wedding, req.user.sub);
  }

  @Patch(':userId')
  @WeddingAccess({ role: 'Owner' })
  update(@Req() req: any, @Param('userId') userId: string, @Body() body: { role?: unknown; tabs?: unknown }) {
    return this.members.update(req.wedding, req.user.sub, userId, body ?? {});
  }

  /** Owner xóa người khác hoặc thành viên tự rời: quyền kiểm tra trong service. */
  @Delete(':userId')
  @WeddingAccess()
  remove(@Req() req: any, @Param('userId') userId: string) {
    return this.members.remove(req.wedding, req.user.sub, userId);
  }
}
