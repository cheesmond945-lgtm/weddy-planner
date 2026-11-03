import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BudgetService } from './budget.service';
import { GuestsService, type GuestBody } from './guests.service';
import { ImportExportService, type ExtraCostImportBody, type ImportBody } from './import-export.service';
import { OverviewService } from './overview.service';

/** File CSV tải về (UTF-8 có BOM). */
function csv(res: Response, name: string, body: string) {
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' });
  return new StreamableFile(Buffer.from(body, 'utf8'));
}

/**
 * Các subtab Tổng quan, Ngân sách, Khách mời và phần nhập/xuất (docs/api/weddings.md mục 6-9), trên đám cưới của người gọi.
 */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('weddings/me')
export class PlanTabsController {
  constructor(
    private readonly overview: OverviewService,
    private readonly budget: BudgetService,
    private readonly guests: GuestsService,
    private readonly io: ImportExportService,
  ) {}

  // ---------- Tổng quan ----------

  @Get('overview')
  getOverview(@Req() req: any) {
    return this.overview.get(req.user.sub);
  }

  // ---------- Ngân sách ----------

  @Get('budget')
  getBudget(@Req() req: any) {
    return this.budget.summary(req.user.sub);
  }

  /**
   * Cài đặt phân bổ: mức chia, tiệc tự lo. Body { budgetPreset?, ownVenue?, ownVenueCost?, version }.
   * Chọn CUSTOM lần đầu thì khởi tạo cấu hình Tùy chỉnh từ phương án đang dùng.
   */
  @Patch('budget/settings')
  budgetSettings(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.budget.updateSettings(req.user.sub, body ?? {});
  }

  /**
   * Tự lưu cấu hình Tùy chỉnh (toàn bộ): Body { version (số nguyên của cấu hình), baseMode, excluded, capAmount, items: [{ categoryId, ratio, locked }] }.
   * 200 kèm ngân sách mới (version + 1); 422 khi không hợp lệ (giữ cấu hình cũ); 409 khi version lệch (details.budget là bản mới nhất).
   */
  @Put('budget/split')
  saveBudgetSplit(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.budget.saveSplit(req.user.sub, body ?? {});
  }

  // ---------- Chi phí khác ngoài Forever ----------

  @Post('extra-costs')
  addExtraCost(@Req() req: any, @Body() body: { name?: unknown; amount?: unknown; version?: unknown }) {
    return this.budget.addExtraCost(req.user.sub, body ?? {});
  }

  @Patch('extra-costs/:id')
  updateExtraCost(@Req() req: any, @Param('id') id: string, @Body() body: { name?: unknown; amount?: unknown; version?: unknown }) {
    return this.budget.updateExtraCost(req.user.sub, id, body ?? {});
  }

  /** ?version= */
  @Delete('extra-costs/:id')
  removeExtraCost(@Req() req: any, @Param('id') id: string, @Query('version') version?: string) {
    return this.budget.removeExtraCost(req.user.sub, id, version);
  }

  // ---------- Khách mời ----------

  @Get('guests')
  listGuests(@Req() req: any) {
    return this.guests.list(req.user.sub);
  }

  @Post('guests')
  addGuest(@Req() req: any, @Body() body: GuestBody) {
    return this.guests.create(req.user.sub, body ?? {});
  }

  @Post('guests/bulk')
  addGuests(@Req() req: any, @Body() body: { names?: unknown; side?: unknown; group?: unknown }) {
    return this.guests.bulk(req.user.sub, body ?? {});
  }

  @Patch('guests/:id')
  updateGuest(@Req() req: any, @Param('id') id: string, @Body() body: GuestBody) {
    return this.guests.update(req.user.sub, id, body ?? {});
  }

  @Delete('guests/:id')
  removeGuest(@Req() req: any, @Param('id') id: string) {
    return this.guests.remove(req.user.sub, id);
  }

  // ---------- Nhập (frontend gửi các dòng đã ghép cột) ----------

  @Post('import/guests')
  importGuests(@Req() req: any, @Body() body: ImportBody) {
    return this.io.importGuests(req.user.sub, body ?? {});
  }

  @Post('import/tasks')
  importTasks(@Req() req: any, @Body() body: ImportBody) {
    return this.io.importTasks(req.user.sub, body ?? {});
  }

  @Post('import/expenses')
  importExpenses(@Req() req: any, @Body() body: ExtraCostImportBody) {
    return this.io.importExpenses(req.user.sub, body ?? {});
  }

  // ---------- File mẫu và tải về ----------

  @Get('import/guests/template.csv')
  guestsTemplate(@Res({ passthrough: true }) res: Response) {
    return csv(res, 'mau-khach-moi.csv', this.io.template('guests'));
  }

  @Get('import/tasks/template.csv')
  tasksTemplate(@Res({ passthrough: true }) res: Response) {
    return csv(res, 'mau-cong-viec.csv', this.io.template('tasks'));
  }

  @Get('import/expenses/template.csv')
  expensesTemplate(@Res({ passthrough: true }) res: Response) {
    return csv(res, 'mau-chi-phi-khac.csv', this.io.template('expenses'));
  }

  @Get('export/guests.csv')
  async exportGuests(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    return csv(res, 'khach-moi.csv', await this.io.guestsCsv(req.user.sub));
  }

  @Get('export/tasks.csv')
  async exportTasks(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    return csv(res, 'cong-viec.csv', await this.io.tasksCsv(req.user.sub));
  }

  @Get('export/budget.csv')
  async exportBudget(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    return csv(res, 'ngan-sach.csv', await this.io.budgetCsv(req.user.sub));
  }
}
