-- Lịch trình ngày cưới theo giờ (docs/LICH_TRINH_NGAY_CUOI.md): giờ chính của đám cưới, thời gian NCC cần trong ngày cưới,
-- giờ sảnh cho đơn vị khác vào setup, giờ có mặt NCC đã chốt cho từng đơn.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor) sau khi báo nhóm. KHÔNG dùng prisma migrate / db push.
-- Chỉ thêm cột (đều cho phép NULL), không sửa dữ liệu cũ. Chạy lại nhiều lần không lỗi.
-- ĐÃ CHẠY 02/11/2026 (nhóm đồng ý). Sau khi chạy: schema.prisma đã có các cột dưới.

BEGIN;

-- 1. Giờ chính của ngày cưới (giờ đón khách / làm lễ), giờ Việt Nam. NULL: khách chưa nhập, chưa xếp được giờ có mặt.
ALTER TABLE public.weddings ADD COLUMN IF NOT EXISTS main_time time NULL;
COMMENT ON COLUMN public.weddings.main_time IS 'Giờ chính của ngày cưới (đón khách / làm lễ), giờ VN; mốc để xếp giờ có mặt của các NCC';

-- 2. Thời gian NCC cần trong ngày cưới, khai theo gói (lưu không cần Admin duyệt, như việc của gói).
--    NULL: chưa khai, hệ thống dùng mặc định theo lĩnh vực.
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS dayof_lead_minutes integer NULL;
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS dayof_duration_minutes integer NULL;
-- Chỉ sảnh (Nhà hàng / Trung tâm tổ chức sự kiện): giờ sớm nhất đơn vị khác (decor, hoa...) được vào sảnh setup trong ngày cưới.
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS setup_open_time time NULL;
COMMENT ON COLUMN public.service_packages.dayof_lead_minutes IS 'Ngày cưới: NCC có mặt trước giờ chính bao nhiêu phút (0..1440)';
COMMENT ON COLUMN public.service_packages.dayof_duration_minutes IS 'Ngày cưới: NCC làm trong bao nhiêu phút kể từ lúc có mặt (15..1440)';
COMMENT ON COLUMN public.service_packages.setup_open_time IS 'Sảnh: giờ sớm nhất đơn vị khác được vào setup trong ngày cưới, giờ VN';
DO $$ BEGIN
  ALTER TABLE public.service_packages ADD CONSTRAINT ck_service_packages_dayof_lead CHECK (dayof_lead_minutes IS NULL OR dayof_lead_minutes BETWEEN 0 AND 1440);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.service_packages ADD CONSTRAINT ck_service_packages_dayof_duration CHECK (dayof_duration_minutes IS NULL OR dayof_duration_minutes BETWEEN 15 AND 1440);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Giờ có mặt NCC đã chốt cho đơn (có thể từ tối hôm trước). Cả ba NULL: chưa chốt, giờ dự kiến tính từ giờ chính và gói.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dayof_start_at timestamptz NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dayof_end_at timestamptz NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dayof_confirmed_at timestamptz NULL;
COMMENT ON COLUMN public.orders.dayof_start_at IS 'Ngày cưới: giờ NCC có mặt đã chốt với khách';
COMMENT ON COLUMN public.orders.dayof_end_at IS 'Ngày cưới: giờ NCC xong việc đã chốt với khách';
COMMENT ON COLUMN public.orders.dayof_confirmed_at IS 'Lúc NCC chốt giờ có mặt; NULL là chưa chốt';
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT ck_orders_dayof_range CHECK (dayof_start_at IS NULL OR dayof_end_at IS NULL OR dayof_end_at > dayof_start_at);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

-- Gỡ (nếu cần):
-- ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS ck_orders_dayof_range;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS dayof_confirmed_at, DROP COLUMN IF EXISTS dayof_end_at, DROP COLUMN IF EXISTS dayof_start_at;
-- ALTER TABLE public.service_packages DROP CONSTRAINT IF EXISTS ck_service_packages_dayof_duration, DROP CONSTRAINT IF EXISTS ck_service_packages_dayof_lead;
-- ALTER TABLE public.service_packages DROP COLUMN IF EXISTS setup_open_time, DROP COLUMN IF EXISTS dayof_duration_minutes, DROP COLUMN IF EXISTS dayof_lead_minutes;
-- ALTER TABLE public.weddings DROP COLUMN IF EXISTS main_time;
