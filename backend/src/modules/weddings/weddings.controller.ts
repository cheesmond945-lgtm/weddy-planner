import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AiSuggestService } from './ai-suggest.service';
import { TimelineService, type TimelineUpdateBody } from './timeline.service';
import { WeddingInputBody, WeddingPatchBody, WeddingsService } from './weddings.service';

/**
 * Thông tin đám cưới và kế hoạch của người gọi (docs/api/weddings.md). Mỗi tài khoản cặp đôi có một đám cưới (weddings.user_id).
 */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('weddings/me')
export class WeddingsController {
  constructor(
    private readonly weddings: WeddingsService,
    private readonly timeline: TimelineService,
    private readonly ai: AiSuggestService,
  ) {}

  @Get()
  async getMine(@Req() req: any) {
    return await this.weddings.getMine(req.user.sub);
  }

  /** Chưa có đám cưới thì tạo mới, có rồi thì cập nhật. */
  @Put()
  async saveMine(@Req() req: any, @Body() body: WeddingInputBody) {
    return await this.weddings.saveMine(req.user.sub, body ?? {});
  }

  /** Đổi nhanh tổng ngân sách, số khách, mức chi, số bàn (tab Ngân sách). Body kèm version. */
  @Patch()
  async patchMine(@Req() req: any, @Body() body: WeddingPatchBody) {
    return await this.weddings.patchMine(req.user.sub, body ?? {});
  }

  @Get('timeline')
  getTimeline(@Req() req: any) {
    return this.timeline.get(req.user.sub);
  }

  @Post('timeline/regenerate-preview')
  regeneratePreview(@Req() req: any, @Body() body: { weddingDate?: string }) {
    return this.timeline.regeneratePreview(req.user.sub, body?.weddingDate);
  }

  @Post('timeline/tasks')
  addTask(@Req() req: any, @Body() body: TimelineUpdateBody) {
    return this.timeline.addTask(req.user.sub, body ?? {});
  }

  @Patch('timeline/items/:id')
  updateItem(@Req() req: any, @Param('id') id: string, @Body() body: TimelineUpdateBody) {
    return this.timeline.update(req.user.sub, id, body ?? {});
  }

  @Delete('timeline/tasks/:id')
  deleteTask(@Req() req: any, @Param('id') id: string) {
    return this.timeline.remove(req.user.sub, id);
  }

  /** Chỉ đọc (không ghi gì), mở từ Timeline hoặc Dịch vụ nên cần một trong hai tab. */
  @Post('ai-suggestions')
  aiSuggest(@Req() req: any, @Body() body: { categorySlug?: string }) {
    return this.ai.suggest(req.user.sub, String(body?.categorySlug ?? ''));
  }

  @Get('plan-items')
  planItems(@Req() req: any) {
    return this.weddings.planItems(req.user.sub);
  }

  @Post('plan-items')
  addPlanItem(@Req() req: any, @Body() body: { serviceId?: string; replace?: boolean; packageId?: string | null }) {
    return this.weddings.addPlanItem(req.user.sub, String(body?.serviceId ?? ''), !!body?.replace, false, typeof body?.packageId === 'string' ? body.packageId : null);
  }

  /** Chọn gói cho nhà cung cấp trong kế hoạch. Body { packageId | null, version } */
  @Patch('plan-vendors/:vendorId')
  setPlanVendorPackage(@Req() req: any, @Param('vendorId') vendorId: string, @Body() body: { packageId?: unknown; version?: unknown }) {
    return this.weddings.setPlanVendorPackage(req.user.sub, vendorId, body ?? {});
  }

  @Delete('plan-items/:id')
  removePlanItem(@Req() req: any, @Param('id') id: string) {
    return this.weddings.removePlanItem(req.user.sub, id);
  }
}
