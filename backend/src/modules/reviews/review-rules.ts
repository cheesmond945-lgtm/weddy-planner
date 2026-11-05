/*
 * Quy tắc đánh giá của khách (hàm thuần, không DB / Nest). Test: backend/test/review-rules.test.ts. Hợp đồng: docs/api/reviews.md
 */

/** Thẻ gợi ý nhanh khách chọn khi đánh giá (chọn được nhiều, không bắt buộc) */
export const REVIEW_TAGS = ['Đúng giờ', 'Đúng như cam kết', 'Tư vấn nhiệt tình', 'Giá hợp lý', 'Sẽ giới thiệu bạn bè'] as const;

/** Khách sửa được đánh giá trong từng này ngày kể từ lúc viết; sau đó khóa để NCC không bị đổi đánh giá về sau */
export const REVIEW_EDIT_DAYS = 30;

const DAY = 86_400_000;

/** Thẻ hợp lệ khách gửi lên (bỏ thẻ lạ, bỏ trùng, giữ thứ tự REVIEW_TAGS) */
export function parseTags(v: unknown): string[] {
  const picked = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return REVIEW_TAGS.filter((t) => picked.includes(t));
}

/** Đánh giá viết lúc `createdAt` còn sửa được lúc `now` không */
export const reviewEditable = (createdAt: Date | null | undefined, now = new Date()) => !!createdAt && now.getTime() - createdAt.getTime() <= REVIEW_EDIT_DAYS * DAY;

/** Hạn cuối còn sửa được (ISO) */
export const reviewEditableUntil = (createdAt: Date | null | undefined) => (createdAt ? new Date(createdAt.getTime() + REVIEW_EDIT_DAYS * DAY).toISOString() : null);

/**
 * Tên hiện công khai dưới đánh giá: giữ tên gọi, rút họ và tên đệm thành chữ đầu để giữ riêng tư
 * ("Lý Phương Trang" -> "Trang L.", "Minh" -> "Minh"). Rỗng thì "Khách hàng".
 */
export function publicName(full: string | null | undefined): string {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Khách hàng';
  if (parts.length === 1) return parts[0];
  return `${parts[parts.length - 1]} ${parts[0].charAt(0).toUpperCase()}.`;
}

/** Phản hồi của NCC: 2 đến 1000 ký tự sau khi bỏ khoảng trắng đầu cuối; trả lỗi hoặc null */
export function replyIssue(content: unknown): string | null {
  const t = typeof content === 'string' ? content.trim() : '';
  if (t.length < 2) return 'Nhập nội dung phản hồi.';
  if (t.length > 1000) return 'Phản hồi tối đa 1000 ký tự.';
  return null;
}
