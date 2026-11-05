import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BudgetService, MAX_EXTRA_COSTS } from './budget.service';
import {
  IMPORT_MAX_ROWS,
  canBeMonthFirst,
  normalizeExpenses,
  normalizeTasks,
  toCsv,
  type DateOrder,
  type RowResult,
} from './import-rows';
import { todayVNDate, toYmd } from './timeline-hooks';
import { TimelineService } from './timeline.service';
import { bumpVersion } from './wedding-version';
import { WeddingsService } from './weddings.service';
import { requireDbFeature } from '../../prisma/db-features';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

export interface ImportBody {
  /** Các dòng đã ghép cột ở frontend: khóa là tên trường (name, side, ...), giá trị là chữ trong ô */
  rows?: unknown;
  /** APPEND (mặc định) hoặc REPLACE (thay toàn bộ, chỉ chi phí khác) */
  mode?: unknown;
  /** true: chỉ kiểm tra, không ghi */
  dryRun?: unknown;
  /** Cách đọc ngày dạng a/b/yyyy của công việc: DMY (mặc định) hoặc MDY */
  dateOrder?: unknown;
}

const PLAN_STATUS_LABEL: Record<string, string> = { PLANNED: 'Dự kiến', DISCUSSING: 'Đang trao đổi', AWAITING_DEPOSIT: 'Chờ thanh toán cọc', CONFIRMED: 'Đã chốt' };

/** Tiêu đề cột của file mẫu và file tải về (frontend ghép cột tự động theo các tên này và từ đồng nghĩa). */
export const TASK_HEADER = ['Việc', 'Hạn', 'Ghi chú'];
export const EXPENSE_HEADER = ['Khoản chi', 'Số tiền'];

export interface ExtraCostImportBody extends ImportBody {
  /** Phiên bản đám cưới đã đọc; bắt buộc khi ghi (không dryRun) */
  version?: unknown;
}

