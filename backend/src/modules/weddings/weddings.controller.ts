import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AiSuggestService } from './ai-suggest.service';
import { TimelineService } from './timeline.service';
import { WeddingInputBody, WeddingsService } from './weddings.service';

/** Thông tin đám cưới và kế hoạch của cặp đôi đang đăng nhập (docs/api/weddings.md). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('weddings/me')
export class WeddingsController {
  constructor(private readonly weddings: WeddingsService, private readonly timeline: TimelineService, private readonly ai: AiSuggestService) {}

  @Get()
  getMine(@Req() req: any) {
    return this.weddings.getMine(req.user.sub);
  }

  @Put()
  saveMine(@Req() req: any, @Body() body: WeddingInputBody) {
    return this.weddings.saveMine(req.user.sub, body ?? {});
  }

  @Get('timeline')
  getTimeline(@Req() req: any) {
    return this.timeline.get(req.user.sub);
  }

  @Post('timeline/tasks')
  addTask(@Req() req: any, @Body() body: { title?: string; dueDate?: string }) {
    return this.timeline.addTask(req.user.sub, body ?? {});
  }

  @Patch('timeline/items/:id')
  updateItem(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; dueDate?: string; isDone?: boolean }) {
    return this.timeline.update(req.user.sub, id, body ?? {});
  }

  @Delete('timeline/tasks/:id')
  deleteTask(@Req() req: any, @Param('id') id: string) {
    return this.timeline.remove(req.user.sub, id);
  }

  @Post('ai-suggestions')
  aiSuggest(@Req() req: any, @Body() body: { categorySlug?: string }) {
    return this.ai.suggest(req.user.sub, String(body?.categorySlug ?? ''));
  }

  @Get('plan-items')
  planItems(@Req() req: any) {
    return this.weddings.planItems(req.user.sub);
  }

  @Post('plan-items')
  addPlanItem(@Req() req: any, @Body() body: { serviceId?: string; replace?: boolean }) {
    return this.weddings.addPlanItem(req.user.sub, String(body?.serviceId ?? ''), !!body?.replace);
  }

  @Delete('plan-items/:id')
  removePlanItem(@Req() req: any, @Param('id') id: string) {
    return this.weddings.removePlanItem(req.user.sub, id);
  }
}
