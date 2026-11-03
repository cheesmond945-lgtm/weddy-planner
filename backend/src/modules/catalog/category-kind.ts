/*
 * Nhận diện LOẠI hạng mục từ tên danh mục trong CSDL (service_categories.name) — MỘT nơi duy nhất cho lịch sảnh, mẫu timeline, nhãn Gợi ý, slug.
 * Tên hiển thị có thể bị đổi trong CSDL ("Trung tâm tổ chức sự kiện" -> "Trung tâm tiệc cưới"), nên so khớp theo TỪ KHÓA đã bỏ dấu và viết thường,
 * không so bằng tên đầy đủ. Hàm thuần (chỉ ghi log cảnh báo một lần cho mỗi tên lạ).
 */
import { Logger } from '@nestjs/common';

export type CategoryKind = 'nha-hang' | 'chup-anh' | 'trang-phuc' | 'decor' | 'makeup' | 'hoa-cuoi';

/** Bỏ dấu tiếng Việt, viết thường, gộp khoảng trắng: "Trung tâm Tiệc cưới" -> "trung tam tiec cuoi". */
export const foldName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Từ khóa theo thứ tự ưu tiên: các loại cụ thể trước, nhà hàng / sảnh sau cùng
 * (để "Trang trí sảnh tiệc cưới" vẫn là decor, "Hoa cưới" không bị bắt bởi "tiệc cưới").
 */
const RULES: readonly { kind: CategoryKind; test: RegExp }[] = [
  { kind: 'makeup', test: /trang diem|make ?up/ },
  { kind: 'decor', test: /trang tri|decor/ },
  { kind: 'trang-phuc', test: /trang phuc|\bvay\b/ },
  { kind: 'chup-anh', test: /chup|quay/ },
  { kind: 'hoa-cuoi', test: /\bhoa\b/ },
  { kind: 'nha-hang', test: /nha hang|tiec cuoi|to chuc su kien|\bsanh\b/ },
];

const log = new Logger('CategoryKind');
const warned = new Set<string>();

/** Loại hạng mục theo tên; không khớp thì undefined và ghi log cảnh báo MỘT lần cho tên đó. */
export function categoryKindOf(category: string | { name?: string | null } | null | undefined): CategoryKind | undefined {
  const name = typeof category === 'string' ? category : (category?.name ?? '');
  const folded = foldName(name);
  if (!folded) return undefined;
  const hit = RULES.find((r) => r.test.test(folded));
  if (!hit && !warned.has(folded)) {
    warned.add(folded);
    log.warn(`Danh mục "${name}" không khớp loại hạng mục nào (nhà hàng / chụp ảnh / trang phục / trang trí / trang điểm / hoa cưới).`);
  }
  return hit?.kind;
}
