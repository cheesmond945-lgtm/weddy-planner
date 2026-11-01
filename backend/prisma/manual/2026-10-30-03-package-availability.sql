-- Lịch khả dụng theo từng gói của Trung tâm tiệc cưới. Đặc tả: docs/api/availability.md.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor hoặc `npx prisma db execute --file prisma/manual/<file>` trong backend/).
-- Ứng dụng KHÔNG tự chạy file này. schema.prisma đã được sửa tay cho khớp. Chưa chạy thì backend khóa phần lịch khả dụng (503).
-- An toàn khi chạy lại (IF NOT EXISTS). Chỉ thêm bảng mới. Câu gỡ (rollback) ở cuối file.
-- Không lưu tên khách, đơn hay thông tin cá nhân: mỗi dòng chỉ có gói, ngày và trạng thái.

BEGIN;

CREATE TABLE IF NOT EXISTS public.package_availability (
  package_id   uuid        NOT NULL REFERENCES public.service_packages (id) ON DELETE CASCADE ON UPDATE NO ACTION,
  date         date        NOT NULL,
  status       varchar(20) NOT NULL,
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_package_availability PRIMARY KEY (package_id, date),
  CONSTRAINT ck_package_availability_status CHECK (status IN ('Available', 'Held', 'Booked'))
);

CREATE INDEX IF NOT EXISTS ix_package_availability_date ON public.package_availability (date);

ALTER TABLE public.package_availability ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.package_availability IS 'Trạng thái lịch của một gói theo ngày do NCC cập nhật. Không có dòng = Chưa cập nhật';
COMMENT ON COLUMN public.package_availability.status IS 'Available (còn trống), Held (giữ chỗ), Booked (đã kín)';

CREATE TABLE IF NOT EXISTS public.package_resources (
  package_id    uuid         PRIMARY KEY REFERENCES public.service_packages (id) ON DELETE CASCADE ON UPDATE NO ACTION,
  resource_name varchar(100) NOT NULL,
  updated_date  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.package_resources ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.package_resources IS 'Sảnh hoặc nguồn lực tổ chức mà gói dùng. Các gói cùng NCC cùng tên sảnh dùng chung lịch: một gói kín hoặc giữ chỗ thì gói kia cũng không còn trống ngày đó';

COMMIT;

-- ===== ROLLBACK =====
-- BEGIN;
-- DROP TABLE IF EXISTS public.package_resources;
-- DROP TABLE IF EXISTS public.package_availability;
-- COMMIT;
