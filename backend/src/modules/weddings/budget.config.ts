/**
 * Hằng số của hàm tính ngân sách (budget-engine.ts). Nhóm chỉnh ở đây, không sửa công thức.
 * Đặc tả: docs/api/weddings.md mục 7.
 */

export type SpendingTier = 'AUTO' | 'SAVING' | 'BALANCED' | 'PREMIUM';
export type ConcreteTier = Exclude<SpendingTier, 'AUTO'>;

export const SPENDING_TIERS: SpendingTier[] = ['AUTO', 'SAVING', 'BALANCED', 'PREMIUM'];

/** Phân vị (nearest-rank) của chi phí các gói trong hạng mục cho từng mức chi */
export const TIER_PERCENTILE: Record<ConcreteTier, number> = { SAVING: 0.2, BALANCED: 0.45, PREMIUM: 0.75 };

/** AUTO thử lần lượt từ cao xuống thấp, lấy mức cao nhất vừa ngân sách */
export const AUTO_ORDER: ConcreteTier[] = ['PREMIUM', 'BALANCED', 'SAVING'];

export const TIER_LABEL: Record<SpendingTier, string> = { AUTO: 'Tự động', SAVING: 'Tiết kiệm', BALANCED: 'Cân đối', PREMIUM: 'Cao cấp' };

/** Số khách một mâm khi tự tính số mâm */
export const GUESTS_PER_TABLE = 10;

/** Làm tròn ngân sách tới bội số này (đồng) */
export const BUDGET_ROUNDING = 100_000;

/** Hạng mục xét sức chứa: loại gói có sức chứa nhỏ hơn số khách */
export const CAPACITY_CATEGORIES = ['nha-hang'];

/**
 * Tỷ lệ dự phòng khi hạng mục không có gói nào: tổng ngân sách × tỷ lệ / tổng tỷ lệ các hạng mục khách chọn.
 * Khóa là slug (categorySlug); "Trang điểm" trong DB có slug "trang-diem", tên cũ "Makeup" là "makeup".
 */
export const FALLBACK_SHARE: Record<string, number> = {
  'nha-hang': 0.4,
  decor: 0.12,
  'chup-anh': 0.1,
  'trang-phuc': 0.08,
  'hoa-cuoi': 0.08,
  makeup: 0.06,
  'trang-diem': 0.06,
};
/** Hạng mục lạ (chưa có trong bảng trên) */
export const FALLBACK_SHARE_DEFAULT = 0.05;
