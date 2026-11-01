import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WeddingAccess } from '../../common/guards/wedding-access.guard';
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
 * Các subtab Tổng quan, Ngân sách, Khách mời và phần nhập/xuất (docs/api/weddings.md mục 6-9).
 * Mỗi endpoint cần quyền xem tab tương ứng; ghi cần quyền Editor.
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
  @WeddingAccess({ tabs: ['overview'] })
  getOverview(@Req() req: any) {
    return this.overview.get(req.user.sub, req.wedding);
  }

  // ---------- Ngân sách ----------

  @Get('budget')
  @WeddingAccess({ tabs: ['budget'] })
  getBudget(@Req() req: any) {
    return this.budget.summary(req.user.sub);
  }

  /** Đặt ngân sách sửa tay của hạng mục. Body { amount, version } */
  @Put('budget/categories/:categoryId')
  @WeddingAccess({ role: 'Editor', tabs: ['budget'] })
  setManualBudget(@Req() req: any, @Param('categoryId') categoryId: string, @Body() body: { amount?: unknown; version?: unknown }) {
    return this.budget.setManual(req.user.sub, categoryId, body ?? {});
  }

  /** Bỏ số sửa tay, quay về số gợi ý. ?version= */
  @Delete('budget/categories/:categoryId')
  @WeddingAccess({ role: 'Editor', tabs: ['budget'] })
  clearManualBudget(@Req() req: any, @Param('categoryId') categoryId: string, @Query('version') version?: string) {
    return this.budget.clearManual(req.user.sub, categoryId, version);
  }

  @Post('budget/reset')
  @WeddingAccess({ role: 'Editor', tabs: ['budget'] })
  resetBudget(@Req() req: any, @Body() body: { version?: unknown }) {
    return this.budget.reset(req.user.sub, body?.version);
  }

  @Post('budget/rebalance')
  @WeddingAccess({ role: 'Editor', tabs: ['budget'] })
  rebalanceBudget(@Req() req: any, @Body() body: { version?: unknown }) {
    return this.budget.rebalance(req.user.sub, body?.version);
  }

  // ---------- Chi phí khác ngoài WebPlan ----------

  @Post('extra-costs')
  @WeddingAccess({ role: 'Editor', tabs: ['budget'] })
  addExtraCost(@Req() req: any, @Body() body: { name?: unknown; amount?: unknown; version?: unknown }) {
    return this.budget.addExtraCost(req.user.sub, body ?? {});
  }

  @Patch('extra-costs/:id')
  @WeddingAccess({ role: 'Editor', tabs: ['budget'] })
  updateExtraCost(@Req() req: any, @Param('id') id: string, @Body() body: { name?: unknown; amount?: unknown; version?: unknown }) {
    return this.budget.updateExtraCost(req.user.sub, id, body ?? {});
  }

  /** ?version= */
  @Delete('extra-costs/:id')
  @WeddingAccess({ role: 'Editor', tabs: ['budget'] })
  removeExtraCost(@Req() req: any, @Param('id') id: string, @Query('version') version?: string) {
    return this.budget.removeExtraCost(req.user.sub, id, version);
  }

  // ---------- Khách mời ----------

  @Get('guests')
  @WeddingAccess({ tabs: ['guests'] })
  listGuests(@Req() req: any) {
    return this.guests.list(req.user.sub);
  }

  @Post('guests')
  @WeddingAccess({ role: 'Editor', tabs: ['guests'] })
  addGuest(@Req() req: any, @Body() body: GuestBody) {
    return this.guests.create(req.user.sub, body ?? {});
  }

  @Post('guests/bulk')
  @WeddingAccess({ role: 'Editor', tabs: ['guests'] })
  addGuests(@Req() req: any, @Body() body: { names?: unknown; side?: unknown; group?: unknown }) {
    return this.guests.bulk(req.user.sub, body ?? {});
  }

  @Patch('guests/:id')
  @WeddingAccess({ role: 'Editor', tabs: ['guests'] })
  updateGuest(@Req() req: any, @Param('id') id: string, @Body() body: GuestBody) {
    return this.guests.update(req.user.sub, id, body ?? {});
  }

  @Delete('guests/:id')
  @WeddingAccess({ role: 'Editor', tabs: ['guests'] })
  removeGuest(@Req() req: any, @Param('id') id: string) {
    return this.guests.remove(req.user.sub, id);
  }

  // ---------- Nhập (frontend gửi các dòng đã ghép cột) ----------

  @Post('import/guests')
  @WeddingAccess({ role: 'Editor', tabs: ['guests'] })
  importGuests(@Req() req: any, @Body() body: ImportBody) {
    return this.io.importGuests(req.user.sub, body ?? {});
  }

  @Post('import/tasks')
  @WeddingAccess({ role: 'Editor', tabs: ['timeline'] })
  importTasks(@Req() req: any, @Body() body: ImportBody) {
    return this.io.importTasks(req.user.sub, body ?? {});
  }

  @Post('import/expenses')
  @WeddingAccess({ role: 'Editor', tabs: ['budget'] })
  importExpenses(@Req() req: any, @Body() body: ExtraCostImportBody) {
    return this.io.importExpenses(req.user.sub, body ?? {});
  }

  // ---------- File mẫu và tải về ----------

  @Get('import/guests/template.csv')
  @WeddingAccess({ tabs: ['guests'] })
  guestsTemplate(@Res({ passthrough: true }) res: Response) {
    return csv(res, 'mau-khach-moi.csv', this.io.template('guests'));
  }

  @Get('import/tasks/template.csv')
  @WeddingAccess({ tabs: ['timeline'] })
  tasksTemplate(@Res({ passthrough: true }) res: Response) {
    return csv(res, 'mau-cong-viec.csv', this.io.template('tasks'));
  }

  @Get('import/expenses/template.csv')
  @WeddingAccess({ tabs: ['budget'] })
  expensesTemplate(@Res({ passthrough: true }) res: Response) {
    return csv(res, 'mau-chi-phi-khac.csv', this.io.template('expenses'));
  }

  @Get('export/guests.csv')
  @WeddingAccess({ tabs: ['guests'] })
  async exportGuests(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    return csv(res, 'khach-moi.csv', await this.io.guestsCsv(req.user.sub));
  }

  @Get('export/tasks.csv')
  @WeddingAccess({ tabs: ['timeline'] })
  async exportTasks(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    return csv(res, 'cong-viec.csv', await this.io.tasksCsv(req.user.sub));
  }

  @Get('export/budget.csv')
  @WeddingAccess({ tabs: ['budget'] })
  async exportBudget(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    return csv(res, 'ngan-sach.csv', await this.io.budgetCsv(req.user.sub));
  }
}
