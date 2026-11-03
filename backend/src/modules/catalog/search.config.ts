/**
 * Hằng số của tìm kiếm dịch vụ (search-rules.ts, search.service.ts). Nhóm chỉnh ở đây, không sửa công thức.
 * Mọi từ viết ở dạng đã bỏ dấu, chữ thường (so khớp sau khi chuẩn hóa câu gõ).
 */

/** Độ dài tối đa của câu gõ (ký tự); dài hơn thì cắt */
export const QUERY_MAX_LENGTH = 100;

/** Từ nối bỏ khỏi câu gõ trước khi tìm */
export const STOP_WORDS = ['o', 'tai', 'cho', 'va', 'cua', 'voi', 'la', 'cac', 'nhung', 'mot', 'can', 'muon', 'tim'];

/**
 * Từ đồng nghĩa hạng mục: cụm gõ → tên hạng mục chuẩn (đã bỏ dấu, khớp service_categories.name).
 * Cụm khớp được hiểu là lọc theo hạng mục, không đem đi khớp chữ trong tên / mô tả.
 */
export const CATEGORY_SYNONYMS: Record<string, string> = {
  'chup hinh': 'chup anh',
  'chup anh': 'chup anh',
  'chup anh cuoi': 'chup anh',
  'quay phim': 'chup anh',
  makeup: 'trang diem',
  'make up': 'trang diem',
  'trang diem': 'trang diem',
  'nha hang': 'trung tam to chuc su kien',
  'trung tam tiec cuoi': 'trung tam to chuc su kien',
  'trung tam to chuc su kien': 'trung tam to chuc su kien',
  'sanh cuoi': 'trung tam to chuc su kien',
  'sanh tiec': 'trung tam to chuc su kien',
  decor: 'trang tri',
  'trang tri': 'trang tri',
  'hoa cuoi': 'hoa cuoi',
  'hoa cam tay': 'hoa cuoi',
  'vay cuoi': 'trang phuc',
  'ao cuoi': 'trang phuc',
  'trang phuc': 'trang phuc',
  vest: 'trang phuc',
};

/** Từ chung chung về chất lượng: bỏ khỏi từ khóa; có trong câu thì xếp theo điểm đánh giá giảm dần */
export const GENERIC_WORDS = ['dep', 'xinh', 'tot', 'hay', 'sang', 'chat luong', 'uy tin', 'ung y', 'dep nhat', 'tot nhat'];

/** Cụm nhiều từ giữ nguyên một khối (để "sang" trong "sang trọng" không bị coi là từ chung chung) */
export const KEEP_PHRASES = ['sang trong', 'toi gian', 'hien dai', 'co dien', 'truyen thong', 'san vuon', 'ngoai troi', 'pha le'];

/** Từ chỉ rẻ: bỏ khỏi từ khóa, xếp theo chi phí ước tính tăng dần */
export const CHEAP_WORDS = ['gia re', 'gia mem', 'tiet kiem', 'binh dan', 're'];

/** Từ chỉ giá: câu có số hoặc một trong các từ này thì bỏ qua tầng 1, chuyển thẳng tầng 2 (AI trích bộ lọc) */
export const PRICE_WORDS = ['duoi', 'tren', 'tam', 'khoang', 'trieu', 'tr', 'cu', 'k', 'nghin', 'ngan'];

/** "Tầm X" = X ± tỉ lệ này */
export const PRICE_TOLERANCE = 0.2;

/** Giới hạn giá hợp lý (đồng): ngoài khoảng này thì bỏ bộ lọc giá và báo không hiểu phần giá */
export const PRICE_SANE_MAX = 10_000_000_000;

/** Thời gian chờ AI tối đa (ms) */
export const AI_TIMEOUT_MS = 6_000;

/** Giữ bộ lọc AI đã trích cho cùng câu đã chuẩn hóa (chỉ cache JSON bộ lọc, không cache danh sách kết quả) */
export const AI_CACHE_TTL_MS = 24 * 60 * 60_000;
export const AI_CACHE_MAX = 500;

/** Số lần gọi AI tối đa mỗi giờ: khách vãng lai (theo IP) chặt hơn người đã đăng nhập (theo tài khoản) */
export const AI_LIMIT_GUEST_PER_HOUR = 10;
export const AI_LIMIT_USER_PER_HOUR = 30;

/** Hướng dẫn khi câu gõ không còn từ để tìm hoặc AI không hiểu */
export const GUIDE_MESSAGE = 'Bạn muốn tìm dịch vụ nào? Thử gõ loại dịch vụ hoặc phong cách, ví dụ trang trí tối giản';
