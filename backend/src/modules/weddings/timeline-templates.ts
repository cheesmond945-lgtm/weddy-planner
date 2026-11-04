/*
 * Mẫu timeline cưới (docs/TIMELINE.md). Danh sách và câu chữ lấy từ sheet "Ví dụ 90 ngày" của
 * docs/timeline/WebPlan_Timeline_ban_gon (2).xlsx. Mẫu nằm trong code, không lưu bảng CSDL.
 *
 * Chỉ còn việc KHUNG (Tự làm, Chọn NCC, Mốc chốt), mỗi mẫu có ngày = ngày cưới W + offset (offset âm là trước W).
 * Việc chi tiết của đơn KHÔNG sinh từ mẫu nữa: NCC khai theo từng gói (bảng package_tasks), sinh lúc cọc (timeline-hooks.ts syncOrderPackageTasks).
 * Loại việc suy ra từ task_code qua mẫu; task_code rỗng là việc khách tự thêm; mã 'PKG:<id>' / 'PAY:<orderId>' là việc chi tiết của đơn.
 * Mã *_BOOK (Mốc chốt) giữ nguyên để khớp timeline-hooks và các timeline cũ.
 * Việc khung: 31 việc (đợt 1). Mã không còn trong mẫu (vd SELF_ENGAGEMENT của timeline cũ) vẫn nằm trong CSDL; templateOf trả undefined, các nơi dùng phải chịu được.
 */
import { categoryKindOf } from '../catalog/category-kind.ts';

/** Hạng mục theo slug (xem categorySlug trong catalog). Chụp ảnh và quay phim là một hạng mục "chup-anh". */
export type ServiceKey = 'nha-hang' | 'chup-anh' | 'trang-phuc' | 'decor' | 'makeup' | 'hoa-cuoi';

/** SELF tự làm, CHOOSE chọn NCC, BOOK mốc chốt (đặt cọc). */
export type TaskKind = 'SELF' | 'CHOOSE' | 'BOOK';

export interface TimelineTemplate {
  /** Thứ tự trong sheet ví dụ, dùng để xếp việc cùng ngày */
  order: number;
  code: string;
  title: string;
  /** null: việc chung, không thuộc hạng mục nào */
  service: ServiceKey | null;
  kind: TaskKind;
  anchor: 'W';
  offset: number;
  /** Có ưu tiên dời về T7/CN (chỉ lùi) vì cần đi gặp hoặc thử */
  weekendPreferred?: boolean;
  /** Việc Chọn NCC ĐẦU TIÊN của dịch vụ: có nút "Gợi ý {dịch vụ}" (các việc Chọn NCC sau và Mốc chốt không có) */
  showSuggest?: boolean;
  /** Không bị ép lại khi thời gian chuẩn bị ngắn (W−3, W+7) */
  noShrink?: boolean;
}

/** Việc khung xa nhất so với ngày cưới (ngày). Thời gian chuẩn bị L − 1 ≥ giá trị này thì không phải ép. */
export const FRAME_MAX_OFFSET = 270;

