import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PLAN_TABS, type PlanTab } from '../wedding-sharing/plan-tabs';
import { BudgetService } from './budget.service';
import { guestStats } from './guests.service';
import { todayVNDate, toYmd } from './timeline-hooks';
import { TimelineService } from './timeline.service';
import { WeddingsService } from './weddings.service';
import { dbFeatures } from '../../prisma/db-features';

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/**
 * Tab Tổng quan (P2): một endpoint gom số liệu của Timeline, Ngân sách, Khách mời.
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
    const [tasks, budget, guests] = await Promise.all([
      can('timeline') ? this.tasks(userId) : null,
      can('budget') ? this.budgetPart(w) : null,
      can('guests') && dbFeatures.guests ? this.guests(w.id, w.guest_count ?? 0) : null,
    ]);
    return { tasks, budget, guests };
  }

  private async tasks(userId: string) {
    const { items } = await this.timeline.get(userId);
    const today = toYmd(todayVNDate());
    // Việc chi tiết chưa mở (LOCKED) không tính vào tiến độ
    const open = items.filter((t) => t.kind !== 'LOCKED');
    const todo = open.filter((t) => !t.isDone && t.dueDate);
    const upcoming = [...todo]
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .slice(0, 5)
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate!, daysLeft: daysBetween(today, t.dueDate!), category: t.category }));

    const groups = new Map<string, { slug: string | null; name: string; done: number; total: number }>();
    for (const t of open) {
      const key = t.category?.slug ?? '';
      const g = groups.get(key) ?? { slug: t.category?.slug ?? null, name: t.category?.name ?? 'Việc chung', done: 0, total: 0 };
      g.total++;
      if (t.isDone) g.done++;
      groups.set(key, g);
    }
    // "Việc chung" xếp cuối
    const byCategory = [...groups.values()].sort((a, b) => Number(a.slug === null) - Number(b.slug === null));

    return {
      done: open.filter((t) => t.isDone).length,
      total: open.length,
      overdue: todo.filter((t) => t.dueDate! < today).length,
      upcoming,
      byCategory,
    };
  }

  /** Thẻ ngân sách và biểu đồ chi phí: chi phí theo gói đã chọn + chi phí khác (budget-engine.ts mục 8). */
  private async budgetPart(w: Awaited<ReturnType<WeddingsService['requireWedding']>>) {
    const [s, deposits] = await Promise.all([
      this.budget.summaryOf(w),
      this.prisma.orders.aggregate({ where: { wedding_id: w.id, status: { in: ['Deposited', 'Completed'] } }, _sum: { deposit_amount: true } }),
    ]);
    // Chỉ hạng mục đã chọn (chi phí thật / dự kiến của gói đang chọn); hạng mục chưa chọn chỉ có gợi ý nên không vào biểu đồ
    const slices = s.categories.filter((c) => c.status === 'CHOSEN' && c.cost > 0).map((c) => ({ slug: c.slug, name: c.name, amount: c.cost, budget: c.cost, isOver: false }));
    if (s.totals.extraCosts > 0) slices.push({ slug: 'other', name: 'Chi phí khác', amount: s.totals.extraCosts, budget: 0, isOver: false });
    const planned = s.totals.total - s.totals.remaining;
    return { total: s.totals.total, planned, deposited: Number(deposits._sum.deposit_amount ?? 0), remaining: s.totals.remaining, slices };
  }

  private async guests(weddingId: string, expected: number) {
    const rows = await this.prisma.wedding_guests.findMany({ where: { wedding_id: weddingId }, select: { side: true, party_size: true, is_invited: true, rsvp_status: true } });
    return guestStats(rows, expected);
  }
}
