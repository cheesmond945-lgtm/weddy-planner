/*
 * Mẫu timeline cưới (docs/TIMELINE.md). Danh sách và câu chữ lấy từ sheet "Ví dụ 90 ngày" của
 * docs/timeline/WebPlan_Timeline_ban_gon (2).xlsx. Mẫu nằm trong code, không lưu bảng CSDL.
 *
 * Mỗi mẫu gồm vị trí ngày theo một mốc: ngày = mốc + offset (offset âm là trước mốc).
 *   W = ngày cưới, E = ngày thực hiện của đơn dịch vụ (mặc định W), D = ngày đặt cọc, S = ngày chụp album.
 * Loại việc, "cần gặp NCC" (needsMeeting) và nguồn sinh suy ra từ task_code qua mẫu; task_code rỗng là việc khách tự thêm.
 * Mã *_BOOK (Mốc chốt) giữ nguyên để khớp timeline-hooks và các timeline cũ.
 */

/** Hạng mục theo slug (xem categorySlug trong catalog). Chụp ảnh và quay phim là một hạng mục "chup-anh". */
export type ServiceKey = 'nha-hang' | 'chup-anh' | 'trang-phuc' | 'decor' | 'makeup' | 'hoa-cuoi';

/** SELF tự làm, CHOOSE chọn NCC, BOOK mốc chốt (đặt cọc), DETAIL việc chi tiết, EVENT ngày thực hiện, PAYMENT thanh toán phần còn lại. */
export type TaskKind = 'SELF' | 'CHOOSE' | 'BOOK' | 'DETAIL' | 'EVENT' | 'PAYMENT';

export interface TimelineTemplate {
  /** Thứ tự trong sheet ví dụ, dùng để xếp việc cùng ngày */
  order: number;
  code: string;
  title: string;
  /** null: việc chung, không thuộc hạng mục nào */
  service: ServiceKey | null;
  kind: TaskKind;
  anchor: 'W' | 'E' | 'D' | 'S';
  offset: number;
  /** Có ưu tiên dời về T7/CN (chỉ lùi) vì cần đi gặp hoặc thử */
  weekendPreferred?: boolean;
  /** Việc chi tiết có nút "Hẹn với NCC" */
  needsMeeting?: boolean;
  /** Việc Chọn NCC ĐẦU TIÊN của dịch vụ: có nút "Gợi ý {dịch vụ}" (các việc Chọn NCC sau và Mốc chốt không có) */
  showSuggest?: boolean;
  /** Không bị ép lại khi thời gian chuẩn bị ngắn (W−3, W+7, W+30) */
  noShrink?: boolean;
}

/** Khoảng cách tối thiểu (ngày) từ ngày đặt cọc tới việc chi tiết đầu tiên của từng hạng mục: việc không sớm hơn D + k. */
export const MIN_AFTER_DEPOSIT: Record<ServiceKey, number> = {
  'nha-hang': 2,
  'chup-anh': 2,
  decor: 2,
  'trang-phuc': 3,
  makeup: 3,
  'hoa-cuoi': 2,
};

/** Việc khung xa nhất so với ngày cưới (ngày). Thời gian chuẩn bị L − 1 ≥ giá trị này thì không phải ép. */
export const FRAME_MAX_OFFSET = 270;

