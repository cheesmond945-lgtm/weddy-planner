-- ĐÃ CHẠY trên Supabase (nhóm đã duyệt) — KHÔNG chạy lại
-- Việc chi tiết do NCC khai theo từng gói dịch vụ (thay việc chi tiết sinh từ mẫu trong code).
-- Chạy THỦ CÔNG trên Supabase (SQL Editor) sau khi báo nhóm. KHÔNG dùng prisma migrate / db push.
-- Chỉ CREATE bảng mới, không ALTER / DROP / UPDATE / DELETE bảng có sẵn. Chạy lại nhiều lần không lỗi.
-- gen_random_uuid() có sẵn trong Postgres 13+ / Supabase (các bảng hiện có đã dùng), không cần thêm extension.
-- Kiểu id: service_packages.id và timeline_tasks.id đều là uuid (schema.prisma) nên FK khớp.

-- a) KIỂM TRA (chỉ SELECT): order_items.package_id có trên CSDL thật không (schema.prisma có, chưa xác minh)
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'package_id';

BEGIN;

-- b) Việc NCC khai theo gói. offset_days so với ngày thực hiện E của đơn: âm = trước, 0 = đúng ngày, dương = sau.
CREATE TABLE IF NOT EXISTS public.package_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id   uuid NOT NULL REFERENCES public.service_packages (id) ON DELETE CASCADE,
  sort_order   int NOT NULL DEFAULT 0,
  title        varchar(255) NOT NULL,
  note         varchar(500) NULL,            -- ghi chú cho người làm
  owner        varchar(10) NOT NULL CHECK (owner IN ('CUSTOMER','VENDOR','BOTH')),
  offset_days  int NOT NULL,
  deleted_at   timestamptz NULL,             -- xóa mềm
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_package_tasks_package ON public.package_tasks (package_id, sort_order) WHERE deleted_at IS NULL;

-- c) Ngày chốt của một việc trong timeline (NCC / khách xác nhận ngày làm thực tế)
CREATE TABLE IF NOT EXISTS public.task_confirmations (
  task_id        uuid PRIMARY KEY REFERENCES public.timeline_tasks (id) ON DELETE CASCADE,
  confirmed_date date NOT NULL,
  confirmed_by   uuid NULL,
  confirmed_at   timestamptz NOT NULL DEFAULT now()
);

-- Như các bảng khác: bật RLS, không có policy (chỉ backend dùng tài khoản postgres truy cập)
ALTER TABLE public.package_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_confirmations ENABLE ROW LEVEL SECURITY;

COMMIT;

-- d) ROLLBACK (không chạy, theo thứ tự):
-- DROP TABLE task_confirmations;
-- DROP TABLE package_tasks;
