/*
 * Lịch trình ngày cưới: đọc CSDL rồi xếp lịch bằng wedding-day.ts (docs/LICH_TRINH_NGAY_CUOI.md). Dùng chung cho timeline của khách
 * (GET /weddings/me/day-schedule) và chi tiết đơn phía NCC (GET /vendors/me/orders/:id/day-slot).
 */
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { BUSY_ORDER_STATUSES } from '../halls/hall-busy';
import { findHallConflict } from '../halls/hall-store';
import { VENUE_SLUG, hm, localOf, minutesOfInstant, minutesOfTime, planDay, type DayOrderInput, type DayPlan, type DaySlot, type VenueInput } from './wedding-day';

type Db = PrismaService | Prisma.TransactionClient;

const ymdOf = (d: Date) => d.toISOString().slice(0, 10);
const prevDay = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

const dayOrderSelect = {
  id: true,
  order_code: true,
  package_id: true,
  dayof_start_at: true,
  dayof_end_at: true,
  dayof_confirmed_at: true,
  vendor_profiles: { select: { business_name: true, user_id: true, service_categories: { select: { name: true } } } },
  service_packages: { select: { name: true, dayof_lead_minutes: true, dayof_duration_minutes: true, setup_open_time: true } },
  order_items: { select: { service_packages: { select: { dayof_lead_minutes: true, dayof_duration_minutes: true } } } },
} as const;

export interface LoadedDay {
  weddingId: string;
  /** Ngày cưới "YYYY-MM-DD" */
  date: string;
  plan: DayPlan;
  /** Dữ liệu đầu vào từng đơn (tính khung dự kiến khi NCC chốt / bỏ chốt) */
  orders: DayOrderInput[];
  /** Users.Id của NCC từng đơn (gửi thông báo khi khách đổi giờ chính) */
  vendorUserOf: ReadonlyMap<string, string | null>;
}

/**
 * Lịch trình của một đám cưới: các đơn Đã cọc / Hoàn thành có ngày thực hiện ĐÚNG ngày cưới (đơn làm ngày khác, vd chụp ảnh trước, không vào lịch này).
 * Sảnh là đơn Nhà hàng / Trung tâm tổ chức sự kiện; biết sảnh nào (orders.package_id) thì xem hôm trước sảnh có bận không.
 * null khi đám cưới chưa có ngày.
 */
export async function loadWeddingDay(db: Db, weddingId: string): Promise<LoadedDay | null> {
  const w = await db.weddings.findUnique({ where: { id: weddingId }, select: { wedding_date: true, main_time: true } });
  if (!w?.wedding_date) return null;
  const date = ymdOf(w.wedding_date);
  const rows = await db.orders.findMany({
    where: { wedding_id: weddingId, status: { in: BUSY_ORDER_STATUSES }, event_date: w.wedding_date },
    select: dayOrderSelect,
    orderBy: { created_date: 'asc' },
  });

  const orders: DayOrderInput[] = rows.map((o) => {
    const catName = o.vendor_profiles?.service_categories?.name ?? '';
    const pkgs = [o.service_packages, ...o.order_items.map((i) => i.service_packages)].flatMap((p) => (p ? [{ lead: p.dayof_lead_minutes, duration: p.dayof_duration_minutes }] : []));
    const confirmed =
      o.dayof_confirmed_at && o.dayof_start_at && o.dayof_end_at
        ? { start: minutesOfInstant(date, o.dayof_start_at), end: minutesOfInstant(date, o.dayof_end_at), at: o.dayof_confirmed_at.toISOString() }
        : null;
    return { orderId: o.id, orderCode: o.order_code ?? '', vendorName: o.vendor_profiles?.business_name ?? 'Nhà cung cấp', categorySlug: categorySlug(catName), categoryName: catName, packages: pkgs, confirmed };
  });

  const v = rows.find((o) => categorySlug(o.vendor_profiles?.service_categories?.name ?? null) === VENUE_SLUG);
  const venue: VenueInput | null = v
    ? {
        orderId: v.id,
        name: v.vendor_profiles?.business_name ?? 'Sảnh',
        hallName: v.service_packages?.name ?? null,
        setupOpen: minutesOfTime(v.service_packages?.setup_open_time),
        prevDayBusy: v.package_id ? (await findHallConflict(db, v.package_id, prevDay(date))) !== null : null,
      }
    : null;

  return {
    weddingId,
    date,
    plan: planDay({ mainTime: minutesOfTime(w.main_time), venue, orders }),
    orders,
    vendorUserOf: new Map(rows.map((o) => [o.id, o.vendor_profiles?.user_id ?? null])),
  };
}

// ---------- Dạng trả cho FE (giờ VN dạng "YYYY-MM-DDTHH:mm", giờ trong ngày "HH:mm") ----------

export const slotDto = (date: string, s: DaySlot) => ({
  orderId: s.orderId,
  orderCode: s.orderCode,
  vendorName: s.vendorName,
  categorySlug: s.categorySlug,
  categoryName: s.categoryName,
  isVenue: s.isVenue,
  start: s.start === null ? null : localOf(date, s.start),
  end: s.end === null ? null : localOf(date, s.end),
  source: s.source,
  confirmedAt: s.confirmedAt,
  issues: s.issues,
});

export const venueDto = (plan: DayPlan) =>
  plan.venue
    ? { name: plan.venue.name, hallName: plan.venue.hallName, openAt: hm(plan.venue.openAt), openIsDefault: plan.venue.openIsDefault, prevDayBusy: plan.venue.prevDayBusy }
    : null;

/** Lịch trình cho khách: mọi NCC của ngày cưới. */
export const dayScheduleDto = (d: LoadedDay) => ({
  date: d.date,
  mainTime: d.plan.mainTime === null ? null : hm(d.plan.mainTime),
  venue: venueDto(d.plan),
  slots: d.plan.slots.map((s) => slotDto(d.date, s)),
});
