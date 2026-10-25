import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { ymd, ymdVN } from '../orders/order-mapping';
import { fail, matches, UUID } from './admin-common';

export interface StatementQueryDto {
  q?: string;
  status?: string;
  /** Năm (YYYY) và tháng (1-12) của kỳ; dùng riêng từng cái hoặc cùng nhau */
  year?: string | number;
  month?: string | number;
  period?: string;
  page?: string | number;
  pageSize?: string | number;
}

/** Bảng kê hoa hồng của mọi nhà cung cấp (commission_statements + commissions), Admin ghi nhận đã thanh toán. */
@Injectable()
export class AdminPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private load(where: object = {}) {
    return this.prisma.commission_statements.findMany({
      where,
      include: { commissions: { select: { order_amount: true } }, vendor_profiles: { select: { id: true, user_id: true, business_name: true, service_categories: true } } },
    });
  }

  /** Mã bảng kê DS<MM><YYYY>-<số thứ tự trong kỳ>, số thứ tự theo ngày tạo (ổn định). */
  private dtos(rows: Awaited<ReturnType<AdminPaymentsService['load']>>) {
    const today = ymdVN(new Date());
    const seq = new Map<string, number>();
    const byPeriod = new Map<string, typeof rows>();
    for (const r of rows) {
      const p = ymd(r.period_month).slice(0, 7);
      byPeriod.set(p, [...(byPeriod.get(p) ?? []), r]);
    }
    for (const list of byPeriod.values()) {
      [...list].sort((a, b) => a.created_date.getTime() - b.created_date.getTime() || a.id.localeCompare(b.id)).forEach((r, i) => seq.set(r.id, i + 1));
    }
    return rows.map((r) => {
      const period = ymd(r.period_month).slice(0, 7);
      const due = ymd(r.due_date);
      const paid = r.status === 'Paid';
      const cat = r.vendor_profiles.service_categories;
      return {
        id: r.id,
        code: `DS${period.slice(5)}${period.slice(0, 4)}-${String(seq.get(r.id)).padStart(3, '0')}`,
        vendor: { id: r.vendor_profiles.id, name: r.vendor_profiles.business_name },
        category: { id: cat.id, slug: categorySlug(cat.name), name: cat.name },
        period,
        orderCount: r.total_orders,
        revenue: r.commissions.reduce((s, c) => s + Number(c.order_amount), 0),
        commissionAmount: Number(r.total_amount),
        dueDate: due,
        status: paid ? 'PAID' : 'UNPAID',
        isOverdue: !paid && due < today,
        paidAt: r.paid_date?.toISOString() ?? null,
        transactionCode: r.transaction_code,
      };
    });
  }

  async list(q: StatementQueryDto) {
    const all = this.dtos(await this.load());
    const year = Math.trunc(Number(q.year)) || 0;
    const month = Math.trunc(Number(q.month)) || 0;
    const filtered = all
      .filter(
        (s) =>
          matches(q.q, s.code, s.vendor.name) &&
          (!q.status || s.status === q.status) &&
          (!q.period || s.period === q.period) &&
          (!year || s.period.startsWith(`${year}-`)) &&
          (!month || s.period.slice(5) === String(month).padStart(2, '0')),
      )
      .sort((a, b) => b.period.localeCompare(a.period) || a.vendor.name.localeCompare(b.vendor.name, 'vi'));
    const page = Math.max(1, Math.trunc(Number(q.page)) || 1);
    const size = Math.min(5000, Math.max(1, Math.trunc(Number(q.pageSize)) || 10));
    const sum = (f: (s: (typeof all)[number]) => boolean) => filtered.filter(f).reduce((a, s) => a + s.commissionAmount, 0);
    return {
      stats: { total: sum(() => true), paid: sum((s) => s.status === 'PAID'), unpaid: sum((s) => s.status === 'UNPAID') },
      items: filtered.slice((page - 1) * size, page * size),
      total: filtered.length,
      periods: [...new Set(all.map((s) => s.period))].sort().reverse(),
      /** Các năm có bảng kê (cho ô chọn năm), mới nhất trước */
      years: [...new Set(all.map((s) => Number(s.period.slice(0, 4))))].sort((a, b) => b - a),
    };
  }

  /**
   * Chi tiết một bảng kê: nhà cung cấp, thông tin kỳ, thanh toán và từng đơn được tính hoa hồng.
   * Đơn hoàn thành ở tháng khác với kỳ của bảng kê là đơn được tính dồn (originPeriod = tháng hoàn thành thực tế).
   */
  async detail(id: string) {
    const row = UUID.test(id)
      ? await this.prisma.commission_statements.findUnique({
          where: { id },
          include: {
            commissions: { include: { orders: { select: { id: true, order_code: true, customer_name: true, event_date: true, completed_date: true, total_amount: true } } }, orderBy: { created_date: 'asc' } },
            vendor_profiles: { include: { service_categories: true, users: { select: { full_name: true, email: true, phone_number: true } } } },
          },
        })
      : null;
    if (!row) return fail('COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.', 404);
    const base = (await this.dtos(await this.load())).find((s) => s.id === id)!;
    const v = row.vendor_profiles;
    const period = base.period;
    const [y, m] = period.split('-').map(Number);
    const lines = row.commissions.map((c) => {
      const done = c.orders.completed_date;
      const completedMonth = done ? ymdVN(done).slice(0, 7) : null;
      return {
        id: c.id,
        orderId: c.orders.id,
        orderCode: c.orders.order_code,
        customerName: c.orders.customer_name,
        eventDate: ymd(c.orders.event_date),
        completedAt: done?.toISOString() ?? null,
        orderAmount: Number(c.order_amount),
        rate: Number(c.rate),
        commissionAmount: Number(c.amount),
        originPeriod: completedMonth && completedMonth !== period ? completedMonth : null,
      };
    });
    const revenue = lines.reduce((s, l) => s + l.orderAmount, 0);
    return {
      ...base,
      closingDate: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
      createdAt: row.created_date.toISOString(),
      /** Tỷ lệ hoa hồng bình quân theo doanh thu (các dòng có thể khác tỷ lệ nếu lĩnh vực đổi tỷ lệ giữa chừng) */
      averageRate: revenue ? Math.round((base.commissionAmount / revenue) * 10000) / 100 : 0,
      vendorInfo: {
        id: v.id,
        businessName: v.business_name,
        representativeName: v.representative_name || null,
        taxCode: v.tax_code,
        address: [v.address, v.ward, v.city].filter(Boolean).join(', ') || null,
        ownerName: v.users.full_name,
        email: v.users.email,
        phone: v.users.phone_number,
      },
      lines,
    };
  }
}
