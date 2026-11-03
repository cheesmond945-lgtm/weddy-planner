-- Ngân sách và gợi ý phân bổ (thuật toán backend, không gọi AI). Đặc tả: docs/api/weddings.md mục 7.
-- Phân bổ từng hạng mục là giá trị dẫn xuất, tính lại mỗi lần đọc: KHÔNG có cột số tiền phân bổ.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor hoặc `npx prisma db execute --file prisma/manual/<file>` trong backend/).
-- Ứng dụng KHÔNG tự chạy file này. Không dùng prisma migrate / db push. schema.prisma đã được sửa tay cho khớp.
-- An toàn khi chạy lại (IF NOT EXISTS, kiểm tra constraint). Câu gỡ (rollback) ở cuối file.
-- Tổng ngân sách và số khách dùng cột có sẵn weddings.budget, weddings.guest_count; số bàn tối thiểu: service_packages.min_tables (đã có).

BEGIN;

ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS budget_preset varchar(20) NOT NULL DEFAULT 'BALANCED',
  ADD COLUMN IF NOT EXISTS custom_weights jsonb,
  ADD COLUMN IF NOT EXISTS own_venue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS own_venue_cost numeric(18, 2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_weddings_budget_preset') THEN
    ALTER TABLE public.weddings ADD CONSTRAINT ck_weddings_budget_preset CHECK (budget_preset IN ('BALANCED', 'SPACE', 'VISUAL', 'CUSTOM'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_weddings_own_venue_cost') THEN
    ALTER TABLE public.weddings ADD CONSTRAINT ck_weddings_own_venue_cost CHECK (own_venue_cost IS NULL OR own_venue_cost >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.weddings.budget_preset IS 'Mức chia ngân sách: BALANCED (Cân bằng), SPACE (Ưu tiên không gian), VISUAL (Ưu tiên hình ảnh), CUSTOM (Tùy chỉnh)';
COMMENT ON COLUMN public.weddings.custom_weights IS 'Tỷ lệ % mức Tùy chỉnh theo slug hạng mục, tổng 100, ví dụ {"decor":30,"chup-anh":25,...}';
COMMENT ON COLUMN public.weddings.own_venue IS 'Tự lo tiệc ngoài nền tảng: bỏ trung tâm tiệc khỏi phép tính';
COMMENT ON COLUMN public.weddings.own_venue_cost IS 'Chi phí tiệc tự lo (tùy chọn), trừ vào tổng như một khoản đã chọn';

COMMIT;

-- ROLLBACK (chạy tay nếu cần gỡ):
-- ALTER TABLE public.weddings DROP CONSTRAINT IF EXISTS ck_weddings_budget_preset, DROP CONSTRAINT IF EXISTS ck_weddings_own_venue_cost,
--   DROP COLUMN IF EXISTS budget_preset, DROP COLUMN IF EXISTS custom_weights, DROP COLUMN IF EXISTS own_venue, DROP COLUMN IF EXISTS own_venue_cost;
