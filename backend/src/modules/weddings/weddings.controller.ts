import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WeddingAccess } from '../../common/guards/wedding-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { accessDto } from '../wedding-members/wedding-access';
import { WeddingMembersService } from '../wedding-members/wedding-members.service';
import { AiSuggestService } from './ai-suggest.service';
import { TimelineService, type TimelineUpdateBody } from './timeline.service';
import { WeddingInputBody, WeddingPatchBody, WeddingsService } from './weddings.service';

/**
 * Thông tin đám cưới và kế hoạch của đám cưới người gọi đang tham gia (docs/api/weddings.md).
 * Quyền: viewer chỉ đọc; editor sửa; mỗi nhóm endpoint cần quyền xem subtab tương ứng.
 */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('weddings/me')
export class WeddingsController {
  constructor(
    private readonly weddings: WeddingsService,
    private readonly timeline: TimelineService,
    private readonly ai: AiSuggestService,
    private readonly members: WeddingMembersService,
  ) {}

  /** Wedding kèm quyền của người gọi (access), để FE ẩn tab và khóa nút. */
  private async withAccess(userId: string, wedding: Awaited<ReturnType<WeddingsService['getMine']>>) {
    if (!wedding) return null;
    const access = await this.members.resolve(userId);
    return { ...wedding, access: access ? accessDto(access) : null };
  }

  @Get()
  @WeddingAccess({ optional: true })
  async getMine(@Req() req: any) {
    return this.withAccess(req.user.sub, await this.weddings.getMine(req.user.sub));
  }

  /** Chưa có đám cưới: tạo mới, người gọi là owner. Đã có: viewer không sửa được. */
  @Put()
  @WeddingAccess({ role: 'Editor', optional: true })
  async saveMine(@Req() req: any, @Body() body: WeddingInputBody) {
    return this.withAccess(req.user.sub, await this.weddings.saveMine(req.user.sub, body ?? {}));
  }

  /** Đổi nhanh tổng ngân sách, số khách, mức chi, số bàn (tab Ngân sách). Body kèm version. */
  @Patch()
  @WeddingAccess({ role: 'Editor' })
  async patchMine(@Req() req: any, @Body() body: WeddingPatchBody) {
    return this.withAccess(req.user.sub, await this.weddings.patchMine(req.user.sub, body ?? {}));
  }

  @Get('timeline')
  @WeddingAccess({ tabs: ['timeline'] })
  getTimeline(@Req() req: any) {
    return this.timeline.get(req.user.sub);
  }

  @Post('timeline/tasks')
  @WeddingAccess({ role: 'Editor', tabs: ['timeline'] })
  addTask(@Req() req: any, @Body() body: TimelineUpdateBody) {
    return this.timeline.addTask(req.user.sub, body ?? {});
  }

  @Patch('timeline/items/:id')
  @WeddingAccess({ role: 'Editor', tabs: ['timeline'] })
  updateItem(@Req() req: any, @Param('id') id: string, @Body() body: TimelineUpdateBody) {
    return this.timeline.update(req.user.sub, id, body ?? {});
  }

  @Delete('timeline/tasks/:id')
  @WeddingAccess({ role: 'Editor', tabs: ['timeline'] })
  deleteTask(@Req() req: any, @Param('id') id: string) {
    return this.timeline.remove(req.user.sub, id);
  }

  /** Chỉ đọc (không ghi gì), mở từ Timeline hoặc Dịch vụ nên cần một trong hai tab. */
  @Post('ai-suggestions')
  @WeddingAccess({ tabs: ['timeline', 'services'] })
  aiSuggest(@Req() req: any, @Body() body: { categorySlug?: string }) {
    return this.ai.suggest(req.user.sub, String(body?.categorySlug ?? ''));
  }

  @Get('plan-items')
  @WeddingAccess({ tabs: ['services'] })
  planItems(@Req() req: any) {
    return this.weddings.planItems(req.user.sub);
  }

  @Post('plan-items')
  @WeddingAccess({ role: 'Editor', tabs: ['services'] })
  addPlanItem(@Req() req: any, @Body() body: { serviceId?: string; replace?: boolean; packageId?: string | null }) {
    return this.weddings.addPlanItem(req.user.sub, String(body?.serviceId ?? ''), !!body?.replace, false, typeof body?.packageId === 'string' ? body.packageId : null);
  }

  /** Chọn gói cho nhà cung cấp trong kế hoạch. Body { packageId | null, version } */
  @Patch('plan-vendors/:vendorId')
  @WeddingAccess({ role: 'Editor', tabs: ['services'] })
  setPlanVendorPackage(@Req() req: any, @Param('vendorId') vendorId: string, @Body() body: { packageId?: unknown; version?: unknown }) {
    return this.weddings.setPlanVendorPackage(req.user.sub, vendorId, body ?? {});
  }

  @Delete('plan-items/:id')
  @WeddingAccess({ role: 'Editor', tabs: ['services'] })
  removePlanItem(@Req() req: any, @Param('id') id: string) {
    return this.weddings.removePlanItem(req.user.sub, id);
  }
}