/** Nhập và xuất Excel/CSV (P6). Frontend đọc file, backend kiểm tra lại từng dòng. */
@Injectable()
export class ImportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weddings: WeddingsService,
    private readonly timeline: TimelineService,
    private readonly budget: BudgetService,
  ) {}

  private parse(body: ImportBody, allowReplace: boolean) {
    const rows = body.rows;
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) return fail('VALIDATION_ERROR', 'Dữ liệu nhập không hợp lệ.', 400);
    if (!rows.length) return fail('IMPORT_EMPTY', 'File không có dòng dữ liệu nào.', 400);
    if (rows.length > IMPORT_MAX_ROWS) return fail('IMPORT_TOO_MANY_ROWS', `Tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần nhập.`, 400);
    const mode = body.mode === undefined || body.mode === 'APPEND' ? 'APPEND' : body.mode === 'REPLACE' && allowReplace ? 'REPLACE' : null;
    if (!mode) return fail('VALIDATION_ERROR', 'Cách nhập không hợp lệ.', 400);
    return { rows: rows as Record<string, unknown>[], mode, dryRun: body.dryRun === true };
  }

  private report<T>(results: RowResult<T>[], created: number) {
    const valid = results.filter((r) => r.value).length;
    return {
      total: results.length,
      valid,
      invalid: results.length - valid,
      created,
      // Chỉ trả các dòng có lỗi hoặc cảnh báo để payload nhỏ
      issues: results.filter((r) => r.errors.length || r.warnings.length).map(({ row, errors, warnings }) => ({ row, errors, warnings })),
    };
  }

  /** Công việc chỉ thêm vào (không thay toàn bộ, vì việc mẫu gắn với hạng mục và đơn). */
  async importTasks(userId: string, body: ImportBody) {
    requireDbFeature('timelineNotes');
    const w = await this.weddings.requireWedding(userId);
    const { rows, dryRun } = this.parse(body, false);
    const dateOrder: DateOrder = body.dateOrder === 'MDY' ? 'MDY' : 'DMY';
    if (dateOrder === 'MDY' && !canBeMonthFirst(rows.map((r) => r.dueDate))) {
      return fail('VALIDATION_ERROR', 'Cột hạn không thể đọc theo kiểu tháng/ngày/năm.', 400);
    }
    const results = normalizeTasks(rows, { dateOrder, today: toYmd(todayVNDate()), weddingDate: toYmd(w.wedding_date) });
    const values = results.flatMap((r) => (r.value ? [r.value] : []));
    if (dryRun || !values.length) return this.report(results, 0);
    await this.prisma.timeline_tasks.createMany({
      data: values.map((v) => ({
        wedding_id: w.id,
        title: v.title,
        scheduled_date: new Date(v.dueDate),
        status: 'Todo',
        task_type: 'Frame',
        display_order: 0,
        ...(v.note && { note: v.note }),
      })),
    });
    return this.report(results, values.length);
  }

  /** Chi phí khác ngoài Forever (bảng wedding_extra_costs). */
  async importExpenses(userId: string, body: ExtraCostImportBody) {
    requireDbFeature('budgetTiers');
    const w = await this.weddings.requireWedding(userId);
    const { rows, mode, dryRun } = this.parse(body, true);
    const results = normalizeExpenses(rows);
    const values = results.flatMap((r) => (r.value ? [r.value] : []));
    if (dryRun || !values.length) return this.report(results, 0);
    const current = mode === 'REPLACE' ? 0 : await this.prisma.wedding_extra_costs.count({ where: { wedding_id: w.id } });
    if (current + values.length > MAX_EXTRA_COSTS) return fail('EXTRA_COST_LIMIT', `Tối đa ${MAX_EXTRA_COSTS} khoản chi phí khác.`, 409);
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, body.version);
      if (mode === 'REPLACE') await tx.wedding_extra_costs.deleteMany({ where: { wedding_id: w.id } });
      await tx.wedding_extra_costs.createMany({ data: values.map((v) => ({ wedding_id: w.id, name: v.title, amount: v.amount })) });
    });
    return this.report(results, values.length);
  }

  // ---------- Xuất CSV ----------

  async tasksCsv(userId: string) {
    const { items } = await this.timeline.get(userId);
    return toCsv(
      [...TASK_HEADER, 'Hạng mục', 'Trạng thái'],
      items
        .filter((t) => t.kind !== 'LOCKED')
        .map((t) => [t.title, t.dueDate ?? '', t.note ?? '', t.category?.name ?? 'Việc ngoài dịch vụ', t.isDone ? 'Đã xong' : 'Chưa xong']),
    );
  }

  async budgetCsv(userId: string) {
    const s = await this.budget.summary(userId);
    const pkgLabel = { ORDER: 'theo đơn', SELECTED: 'đã chọn', PLANNED: 'dự kiến' } as const;
    const srcLabel = { PLANNED: 'Dự kiến', ORDER: 'Theo đơn', DEPOSITED: 'Đã cọc' } as const;
    return toCsv(
      ['Loại', 'Tên', 'Gợi ý ngân sách', 'Dịch vụ', 'Trạng thái', 'Gói', 'Chi phí', 'Nguồn chi phí'],
      [
        ...s.categories.flatMap((c) =>
          c.vendors.length
            ? c.vendors.map((v, i) => ['Hạng mục', c.name, i === 0 && c.limit !== null ? c.limit : '', v.name, v.status ? PLAN_STATUS_LABEL[v.status] : '', v.package.name ? `${v.package.name} (${pkgLabel[v.package.source]})` : '', v.cost, srcLabel[v.costSource]])
            : [['Hạng mục', c.name, c.limit ?? '', c.suggestion ? `Gợi ý: ${c.suggestion.vendorName}` : (c.message ?? ''), '', c.suggestion?.packageName ?? '', c.suggestion?.cost ?? '', c.suggestion ? 'Gợi ý' : '']],
        ),
        ...s.extraCosts.map((e) => ['Chi phí khác', e.name, '', '', '', '', e.amount, '']),
        ['Tổng', `Mức chia: ${s.presetLabel}`, '', '', '', '', s.totals.total - s.totals.remaining, 'Đã chọn'],
        ['Tổng', 'Tổng ngân sách', s.totals.total, '', '', '', '', ''],
        ['Tổng', s.totals.remaining < 0 ? 'Vượt ngân sách' : 'Còn lại', Math.abs(s.totals.remaining), '', '', '', '', ''],
      ],
    );
  }


  /** File mẫu để nhập (tiêu đề + 2 dòng ví dụ). */
  template(type: 'tasks' | 'expenses') {
    if (type === 'tasks') return toCsv(TASK_HEADER, [['Đặt thiệp cưới', '15/01/2027', 'Chọn mẫu thiệp màu kem'], ['Thuê xe hoa', '20/02/2027', '']]);
    return toCsv(EXPENSE_HEADER, [['Thiệp cưới', '3tr'], ['Xe đưa đón', '5.000.000']]);
  }
}
