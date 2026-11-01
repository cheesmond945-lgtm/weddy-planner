import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { WeddingAccess } from '../wedding-members/wedding-access';
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
 * Phần của tab mà người gọi không được xem thì trả null (không lộ số liệu).
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weddings: WeddingsService,
    private readonly timeline: TimelineService,
    private readonly budget: BudgetService,
  ) {}

  async get(userId: string, access: WeddingAccess) {
    const w = await this.weddings.requireWedding(userId);
    const can = (t: string) => access.tabs.includes(t as never);
    const [tasks, budget, guests] = await Promise.all([
      can('timeline') ? this.tasks(userId) : null,
      can('budget') ? this.budgetPart(w) : null,
      can('guests') && dbFeatures.guests ? this.guests(w.id, w.guest_count) : null,
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
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate!, daysLeft: daysBetween(today, t.dueDate!), category: t.category, assignee: t.assignee }));

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

    const people = new Map<string, { kind: string; userId: string | null; name: string | null; done: number; total: number }>();
    for (const t of open) {
      if (!t.assignee) continue;
      const key = t.assignee.userId ?? t.assignee.kind;
      const p = people.get(key) ?? { kind: t.assignee.kind, userId: t.assignee.userId, name: t.assignee.name, done: 0, total: 0 };
      p.total++;
      if (t.isDone) p.done++;
      people.set(key, p);
    }

    return {
      done: open.filter((t) => t.isDone).length,
      total: open.length,
      overdue: todo.filter((t) => t.dueDate! < today).length,
      upcoming,
      byCategory,
      assignees: [...people.values()],
    };
  }

  /** Thẻ ngân sách và biểu đồ chi phí: chi phí theo gói đã chọn + chi phí khác (budget-engine.ts mục 8). */
  private async budgetPart(w: Awaited<ReturnType<WeddingsService['requireWedding']>>) {
    const [s, deposits] = await Promise.all([
      this.budget.summaryOf(w),
      this.prisma.orders.aggregate({ where: { wedding_id: w.id, status: { in: ['Deposited', 'Completed'] } }, _sum: { deposit_amount: true } }),
    ]);
    const slices = s.categories.filter((c) => (c.cost ?? 0) > 0).map((c) => ({ slug: c.slug, name: c.name, amount: c.cost!, budget: c.budget, isOver: c.cost! > c.budget }));
    if (s.totals.extraCosts > 0) slices.push({ slug: 'other', name: 'Chi phí khác', amount: s.totals.extraCosts, budget: 0, isOver: false });
    const planned = s.totals.packagesCost + s.totals.extraCosts;
    return { total: s.totals.total, planned, deposited: Number(deposits._sum.deposit_amount ?? 0), remaining: s.totals.remaining, slices };
  }

  private async guests(weddingId: string, expected: number) {
    const rows = await this.prisma.wedding_guests.findMany({ where: { wedding_id: weddingId }, select: { side: true, party_size: true, is_invited: true, rsvp_status: true } });
    return guestStats(rows, expected);
  }
}
