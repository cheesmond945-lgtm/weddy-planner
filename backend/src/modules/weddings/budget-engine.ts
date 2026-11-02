/**
 * Hàm chi phí gói dùng chung (không DB, không Nest), có unit test ở backend/test/budget-engine.test.cjs.
 * Thuật toán phân bổ ngân sách ở allocation.ts (docs/api/weddings.md mục 7).
 */
import { CAPACITY_CATEGORIES, GUESTS_PER_TABLE } from './budget.config';

export type PackageUnit = 'mâm' | 'gói';

export interface EnginePackage {
  id: string;
  vendorId: string;
  name: string;
  /** Giá một mâm (unit = mâm) hoặc giá trọn gói */
  price: number;
  unit: PackageUnit;
  capacity: number | null;
  minTables: number | null;
}


export interface EnginePlanVendor {
  vendorId: string;
  categoryId: string;
  slug: string;
  /** Gói khách đã chọn (plan_vendors.package_id) */
  selectedPackageId: string | null;
  /** Tổng đơn còn hiệu lực mới nhất; null khi chưa có đơn */
  orderTotal: number | null;
  /** Tiền cọc đã trả của đơn đó (đơn đã cọc / hoàn thành); null khi chưa cọc */
  orderDeposited?: number | null;
  /** Gói đang bán của nhà cung cấp này (đã duyệt, nhà cung cấp đang hiện) */
  packages: EnginePackage[];
}

/** Số mâm: số khách tự nhập nếu có, ngược lại ceil(số khách / 10). */
export const tableCount = (guestCount: number, override: number | null) => override ?? Math.max(1, Math.ceil(Math.max(0, guestCount) / GUESTS_PER_TABLE));

/** Chi phí một gói: gói theo mâm = giá × max(số mâm, số mâm tối thiểu, 1); gói khác = giá trọn gói. */
export const packageCost = (p: Pick<EnginePackage, 'price' | 'unit' | 'minTables'>, tables: number) =>
  p.unit === 'mâm' ? p.price * Math.max(tables, p.minTables ?? 0, 1) : p.price;

/** Gói đủ chỗ (hạng mục có xét sức chứa): sức chứa ≥ số khách; gói không ghi sức chứa thì giữ lại. */
export const fitsGuests = (p: EnginePackage, slug: string, guestCount: number) => !CAPACITY_CATEGORIES.includes(slug) || p.capacity === null || p.capacity >= guestCount;

/**
 * Gói dự kiến của một nhà cung cấp (khách chưa chọn gói, chưa có đơn): chi phí ước tính thấp nhất trong các gói đủ chỗ
 * (không gói nào đủ thì xét tất cả); hòa thì gói giá thấp hơn. Cùng công thức với "Gợi ý cho bạn" (suggest-rules.ts).
 */
export function plannedPackage(packages: EnginePackage[], slug: string, guestCount: number, tables: number) {
  if (!packages.length) return null;
  const fitting = packages.filter((p) => fitsGuests(p, slug, guestCount));
  const pool = (fitting.length ? fitting : packages).map((p) => ({ p, cost: packageCost(p, tables) }));
  return [...pool].sort((a, b) => a.cost - b.cost || a.p.price - b.p.price || a.p.id.localeCompare(b.p.id))[0];
}