export const TIMELINE_TEMPLATES: readonly TimelineTemplate[] = [
  // Việc KHUNG (SELF / CHOOSE / BOOK): order 1..31 theo thứ tự dòng
  { order: 1, code: 'SELF_FAMILY_ALIGN', title: 'Thống nhất với hai gia đình: ngân sách, quy mô tiệc, giờ các lễ, tiệc tổ chức bên nào', service: null, kind: 'SELF', anchor: 'W', offset: -270 },
  { order: 2, code: 'SELF_GUEST_DRAFT', title: 'Lập danh sách khách sơ bộ, chọn phong cách và màu chủ đạo', service: null, kind: 'SELF', anchor: 'W', offset: -250 },
  { order: 3, code: 'VENUE_SHORTLIST', title: 'Lọc và hỏi giá 3–5 nhà hàng: lịch trống, giá bàn, phí sảnh, ưu đãi', service: 'nha-hang', kind: 'CHOOSE', anchor: 'W', offset: -235, showSuggest: true },
  { order: 4, code: 'VENUE_TOUR', title: 'Đi xem sảnh để đánh giá: sức chứa, sân khấu, bãi xe, khung giờ còn trống', service: 'nha-hang', kind: 'CHOOSE', anchor: 'W', offset: -205, weekendPreferred: true },
  { order: 5, code: 'PHOTO_SHORTLIST', title: 'Lọc và hỏi giá 3–5 studio chụp ảnh & quay phim: phong cách, các buổi cần, lịch trống', service: 'chup-anh', kind: 'CHOOSE', anchor: 'W', offset: -200, showSuggest: true },
  { order: 6, code: 'VENUE_TASTE', title: 'Thử món theo thực đơn dự kiến, góp ý khẩu vị; xin báo giá chính thức, phụ phí và ưu đãi tặng kèm', service: 'nha-hang', kind: 'CHOOSE', anchor: 'W', offset: -190, weekendPreferred: true },
  { order: 7, code: 'PHOTO_CONSULT', title: 'Gặp tư vấn studio: xem album in thật, phim mẫu; trao đổi concept, số bộ đồ, địa điểm và sản phẩm bàn giao', service: 'chup-anh', kind: 'CHOOSE', anchor: 'W', offset: -185, weekendPreferred: true },
  { order: 8, code: 'VENUE_BOOK', title: 'Chốt nhà hàng: so sánh, xác nhận đơn và đặt cọc', service: 'nha-hang', kind: 'BOOK', anchor: 'W', offset: -180 },
  { order: 9, code: 'PHOTO_BOOK', title: 'Chốt chụp ảnh & quay phim: so sánh, xác nhận đơn và đặt cọc', service: 'chup-anh', kind: 'BOOK', anchor: 'W', offset: -170 },
  { order: 10, code: 'ATTIRE_SHORTLIST', title: 'Quyết định thuê hay may đo, số bộ cần; lọc và hỏi cửa hàng', service: 'trang-phuc', kind: 'CHOOSE', anchor: 'W', offset: -160, showSuggest: true },
  { order: 11, code: 'DECOR_SHORTLIST', title: 'Lọc và hỏi giá đơn vị decor: gửi thông tin sảnh, ý tưởng hạng mục', service: 'decor', kind: 'CHOOSE', anchor: 'W', offset: -150, showSuggest: true },
  { order: 12, code: 'ATTIRE_TRY_STORE', title: 'Đi thử váy, vest để đánh giá cửa hàng', service: 'trang-phuc', kind: 'CHOOSE', anchor: 'W', offset: -145, weekendPreferred: true },
  { order: 13, code: 'ATTIRE_PICK', title: 'Chọn mẫu chính thức, đo số đo; hỏi rõ số lần sửa, phụ kiện đi kèm, thời gian giao trả', service: 'trang-phuc', kind: 'CHOOSE', anchor: 'W', offset: -135, weekendPreferred: true },
  { order: 14, code: 'ATTIRE_BOOK', title: 'Chốt trang phục: so sánh, xác nhận đơn và đặt cọc', service: 'trang-phuc', kind: 'BOOK', anchor: 'W', offset: -130 },
  { order: 15, code: 'DECOR_VISIT', title: 'Xem công trình decor thực tế, so sánh báo giá và hạng mục', service: 'decor', kind: 'CHOOSE', anchor: 'W', offset: -128 },
  { order: 16, code: 'DECOR_SCOPE', title: 'Gửi concept, màu chủ đạo, ảnh tham khảo; chốt danh sách hạng mục để nhận báo giá cuối', service: 'decor', kind: 'CHOOSE', anchor: 'W', offset: -120 },
  { order: 17, code: 'MAKEUP_SHORTLIST', title: 'Lọc và hỏi giá chuyên viên makeup: ảnh khách thật, lịch sáng ngày cưới, phí di chuyển, giá trang điểm người nhà', service: 'makeup', kind: 'CHOOSE', anchor: 'W', offset: -120, showSuggest: true },
  { order: 18, code: 'DECOR_BOOK', title: 'Chốt decor: xác nhận đơn và đặt cọc', service: 'decor', kind: 'BOOK', anchor: 'W', offset: -115 },
  { order: 19, code: 'MAKEUP_ASSESS', title: 'Makeup thử hoặc xem video thực tế để đánh giá tay nghề; trao đổi tone, kiểu tóc theo váy', service: 'makeup', kind: 'CHOOSE', anchor: 'W', offset: -105, weekendPreferred: true },
  { order: 20, code: 'MAKEUP_BOOK', title: 'Chốt makeup: so sánh, xác nhận đơn và đặt cọc', service: 'makeup', kind: 'BOOK', anchor: 'W', offset: -95 },
  { order: 21, code: 'SELF_RINGS', title: 'Chọn và mua nhẫn cưới', service: null, kind: 'SELF', anchor: 'W', offset: -85 },
  { order: 22, code: 'FLOWER_SHORTLIST', title: 'Lọc tiệm hoa, xem mẫu, hỏi hoa theo mùa và báo giá', service: 'hoa-cuoi', kind: 'CHOOSE', anchor: 'W', offset: -65, showSuggest: true },
  { order: 23, code: 'SELF_INVITE_PRINT', title: 'Thiết kế, chọn mẫu và đặt in thiệp cưới', service: null, kind: 'SELF', anchor: 'W', offset: -60 },
  { order: 24, code: 'FLOWER_PICK', title: 'Gửi tiệm ảnh váy và màu decor; chọn mẫu hoa cầm tay, hoa cài áo, số lượng', service: 'hoa-cuoi', kind: 'CHOOSE', anchor: 'W', offset: -55 },
  { order: 25, code: 'FLOWER_BOOK', title: 'Chốt hoa cưới: xác nhận đơn và đặt cọc', service: 'hoa-cuoi', kind: 'BOOK', anchor: 'W', offset: -45 },
  { order: 26, code: 'SELF_REGISTER', title: 'Đăng ký kết hôn', service: null, kind: 'SELF', anchor: 'W', offset: -40 },
  { order: 27, code: 'SELF_INVITE_SEND', title: 'Chốt danh sách khách và gửi thiệp mời', service: null, kind: 'SELF', anchor: 'W', offset: -30 },
  { order: 28, code: 'SELF_CARS', title: 'Thuê xe hoa, xe đưa đón', service: null, kind: 'SELF', anchor: 'W', offset: -25 },
  { order: 29, code: 'SELF_SCRIPT', title: 'Lên kịch bản ngày cưới: giờ đón dâu, giờ tiệc, phân công người nhà', service: null, kind: 'SELF', anchor: 'W', offset: -21 },
  { order: 30, code: 'SELF_FINAL_CHECK', title: 'Rà soát cuối: lịch trình ngày cưới, đồ cần mang, người phụ trách từng việc', service: null, kind: 'SELF', anchor: 'W', offset: -3, noShrink: true },
  { order: 31, code: 'SELF_THANKS', title: 'Cảm ơn khách, tổng kết chi phí', service: null, kind: 'SELF', anchor: 'W', offset: 7, noShrink: true },
];

