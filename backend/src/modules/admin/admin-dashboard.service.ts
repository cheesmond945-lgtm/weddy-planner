import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { ymd } from '../orders/order-mapping';
import { monthStartVN, pct, periodBack } from './admin-common';

const catRef = (c: { id: string; name: string }) => ({ id: c.id, slug: categorySlug(c.name), name: c.name });

/** Tổng quan quản trị (docs/api/admin.md): số liệu tháng, việc cần xử lý, danh sách chờ duyệt, biểu đồ. */
/** Hồ sơ chờ duyệt lần đầu, hoặc đã duyệt có lần gửi cập nhật chưa kiểm (hậu kiểm). */
const PENDING_VENDOR = { OR: [{ status: 'Pending' }, { status: 'Approved', vendor_verifications: { some: { status: 'Pending' } } }] };

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async counts() {
    const [consultations, vendors, packages] = await Promise.all([
      this.prisma.consultation_requests.count({ where: { is_contacted: false } }),
      this.prisma.vendor_profiles.count({ where: PENDING_VENDOR }),
      this.prisma.service_packages.count({ where: { status: 'Pending' } }),
    ]);
    return { consultations, vendors, packages };
  }

  async dashboard() {
    const cur = periodBack(0);
    const prev = periodBack(1);
    const start0 = monthStartVN(0);
    const start1 = monthStartVN(1);
    const start5 = monthStartVN(5);

    const [statements, completed, usersCur, usersPrev, activeVendors, counts, pendingVendors, pendingPackages] = await Promise.all([
      this.prisma.commission_statements.findMany({ select: { period_month: true, total_amount: true } }),
      this.prisma.orders.findMany({
        where: { status: 'Completed', completed_date: { gte: start5 } },
        select: { total_amount: true, completed_date: true, vendor_profiles: { select: { service_categories: { select: { id: true, name: true } } } } },
      }),
      this.prisma.users.count({ where: { created_date: { gte: start0 } } }),
      this.prisma.users.count({ where: { created_date: { gte: start1, lt: start0 } } }),
      this.prisma.vendor_profiles.count({ where: { status: 'Approved', users: { status: 'Active' } } }),
      this.counts(),
      this.prisma.vendor_profiles.findMany({
        where: PENDING_VENDOR,
        include: { service_categories: true, vendor_verifications: { orderBy: { submitted_date: 'desc' }, take: 1 } },
      }),
      this.prisma.service_packages.findMany({
        where: { status: 'Pending' },
        include: { vendor_profiles: { include: { service_categories: true } }, package_verifications: { orderBy: { created_date: 'desc' }, take: 1 } },
      }),
    ]);

    const commissionOf = (period: string) => statements.filter((s) => ymd(s.period_month).slice(0, 7) === period).reduce((a, s) => a + Number(s.total_amount), 0);
    const gmvIn = (from: Date, to?: Date) => completed.filter((o) => o.completed_date! >= from && (!to || o.completed_date! < to)).reduce((a, o) => a + Number(o.total_amount), 0);
    const comNow = commissionOf(cur);
    const gmvNow = gmvIn(start0);

    const mix = new Map<string, { category: ReturnType<typeof catRef>; count: number }>();
    for (const o of completed) {
      const c = catRef(o.vendor_profiles.service_categories);
      const e = mix.get(c.slug) ?? { category: c, count: 0 };
      e.count++;
      mix.set(c.slug, e);
    }
    const totalOrders = [...mix.values()].reduce((a, e) => a + e.count, 0) || 1;

    const waiting = <T extends { id: string }>(rows: T[], f: (r: T) => { name: string; subtitle: string; category: { id: string; name: string }; city: string; submittedAt: Date }) =>
      rows
        .map((r) => ({ id: r.id, ...f(r) }))
        .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
        .slice(0, 5)
        .map(({ category, submittedAt, ...rest }) => ({ ...rest, category: catRef(category), submittedAt: submittedAt.toISOString() }));

    return {
      commissionThisMonth: { value: comNow, changePct: pct(comNow, commissionOf(prev)) },
      gmv: { value: gmvNow, changePct: pct(gmvNow, gmvIn(start1, start0)) },
      newUsers: { value: usersCur, changePct: pct(usersCur, usersPrev) },
      activeVendors: { value: activeVendors, changePct: 0 },
      pendingVendors: counts.vendors,
      pendingPackages: counts.packages,
      pendingConsultations: counts.consultations,
      waitingVendors: waiting(pendingVendors, (v) => ({
        name: v.business_name,
        subtitle: v.service_categories.name,
        category: v.service_categories,
        city: v.city,
        submittedAt: v.vendor_verifications[0]?.submitted_date ?? v.updated_date,
      })),
      waitingPackages: waiting(pendingPackages, (p) => ({
        name: p.name,
        subtitle: p.vendor_profiles.business_name,
        category: p.vendor_profiles.service_categories,
        city: p.vendor_profiles.city,
        submittedAt: p.package_verifications[0]?.created_date ?? p.updated_date,
      })),
      commissionByMonth: [5, 4, 3, 2, 1, 0].map((b) => ({ period: periodBack(b), amount: commissionOf(periodBack(b)) })),
      ordersByCategory: [...mix.values()].sort((a, b) => b.count - a.count).map((e) => ({ category: e.category, count: e.count, percent: Math.round((e.count / totalOrders) * 100) })),
    };
  }
}
