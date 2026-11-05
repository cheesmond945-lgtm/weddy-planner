import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_TABS, type PlanTab } from '../wedding-sharing/plan-tabs';
import { BudgetService } from './budget.service';
import { todayVNDate, toYmd } from './timeline-hooks';
import { TimelineService } from './timeline.service';
import { WeddingsService } from './weddings.service';

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/**
 * Tab Tổng quan (P2): một endpoint gom số liệu của Timeline, Dịch vụ, Ngân sách.
 * Xem qua link công khai: phần của tab không được chia sẻ thì trả null (không lộ số liệu).
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weddings: WeddingsService,
    private readonly timeline: TimelineService,
    private readonly budget: BudgetService,
  ) {}

  async get(userId: string, tabs: readonly PlanTab[] = PLAN_TABS) {
    const w = await this.weddings.requireWedding(userId);
    const can = (t: PlanTab) => tabs.includes(t);
    // Thẻ Dịch vụ và Ngân sách cùng đọc bảng ngân sách (summaryOf): đọc một lần
    const summary = can('budget') || can('services') ? this.budget.summaryOf(w) : null;
    const [tasks, budget, services] = await Promise.all([
      can('timeline') ? this.tasks(userId) : null,
      can('budget') ? this.budgetPart(summary!) : null,
      can('services') ? summary!.then((s) => this.servicesPart(s)) : null,
    ]);
    return { tasks, services, budget };
  }

  private async tasks(userId: string) {
    const { items } = await this.timeline.get(userId);
    const today = toYmd(todayVNDate());
    // Việc chi tiết chưa mở (LOCKED) không tính vào tiến độ
    const open = items.filter((t) => t.kind !== 'LOCKED');
    const todo = open.filter((t) => !t.isDone && t.dueDate);
    // Việc sắp tới: chưa xong, hạn từ hôm nay trở đi (việc quá hạn chỉ đếm ở `overdue`), tối đa 3 việc hạn sớm nhất
    const upcoming = todo
      .filter((t) => t.dueDate! >= today)
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .slice(0, 3)
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate!, daysLeft: daysBetween(today, t.dueDate!), category: t.category }));

    // Tiến độ theo dịch vụ; việc không gắn dịch vụ (việc của hai bạn) chỉ tính vào tổng ở thẻ Công việc
    const groups = new Map<string, { slug: string; name: string; done: number; total: number }>();
    for (const t of open) {
      if (!t.category) continue;
      const g = groups.get(t.category.slug) ?? { slug: t.category.slug, name: t.category.name, done: 0, total: 0 };
      g.total++;
      if (t.isDone) g.done++;
      groups.set(t.category.slug, g);
    }
    const byCategory = [...groups.values()];

    return {
      done: open.filter((t) => t.isDone).length,
      total: open.length,
      // Cùng quy tắc với Timeline (timelineFilter.ts isOverdue): việc thanh toán đợt 2 không tính quá hạn
      overdue: todo.filter((t) => t.dueDate! < today && !t.isRestPayment).length,
      upcoming,
      byCategory,
    };
  }

  /** Thẻ ngân sách và biểu đồ chi phí: chi phí theo gói đã chọn + chi phí khác (budget-engine.ts mục 8). */
  private async budgetPart(summary: Promise<Summary>) {
    const s = await summary;
    // Chỉ hạng mục đã chọn (chi phí thật / dự kiến của gói đang chọn); hạng mục chưa chọn chỉ có gợi ý nên không vào biểu đồ
    const slices = s.categories.filter((c) => c.status === 'CHOSEN' && c.cost > 0).map((c) => ({ slug: c.slug, name: c.name, amount: c.cost, budget: c.cost, isOver: false }));
    // Tiệc tự lo và tiền cọc mất (đơn đã hủy) cũng nằm trong chi phí dự kiến: thêm lát riêng để tâm biểu đồ khớp với thẻ Ngân sách
    if (s.totals.ownVenueCost > 0) slices.push({ slug: 'own-venue', name: 'Tiệc tự lo', amount: s.totals.ownVenueCost, budget: 0, isOver: false });
    if (s.totals.lostDeposits > 0) slices.push({ slug: 'lost', name: 'Cọc mất (đơn đã hủy)', amount: s.totals.lostDeposits, budget: 0, isOver: true });
    if (s.totals.extraCosts > 0) slices.push({ slug: 'other', name: 'Chi phí khác', amount: s.totals.extraCosts, budget: 0, isOver: false });
    const planned = s.totals.total - s.totals.remaining;
    return { total: s.totals.total, planned, deposited: s.totals.deposited, lostDeposits: s.totals.lostDeposits, remaining: s.totals.remaining, slices };
  }

  /**
   * Thẻ Dịch vụ: mỗi hạng mục của kế hoạch ở đúng một trạng thái, theo thứ tự ưu tiên: tự lo, đã cọc, có đơn chờ cọc,
   * đã chọn gói dự kiến, chưa chọn. `total` không gồm hạng mục tự lo (không cần đặt NCC).
   */
  private servicesPart(s: Summary) {
    const out = { total: 0, deposited: 0, ordered: 0, planned: 0, open: 0, own: 0 };
    for (const c of s.categories) {
      if (c.status === 'OWN_VENUE' || c.status === 'EXCLUDED') out.own++;
      else if (c.vendors.some((v) => v.costSource === 'DEPOSITED')) out.deposited++;
      // Chờ cọc theo đúng nhãn trạng thái ở tab Dịch vụ / Ngân sách: đơn đang cần sửa vẫn là "Đang trao đổi" nên tính vào dự kiến
      else if (c.vendors.some((v) => v.status === 'AWAITING_DEPOSIT')) out.ordered++;
      else if (c.status === 'CHOSEN') out.planned++;
      else out.open++;
    }
    out.total = out.deposited + out.ordered + out.planned + out.open;
    return out;
  }
}

type Summary = Awaited<ReturnType<BudgetService['summaryOf']>>;