export const isFrameKind = (k: TaskKind) => k === 'SELF' || k === 'CHOOSE' || k === 'BOOK';

const byCode = new Map(TIMELINE_TEMPLATES.map((t) => [t.code, t]));
/** Mẫu theo task_code; undefined với việc khách tự thêm hoặc mã của timeline cũ. */
export const templateOf = (code: string | null | undefined) => (code ? byCode.get(code) : undefined);

/** Hạng mục của mẫu theo tên danh mục trong CSDL (service_categories.name), nhận diện theo từ khóa: xem catalog/category-kind.ts. */
export const serviceKeyOf = (categoryName: string | null | undefined): ServiceKey | undefined => categoryKindOf(categoryName);

/** Nhãn nút Gợi ý theo dịch vụ: một chỗ dùng chung, backend trả kèm `suggest.label`. */
export const SUGGEST_LABEL: Record<ServiceKey, string> = {
  'nha-hang': 'Gợi ý trung tâm tiệc cưới',
  'chup-anh': 'Gợi ý studio chụp ảnh & quay phim',
  'trang-phuc': 'Gợi ý cửa hàng trang phục cưới',
  decor: 'Gợi ý đơn vị trang trí',
  makeup: 'Gợi ý chuyên viên trang điểm',
  'hoa-cuoi': 'Gợi ý tiệm hoa cưới',
};

/**
 * Nút "Gợi ý {dịch vụ} →": chỉ việc Chọn NCC đầu tiên của dịch vụ (cờ showSuggest, không suy theo tên việc), hoặc Mốc chốt đang Todo
 * mà dịch vụ vừa có đơn đã cọc bị hủy (khách cần tìm NCC khác). Mã không có trong mẫu (timeline cũ) thì không có nút.
 */
export function suggestOf(t: TimelineTemplate | undefined, state: { done: boolean; hasCancelledOrder: boolean }): boolean {
  if (!t) return false;
  if (t.kind === 'CHOOSE') return !!t.showSuggest;
  if (t.kind === 'BOOK') return !state.done && state.hasCancelledOrder;
  return false;
}
