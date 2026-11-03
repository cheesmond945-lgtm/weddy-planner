-- Mức chi tiêu, ngân sách hạng mục theo giá gói thật, gắn gói vào kế hoạch, chi phí khác.
-- Đặc tả: docs/api/weddings.md mục 7, docs/database.md mục 10.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor hoặc `npx prisma db execute --file prisma/manual/<file>` trong backend/).
-- Ứng dụng KHÔNG tự chạy file này. Không dùng prisma migrate / db push. schema.prisma đã được sửa tay cho khớp.
-- An toàn khi chạy lại (IF NOT EXISTS, kiểm tra constraint). Mọi cột mới cho phép rỗng hoặc có mặc định, giữ dữ liệu cũ.
-- Thay cho file prisma/sql/2026-10-29-03-budget.sql (chưa từng chạy, đã xóa).
-- Câu gỡ (rollback) ở cuối file.

BEGIN;

-- 1. weddings: mức chi tiêu và số bàn sửa tay. Cột style giữ lại, ứng dụng không dùng nữa.
ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS spending_tier        varchar(20) NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS table_count_override integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_weddings_spending_tier') THEN
    ALTER TABLE public.weddings ADD CONSTRAINT ck_weddings_spending_tier CHECK (spending_tier IN ('AUTO', 'SAVING', 'BALANCED', 'PREMIUM'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_weddings_table_count_override') THEN
    ALTER TABLE public.weddings ADD CONSTRAINT ck_weddings_table_count_override CHECK (table_count_override IS NULL OR table_count_override >= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.weddings.spending_tier IS 'Mức chi tiêu: AUTO (tự chọn mức cao nhất vừa ngân sách), SAVING, BALANCED, PREMIUM';
COMMENT ON COLUMN public.weddings.table_count_override IS 'Số bàn khách tự nhập (>= 1). NULL: tự tính ceil(guest_count / 10)';
COMMENT ON COLUMN public.weddings.style IS 'KHÔNG DÙNG NỮA (bỏ phong cách khỏi thông tin đám cưới 30/10/2026). Giữ để không mất dữ liệu cũ';

-- 2. service_packages: đơn vị tính. min_tables đã có sẵn.
ALTER TABLE public.service_packages
  ADD COLUMN IF NOT EXISTS unit varchar(10) NOT NULL DEFAULT 'gói';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_service_packages_unit') THEN
    ALTER TABLE public.service_packages ADD CONSTRAINT ck_service_packages_unit CHECK (unit IN ('mâm', 'gói'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_service_packages_min_tables') THEN
    ALTER TABLE public.service_packages ADD CONSTRAINT ck_service_packages_min_tables CHECK (min_tables IS NULL OR min_tables >= 1);
  END IF;
END $$;

-- Chuyển dữ liệu cũ: mô tả ghi giá theo mâm/bàn ("…4.500.000đ/mâm", "/ bàn") thì là gói tính theo mâm.
-- Ngày 30/10/2026: đúng 29 gói, đều thuộc hạng mục "Trung tâm tổ chức sự kiện".
UPDATE public.service_packages
SET unit = 'mâm'
WHERE unit = 'gói' AND description ~* '/\s*(mâm|bàn)';

COMMENT ON COLUMN public.service_packages.unit IS 'Đơn vị tính giá: mâm (giá một mâm, chi phí = giá x số mâm) hoặc gói (giá trọn gói)';
COMMENT ON COLUMN public.service_packages.min_tables IS 'Số mâm tối thiểu phải đặt (gói tính theo mâm). NULL: không yêu cầu';

-- 3. plan_vendors: gói khách chọn cho nhà cung cấp trong kế hoạch. NULL: dùng gói dự kiến.
ALTER TABLE public.plan_vendors
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.service_packages (id) ON DELETE SET NULL ON UPDATE NO ACTION;

COMMENT ON COLUMN public.plan_vendors.package_id IS 'Gói khách chọn. NULL: backend tự chọn gói dự kiến theo ngân sách hạng mục';

-- 4. Ngân sách hạng mục khách sửa tay. Ô chưa sửa tay KHÔNG lưu, backend tính lúc đọc.
CREATE TABLE IF NOT EXISTS public.wedding_category_budgets (
  wedding_id    uuid           NOT NULL REFERENCES public.weddings (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  category_id   uuid           NOT NULL REFERENCES public.service_categories (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  manual_amount numeric(18, 2) NOT NULL,
  updated_date  timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT pk_wedding_category_budgets PRIMARY KEY (wedding_id, category_id),
  CONSTRAINT ck_wedding_category_budgets_amount CHECK (manual_amount >= 0)
);

ALTER TABLE public.wedding_category_budgets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wedding_category_budgets IS 'Ngân sách hạng mục do khách sửa tay. Không có dòng: dùng số gợi ý theo giá gói';

-- 5. Chi phí khác ngoài WebPlan
CREATE TABLE IF NOT EXISTS public.wedding_extra_costs (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   uuid           NOT NULL REFERENCES public.weddings (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  name         varchar(100)   NOT NULL,
  amount       numeric(18, 2) NOT NULL,
  created_date timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT ck_wedding_extra_costs_amount CHECK (amount > 0),
  CONSTRAINT ck_wedding_extra_costs_name CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS ix_wedding_extra_costs_wedding ON public.wedding_extra_costs (wedding_id, created_date);

ALTER TABLE public.wedding_extra_costs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wedding_extra_costs IS 'Chi phí khác ngoài WebPlan (tên khoản chi và số tiền)';

COMMIT;

-- Kiểm tra sau khi chạy:
-- SELECT unit, count(*) FROM public.service_packages GROUP BY unit;   -- mâm: 29 (30/10/2026)
-- SELECT spending_tier, count(*) FROM public.weddings GROUP BY 1;     -- toàn bộ AUTO

-- ===== ROLLBACK (chạy khi cần gỡ, theo đúng thứ tự) =====
-- BEGIN;
-- DROP TABLE IF EXISTS public.wedding_extra_costs;
-- DROP TABLE IF EXISTS public.wedding_category_budgets;
-- ALTER TABLE public.plan_vendors DROP COLUMN IF EXISTS package_id;
-- ALTER TABLE public.service_packages DROP CONSTRAINT IF EXISTS ck_service_packages_min_tables;
-- ALTER TABLE public.service_packages DROP CONSTRAINT IF EXISTS ck_service_packages_unit;
-- ALTER TABLE public.service_packages DROP COLUMN IF EXISTS unit;
-- ALTER TABLE public.weddings DROP CONSTRAINT IF EXISTS ck_weddings_table_count_override;
-- ALTER TABLE public.weddings DROP CONSTRAINT IF EXISTS ck_weddings_spending_tier;
-- ALTER TABLE public.weddings DROP COLUMN IF EXISTS table_count_override;
-- ALTER TABLE public.weddings DROP COLUMN IF EXISTS spending_tier;
-- COMMIT;
