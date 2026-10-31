-- Lịch bận theo sảnh (gói dịch vụ) của Trung tâm tổ chức sự kiện (docs/LICH_BAN_SANH.md).
-- Chạy THỦ CÔNG trên Supabase (SQL Editor) sau khi báo nhóm. KHÔNG dùng prisma migrate / db push.
-- Chỉ thêm (cột, bảng, chỉ mục), không sửa dữ liệu cũ. Chạy lại nhiều lần không lỗi.
-- ĐÃ CHẠY 31/10/2026 (nhóm đồng ý). Sau khi chạy: schema.prisma đã có orders.package_id và model package_busy_dates.

BEGIN;

-- 1. Đơn thuộc sảnh nào. NULL: đơn cũ, hoặc dịch vụ không theo sảnh (5 danh mục còn lại).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS package_id uuid NULL REFERENCES public.service_packages (id) ON DELETE SET NULL;
COMMENT ON COLUMN public.orders.package_id IS 'Gói / sảnh của đơn (Trung tâm tổ chức sự kiện): sảnh bận vào event_date khi đơn Deposited hoặc Completed';
CREATE INDEX IF NOT EXISTS ix_orders_package_date ON public.orders (package_id, event_date) WHERE package_id IS NOT NULL;

-- 2. Chống đặt trùng ở mức CSDL: một sảnh chỉ một đơn Đã cọc / Hoàn thành mỗi ngày (hai khách cọc cùng lúc).
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_package_busy ON public.orders (package_id, event_date)
  WHERE package_id IS NOT NULL AND status IN ('Deposited', 'Completed');

-- 3. Ngày bận thủ công của sảnh (bảo trì, nghỉ, lý do riêng…): một dòng mỗi lần NCC đánh dấu, từ ngày đến ngày.
CREATE TABLE IF NOT EXISTS public.package_busy_dates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id   uuid NOT NULL REFERENCES public.service_packages (id) ON DELETE CASCADE,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  reason       varchar(255) NOT NULL,
  created_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_package_busy_dates_range CHECK (end_date >= start_date AND end_date - start_date <= 366),
  CONSTRAINT ck_package_busy_dates_reason CHECK (length(btrim(reason)) > 0)
);
COMMENT ON TABLE public.package_busy_dates IS 'Ngày bận NCC tự đánh dấu cho một sảnh (Trung tâm tổ chức sự kiện); ngày bận từ đơn lấy từ orders';
CREATE INDEX IF NOT EXISTS ix_package_busy_dates_package ON public.package_busy_dates (package_id, start_date, end_date);
-- Như các bảng khác: bật RLS, không có policy (chỉ backend dùng tài khoản postgres truy cập)
ALTER TABLE public.package_busy_dates ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Gỡ (nếu cần, theo thứ tự):
-- DROP TABLE IF EXISTS public.package_busy_dates;
-- DROP INDEX IF EXISTS public.ux_orders_package_busy;
-- DROP INDEX IF EXISTS public.ix_orders_package_date;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS package_id;