export const TIMELINE_TEMPLATES: readonly TimelineTemplate[] = [
  { order: 1, code: 'SELF_FAMILY_ALIGN', title: 'Thống nhất với hai gia đình: ngân sách, quy mô tiệc, giờ các lễ, tiệc tổ chức bên nào', service: null, kind: 'SELF', anchor: 'W', offset: -270 },
  { order: 2, code: 'SELF_GUEST_DRAFT', title: 'Lập danh sách khách sơ bộ, chọn phong cách và màu chủ đạo', service: null, kind: 'SELF', anchor: 'W', offset: -250 },
  { order: 3, code: 'VENUE_SHORTLIST', title: 'Lọc và hỏi giá 3–5 nhà hàng: lịch trống, giá mâm, phí sảnh, ưu đãi', service: 'nha-hang', kind: 'CHOOSE', anchor: 'W', offset: -235, showSuggest: true },
  { order: 4, code: 'VENUE_TOUR', title: 'Đi xem sảnh và ăn thử để đánh giá (sức chứa, sân khấu, bãi xe, chất lượng món)', service: 'nha-hang', kind: 'CHOOSE', anchor: 'W', offset: -205, weekendPreferred: true },
  { order: 5, code: 'PHOTO_SHORTLIST', title: 'Lọc và hỏi giá 3–5 studio chụp ảnh & quay phim: phong cách, các buổi cần (album, phóng sự, phim), lịch trống', service: 'chup-anh', kind: 'CHOOSE', anchor: 'W', offset: -200, showSuggest: true },
  { order: 6, code: 'PHOTO_CONSULT', title: 'Gặp tư vấn studio: xem album in thật, phim mẫu, trang phục chụp, hợp đồng mẫu', service: 'chup-anh', kind: 'CHOOSE', anchor: 'W', offset: -185, weekendPreferred: true },
  { order: 7, code: 'VENUE_BOOK', title: 'Chốt nhà hàng: so sánh, xác nhận đơn và đặt cọc', service: 'nha-hang', kind: 'BOOK', anchor: 'W', offset: -180 },
  { order: 8, code: 'PHOTO_BOOK', title: 'Chốt chụp ảnh & quay phim: so sánh, xác nhận đơn và đặt cọc', service: 'chup-anh', kind: 'BOOK', anchor: 'W', offset: -170 },
  { order: 9, code: 'VENUE_HALL_CONFIRM', title: 'Xác nhận sảnh, khung giờ, số bàn dự kiến, phụ phí', service: 'nha-hang', kind: 'DETAIL', anchor: 'D', offset: 2, needsMeeting: true },
  { order: 10, code: 'ATTIRE_SHORTLIST', title: 'Quyết định thuê hay may đo, số bộ cần; lọc và hỏi cửa hàng (mẫu còn trống ngày cưới, chính sách sửa)', service: 'trang-phuc', kind: 'CHOOSE', anchor: 'W', offset: -160, showSuggest: true },
  { order: 11, code: 'PHOTO_CONCEPT', title: 'Chốt concept, địa điểm, số bộ đồ, lịch chụp & quay album, giờ makeup, phương án thời tiết', service: 'chup-anh', kind: 'DETAIL', anchor: 'S', offset: -21, needsMeeting: true },
  { order: 12, code: 'DECOR_SHORTLIST', title: 'Lọc và hỏi giá đơn vị decor: gửi thông tin sảnh, ý tưởng hạng mục (cổng, backdrop, lối đi, bàn gallery)', service: 'decor', kind: 'CHOOSE', anchor: 'W', offset: -150, showSuggest: true },
  { order: 13, code: 'ATTIRE_TRY_STORE', title: 'Đi thử váy, vest để đánh giá cửa hàng (form dáng, chất liệu)', service: 'trang-phuc', kind: 'CHOOSE', anchor: 'W', offset: -145, weekendPreferred: true },
  { order: 14, code: 'DECOR_VISIT', title: 'Xem công trình decor thực tế, so sánh báo giá và hạng mục', service: 'decor', kind: 'CHOOSE', anchor: 'W', offset: -128 },
  { order: 15, code: 'ATTIRE_BOOK', title: 'Chốt trang phục: so sánh, xác nhận đơn và đặt cọc', service: 'trang-phuc', kind: 'BOOK', anchor: 'W', offset: -130 },
  { order: 16, code: 'MAKEUP_SHORTLIST', title: 'Lọc và hỏi giá chuyên viên makeup: ảnh khách thật, lịch sáng ngày cưới, phí di chuyển, giá trang điểm người nhà', service: 'makeup', kind: 'CHOOSE', anchor: 'W', offset: -120, showSuggest: true },
  { order: 17, code: 'DECOR_BOOK', title: 'Chốt decor: xác nhận đơn và đặt cọc', service: 'decor', kind: 'BOOK', anchor: 'W', offset: -115 },
  { order: 18, code: 'DECOR_BRIEF', title: 'Gửi concept chi tiết, màu chủ đạo, ảnh tham khảo', service: 'decor', kind: 'DETAIL', anchor: 'E', offset: -75 },
  { order: 19, code: 'SELF_RINGS', title: 'Chọn và mua nhẫn cưới', service: null, kind: 'SELF', anchor: 'W', offset: -85 },
  { order: 20, code: 'MAKEUP_ASSESS', title: 'Đánh giá tay nghề makeup (makeup thử có phí hoặc xem video thực tế)', service: 'makeup', kind: 'CHOOSE', anchor: 'W', offset: -105, weekendPreferred: true },
  { order: 21, code: 'ATTIRE_MEASURE', title: 'Đo số đo, chốt mẫu chính thức', service: 'trang-phuc', kind: 'DETAIL', anchor: 'E', offset: -75, weekendPreferred: true, needsMeeting: true },
  { order: 22, code: 'MAKEUP_BOOK', title: 'Chốt makeup: so sánh, xác nhận đơn và đặt cọc', service: 'makeup', kind: 'BOOK', anchor: 'W', offset: -95 },
  { order: 23, code: 'FLOWER_SHORTLIST', title: 'Lọc tiệm hoa, xem mẫu, hỏi hoa theo mùa và báo giá (theo màu váy và decor)', service: 'hoa-cuoi', kind: 'CHOOSE', anchor: 'W', offset: -65, showSuggest: true },
  { order: 24, code: 'SELF_INVITE_PRINT', title: 'Thiết kế, chọn mẫu và đặt in thiệp cưới', service: null, kind: 'SELF', anchor: 'W', offset: -60 },
  { order: 25, code: 'ATTIRE_ALBUM_PICKUP', title: 'Nhận trang phục cho buổi chụp album (bỏ qua nếu chụp bằng đồ studio)', service: 'trang-phuc', kind: 'DETAIL', anchor: 'S', offset: -1 },
  { order: 26, code: 'PHOTO_ALBUM_SHOOT', title: 'Chụp ảnh & quay phim album (pre-wedding)', service: 'chup-anh', kind: 'EVENT', anchor: 'S', offset: 0 },
  { order: 27, code: 'SELF_ENGAGEMENT', title: 'Chuẩn bị lễ ăn hỏi: thuê tráp, đội bê tráp (bỏ qua được)', service: null, kind: 'SELF', anchor: 'W', offset: -50 },
  { order: 28, code: 'VENUE_TASTING', title: 'Thử món và góp ý khẩu vị (mặn ngọt, món chay, món kiêng)', service: 'nha-hang', kind: 'DETAIL', anchor: 'E', offset: -45, weekendPreferred: true, needsMeeting: true },
  { order: 29, code: 'PHOTO_PICK_EDIT', title: 'Chọn ảnh, đoạn phim để chỉnh sửa', service: 'chup-anh', kind: 'DETAIL', anchor: 'S', offset: 7 },
  { order: 30, code: 'FLOWER_BOOK', title: 'Chốt hoa cưới: xác nhận đơn và đặt cọc', service: 'hoa-cuoi', kind: 'BOOK', anchor: 'W', offset: -45 },
  { order: 31, code: 'ATTIRE_FIT_FIRST', title: 'Thử đồ lần 1', service: 'trang-phuc', kind: 'DETAIL', anchor: 'E', offset: -45, weekendPreferred: true, needsMeeting: true },
  { order: 32, code: 'SELF_REGISTER', title: 'Đăng ký kết hôn (bỏ qua được)', service: null, kind: 'SELF', anchor: 'W', offset: -40 },
  { order: 33, code: 'SELF_INVITE_SEND', title: 'Chốt danh sách khách và gửi thiệp mời', service: null, kind: 'SELF', anchor: 'W', offset: -30 },
  { order: 34, code: 'VENUE_MENU_FINAL', title: 'Chốt thực đơn chính thức: món, đồ uống, bánh, tháp ly', service: 'nha-hang', kind: 'DETAIL', anchor: 'E', offset: -30 },
  { order: 35, code: 'MAKEUP_TRIAL', title: 'Makeup thử chính thức: layout, tone, kiểu tóc theo váy; dặn chăm sóc da', service: 'makeup', kind: 'DETAIL', anchor: 'E', offset: -30, weekendPreferred: true, needsMeeting: true },
  { order: 36, code: 'DECOR_REVIEW_MOCKUP', title: 'Duyệt phối cảnh; thống nhất kích thước sảnh và giờ setup với nhà hàng', service: 'decor', kind: 'DETAIL', anchor: 'E', offset: -30, needsMeeting: true },
  { order: 37, code: 'SELF_CARS', title: 'Thuê xe hoa, xe đưa đón (bỏ qua được)', service: null, kind: 'SELF', anchor: 'W', offset: -25 },
  { order: 38, code: 'PHOTO_REVIEW', title: 'Duyệt ảnh, phim đã chỉnh; chọn ảnh in cổng và ảnh phóng', service: 'chup-anh', kind: 'DETAIL', anchor: 'S', offset: 28 },
  { order: 39, code: 'FLOWER_PICK_STYLE', title: 'Chọn kiểu hoa cầm tay, hoa cài áo theo màu váy và decor', service: 'hoa-cuoi', kind: 'DETAIL', anchor: 'E', offset: -30 },
  { order: 40, code: 'SELF_SCRIPT', title: 'Lên kịch bản ngày cưới, phân công người nhà', service: null, kind: 'SELF', anchor: 'W', offset: -14 },
  { order: 41, code: 'FLOWER_FINAL', title: 'Chốt loại hoa, số lượng, giờ và địa chỉ giao hoa', service: 'hoa-cuoi', kind: 'DETAIL', anchor: 'E', offset: -14 },
  { order: 42, code: 'DECOR_FINAL', title: 'Chốt hạng mục cuối, chi phí phát sinh; gửi ảnh in cổng và bàn gallery', service: 'decor', kind: 'DETAIL', anchor: 'E', offset: -10 },
  { order: 43, code: 'VENUE_EVENT_FINAL', title: 'Chốt chi tiết tiệc: kịch bản, MC, âm thanh ánh sáng, số bàn chính thức và dự phòng, sơ đồ bàn', service: 'nha-hang', kind: 'DETAIL', anchor: 'E', offset: -7 },
  { order: 44, code: 'PHOTO_DELIVERY_PREP', title: 'Nhận album, ảnh phóng to; gửi kịch bản ngày cưới và danh sách ảnh gia đình cho ekip chụp & quay', service: 'chup-anh', kind: 'DETAIL', anchor: 'W', offset: -7 },
  { order: 45, code: 'ATTIRE_FIT_LAST', title: 'Thử lần cuối, chỉnh sửa; chọn giày, voan, trang sức', service: 'trang-phuc', kind: 'DETAIL', anchor: 'E', offset: -10, weekendPreferred: true, needsMeeting: true },
  { order: 46, code: 'MAKEUP_FINAL', title: 'Chốt giờ, địa điểm, số người cần trang điểm', service: 'makeup', kind: 'DETAIL', anchor: 'E', offset: -7 },
  { order: 47, code: 'SELF_FINAL_CHECK', title: 'Rà soát cuối: xác nhận tất cả NCC, giờ giấc, đồ cần mang', service: null, kind: 'SELF', anchor: 'W', offset: -3, noShrink: true },
  { order: 48, code: 'ATTIRE_RECEIVE', title: 'Nhận đồ, kiểm tra', service: 'trang-phuc', kind: 'DETAIL', anchor: 'E', offset: -2 },
  { order: 49, code: 'DECOR_EVENT', title: 'Trang trí ngày cưới: setup, nghiệm thu, tháo dỡ', service: 'decor', kind: 'EVENT', anchor: 'E', offset: 0 },
  { order: 50, code: 'MAKEUP_EVENT', title: 'Trang điểm ngày cưới', service: 'makeup', kind: 'EVENT', anchor: 'E', offset: 0 },
  { order: 51, code: 'FLOWER_EVENT', title: 'Nhận hoa, kiểm tra độ tươi', service: 'hoa-cuoi', kind: 'EVENT', anchor: 'E', offset: 0 },
  { order: 52, code: 'PHOTO_EVENT', title: 'Chụp ảnh & quay phim phóng sự ngày cưới', service: 'chup-anh', kind: 'EVENT', anchor: 'W', offset: 0 },
  { order: 53, code: 'VENUE_EVENT', title: 'Tổ chức tiệc cưới', service: 'nha-hang', kind: 'EVENT', anchor: 'E', offset: 0 },
  { order: 54, code: 'VENUE_PAY', title: 'Thanh toán phần còn lại cho nhà hàng', service: 'nha-hang', kind: 'PAYMENT', anchor: 'E', offset: 7 },
  { order: 55, code: 'PHOTO_PAY', title: 'Thanh toán phần còn lại cho studio', service: 'chup-anh', kind: 'PAYMENT', anchor: 'E', offset: 7 },
  { order: 56, code: 'ATTIRE_PAY', title: 'Thanh toán phần còn lại cho tiệm trang phục', service: 'trang-phuc', kind: 'PAYMENT', anchor: 'E', offset: 7 },
  { order: 57, code: 'DECOR_PAY', title: 'Thanh toán phần còn lại cho decor', service: 'decor', kind: 'PAYMENT', anchor: 'E', offset: 7 },
  { order: 58, code: 'MAKEUP_PAY', title: 'Thanh toán phần còn lại cho makeup', service: 'makeup', kind: 'PAYMENT', anchor: 'E', offset: 7 },
  { order: 59, code: 'FLOWER_PAY', title: 'Thanh toán phần còn lại cho tiệm hoa', service: 'hoa-cuoi', kind: 'PAYMENT', anchor: 'E', offset: 7 },
  { order: 60, code: 'ATTIRE_RETURN', title: 'Trả trang phục thuê (bỏ qua nếu may đo)', service: 'trang-phuc', kind: 'DETAIL', anchor: 'E', offset: 2 },
  { order: 61, code: 'SELF_THANKS', title: 'Cảm ơn khách, tổng kết chi phí', service: null, kind: 'SELF', anchor: 'W', offset: 7, noShrink: true },
  { order: 62, code: 'PHOTO_FILES', title: 'Nhận ảnh phóng sự, video highlight, phim full', service: 'chup-anh', kind: 'DETAIL', anchor: 'W', offset: 30, noShrink: true },
];

export const isFrameKind = (k: TaskKind) => k === 'SELF' || k === 'CHOOSE' || k === 'BOOK';

const byCode = new Map(TIMELINE_TEMPLATES.map((t) => [t.code, t]));
/** Mẫu theo task_code; undefined với việc khách tự thêm hoặc mã của timeline cũ. */
export const templateOf = (code: string | null | undefined) => (code ? byCode.get(code) : undefined);

/** Tên danh mục trong CSDL (service_categories.name) -> hạng mục của mẫu. Chụp ảnh và quay phim là một danh mục "Chụp ảnh". */
export const SERVICE_BY_CATEGORY_NAME: Record<string, ServiceKey> = {
  'Trung tâm tổ chức sự kiện': 'nha-hang',
  'Chụp ảnh': 'chup-anh',
  'Trang phục': 'trang-phuc',
  'Trang trí': 'decor',
  'Trang điểm': 'makeup',
  Makeup: 'makeup',
  'Hoa cưới': 'hoa-cuoi',
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
