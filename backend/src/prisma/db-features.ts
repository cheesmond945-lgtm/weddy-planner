import { HttpException } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Các file SQL thủ công đã chạy lên DB hay chưa (DB Supabase dùng chung, SQL do người chạy tay).
 * main.ts kiểm tra một lần lúc khởi động. Chưa chạy thì PrismaService bỏ các cột mới khỏi câu truy vấn (global omit)
 * để các trang cũ vẫn chạy, còn tính năng cần cột/bảng mới trả 503 DB_MIGRATION_PENDING.
 * Mặc định là "đã chạy" (test và môi trường đã chạy đủ SQL không cần kiểm tra).
 */
export const dbFeatures = {
  /** backend/prisma/sql/2026-10-29-02-timeline-notes.sql */
  timelineNotes: true,
  /** backend/prisma/sql/2026-10-29-04-guests.sql */
  guests: true,
  /** backend/prisma/manual/2026-10-30-01-budget-tiers.sql */
  budgetTiers: true,
  /** backend/prisma/manual/2026-10-30-02-share-links.sql */
  sharing: true,
  /** backend/prisma/manual/2026-10-30-03-package-availability.sql */
  availability: true,
  /** backend/prisma/manual/2026-11-01-01-wedding-ward.sql */
  weddingWard: true,
};

const SQL_FILE: Record<keyof typeof dbFeatures, string> = {
  timelineNotes: 'backend/prisma/sql/2026-10-29-02-timeline-notes.sql',
  guests: 'backend/prisma/sql/2026-10-29-04-guests.sql',
  budgetTiers: 'backend/prisma/manual/2026-10-30-01-budget-tiers.sql',
  sharing: 'backend/prisma/manual/2026-10-30-02-share-links.sql',
  availability: 'backend/prisma/manual/2026-10-30-03-package-availability.sql',
  weddingWard: 'backend/prisma/manual/2026-11-01-01-wedding-ward.sql',
};

/** Kiểm tra cột và bảng của từng file SQL. Lỗi kết nối thì giữ mặc định (để lỗi thật hiện ra như trước). */
export async function detectDbFeatures(connectionString: string | undefined) {
  if (!connectionString) return dbFeatures;
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const { rows } = await pool.query<{ t: string; c: string | null }>(
      `SELECT table_name AS t, column_name AS c FROM information_schema.columns
       WHERE table_schema = 'public' AND (
         (table_name = 'timeline_tasks' AND column_name = 'note')
         OR table_name IN ('wedding_guests', 'wedding_category_budgets', 'wedding_extra_costs', 'wedding_share_links', 'package_availability', 'package_resources')
         OR (table_name = 'weddings' AND column_name IN ('spending_tier', 'table_count_override', 'ward'))
         OR (table_name = 'service_packages' AND column_name = 'unit')
         OR (table_name = 'plan_vendors' AND column_name = 'package_id'))`,
    );
    const has = (t: string, c?: string) => rows.some((r) => r.t === t && (!c || r.c === c));
    dbFeatures.timelineNotes = has('timeline_tasks', 'note');
    dbFeatures.guests = has('wedding_guests');
    dbFeatures.budgetTiers =
      has('weddings', 'spending_tier') &&
      has('weddings', 'table_count_override') &&
      has('service_packages', 'unit') &&
      has('plan_vendors', 'package_id') &&
      has('wedding_category_budgets') &&
      has('wedding_extra_costs');
    dbFeatures.sharing = has('wedding_share_links');
    dbFeatures.availability = has('package_availability') && has('package_resources');
    dbFeatures.weddingWard = has('weddings', 'ward');
  } catch {
    // Không kiểm tra được thì coi như đã chạy đủ
  } finally {
    await pool.end().catch(() => undefined);
  }
  return dbFeatures;
}

/** Các file SQL chưa chạy, để in cảnh báo lúc khởi động. */
export const pendingSqlFiles = () => (Object.keys(dbFeatures) as (keyof typeof dbFeatures)[]).filter((k) => !dbFeatures[k]).map((k) => SQL_FILE[k]);

/** Cột mới cần bỏ khỏi câu truy vấn mặc định khi file SQL tương ứng chưa chạy (Prisma global omit). */
export function omitMissingColumns() {
  const omit: Record<string, Record<string, true>> = {};
  if (!dbFeatures.timelineNotes) {
    omit.timeline_tasks = { note: true };
  }
  if (!dbFeatures.weddingWard) omit.weddings = { ward: true };
  if (!dbFeatures.budgetTiers) {
    omit.weddings = { ...omit.weddings, spending_tier: true, table_count_override: true };
    omit.service_packages = { unit: true };
    omit.plan_vendors = { package_id: true };
  }
  return omit;
}

/** Tính năng cần SQL chưa chạy: 503 kèm tên file để người dùng biết cần làm gì. */
export function requireDbFeature(feature: keyof typeof dbFeatures) {
  if (dbFeatures[feature]) return;
  throw new HttpException(
    { code: 'DB_MIGRATION_PENDING', message: `Tính năng này cần chạy file SQL ${SQL_FILE[feature]} lên cơ sở dữ liệu trước (xem docs/LICH_SU_THAY_DOI_DB.md).` },
    503,
  );
}

/** Đơn vị tính khi chưa có cột service_packages.unit: đọc "/mâm" hoặc "/bàn" trong mô tả như trước. */
export const unitOf = (p: { unit?: string | null; description?: string | null }) =>
  p.unit ?? (/\/\s*(mâm|bàn)/i.test(p.description ?? '') ? 'mâm' : 'gói');
