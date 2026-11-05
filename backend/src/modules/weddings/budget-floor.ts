/*
 * Ngân sách tối thiểu khi lưu thông tin đám cưới (cùng quy tắc với form, frontend weddingFormRules.ts):
 * - nhỏ hơn gói rẻ nhất trên Forever: không làm được dịch vụ nào;
 * - nhỏ hơn tổng giá thấp nhất của các dịch vụ đã chọn: chỉ đủ vài dịch vụ, phải tăng ngân sách hoặc bỏ bớt dịch vụ.
 * minCosts: chi phí thấp nhất từng hạng mục theo số khách (ServicesService.minCosts). Module thuần, có test.
 */

/** Tiền làm tròn lên 100.000đ để ghi trong câu báo lỗi */
const vnd = (x: number) => `${(Math.ceil(x / 100_000) * 100_000).toLocaleString('vi-VN')}đ`;

export interface BudgetFloorErrors {
  budget?: string;
  categorySlugs?: string;
}

export function budgetFloorErrors(budget: number, guests: number, slugs: string[] | null, minCosts: Record<string, number>): BudgetFloorErrors {
  const all = Object.values(minCosts).filter((c) => c > 0);
  if (!all.length || !(budget > 0)) return {};
  const cheapest = Math.min(...all);
  if (budget < cheapest) return { budget: `Ngân sách quá thấp: gói rẻ nhất trên Forever khoảng ${vnd(cheapest)}, chưa đủ cho dịch vụ nào.` };
  if (!slugs) return {};
  const costs = slugs
    .map((s) => minCosts[s])
    .filter((c): c is number => c > 0)
    .sort((a, b) => a - b);
  const need = costs.reduce((t, c) => t + c, 0);
  if (!costs.length || budget >= need) return {};
  // Số dịch vụ rẻ nhất vừa ngân sách (cộng dần từ rẻ đến đắt)
  let fit = 0;
  for (let t = 0; fit < costs.length && t + costs[fit] <= budget; fit++) t += costs[fit];
  return {
    budget: `Ngân sách chưa đủ cho ${costs.length} dịch vụ đã chọn: tối thiểu khoảng ${vnd(need)} cho ${guests.toLocaleString('vi-VN')} khách. Hãy tăng ngân sách hoặc bỏ bớt dịch vụ.`,
    categorySlugs: `Với ngân sách này chỉ đủ khoảng ${fit} dịch vụ. Bỏ bớt dịch vụ hoặc tăng ngân sách.`,
  };
}
