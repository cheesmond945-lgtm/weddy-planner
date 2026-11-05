-- Bỏ tính năng Danh sách khách mời (tab "Khách mời" của Kế hoạch): xóa bảng wedding_guests và tab 'guests' của link chia sẻ / thành viên.
-- Giữ nguyên weddings.guest_count (số khách dự kiến, dùng tính số bàn). Code backend/frontend đã bỏ hết phần khách mời.
-- Đã chạy trên CSDL dùng chung ngày 04/11/2026 (lúc đó có 2 khách của 1 đám cưới, đã sao lưu riêng). Chạy lại không sao.
-- Chạy xong không cần db:pull: schema.prisma đã bỏ model wedding_guests; chỉ cần npm run db:generate.

BEGIN;

-- 1. Bỏ tab 'guests' khỏi các link/thành viên đang lưu (còn lại ít nhất 1 tab; nếu chỉ có 'guests' thì về 'overview')
UPDATE wedding_share_links
SET tabs = CASE WHEN cardinality(array_remove(tabs, 'guests')) = 0 THEN ARRAY['overview']::text[] ELSE array_remove(tabs, 'guests') END
WHERE 'guests' = ANY (tabs);

UPDATE wedding_members
SET tabs = CASE WHEN cardinality(array_remove(tabs, 'guests')) = 0 THEN ARRAY['overview']::text[] ELSE array_remove(tabs, 'guests') END
WHERE tabs IS NOT NULL AND 'guests' = ANY (tabs);

-- 2. Ràng buộc tab: không còn 'guests'
ALTER TABLE wedding_share_links DROP CONSTRAINT IF EXISTS ck_wedding_share_links_tabs;
ALTER TABLE wedding_share_links ADD CONSTRAINT ck_wedding_share_links_tabs
  CHECK (tabs <@ ARRAY['overview', 'timeline', 'services', 'budget']::text[] AND cardinality(tabs) >= 1);

ALTER TABLE wedding_members DROP CONSTRAINT IF EXISTS ck_wedding_members_tabs;
ALTER TABLE wedding_members ADD CONSTRAINT ck_wedding_members_tabs
  CHECK (tabs IS NULL OR (tabs <@ ARRAY['overview', 'timeline', 'services', 'budget']::text[] AND cardinality(tabs) >= 1 AND role::text <> 'Owner'));

-- 3. Xóa bảng khách mời (không bảng nào khác trỏ tới)
DROP TABLE IF EXISTS public.wedding_guests;

COMMIT;
