-- Đổi số khách khi tiệc đã cọc (yêu cầu điều chỉnh đơn) và khách yêu cầu hủy đơn đã cọc. Đặc tả: docs/api/orders.md.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor hoặc `npx prisma db execute --file prisma/manual/<file>` trong backend/).
-- Ứng dụng KHÔNG tự chạy file này. Không dùng prisma migrate / db push. schema.prisma đã được sửa tay cho khớp.
-- An toàn khi chạy lại (IF NOT EXISTS). Câu gỡ (rollback) ở cuối file.

BEGIN;

-- Số khách của đơn tiệc (cập nhật khi yêu cầu đổi số khách được áp dụng); NULL với đơn cũ / dịch vụ khác
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_count integer,
  -- Khách yêu cầu hủy đơn đã cọc (chờ NCC xác nhận); NULL là không có yêu cầu
  ADD COLUMN IF NOT EXISTS cancel_requested_date timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_request_note text;

CREATE TABLE IF NOT EXISTS public.order_adjustments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_guest_count  integer,
  new_guest_count  integer NOT NULL CHECK (new_guest_count > 0),
  old_tables       integer NOT NULL CHECK (old_tables > 0),
  new_tables       integer NOT NULL CHECK (new_tables > 0),
  -- Đơn giá/bàn lúc đặt (giữ nguyên khi điều chỉnh)
  unit_price       numeric(18, 2) NOT NULL CHECK (unit_price >= 0),
  old_amount       numeric(18, 2) NOT NULL,
  new_amount       numeric(18, 2) NOT NULL,
  -- Cọc bổ sung = 10% phần tăng; giảm khách thì 0 (không hoàn cọc)
  extra_deposit    numeric(18, 2) NOT NULL DEFAULT 0 CHECK (extra_deposit >= 0),
  -- AwaitingVendor (Chờ NCC xác nhận), AwaitingDeposit (Chờ nộp cọc bổ sung), Applied (Đã áp dụng), Rejected (Bị từ chối)
  status           varchar(20) NOT NULL DEFAULT 'AwaitingVendor' CHECK (status IN ('AwaitingVendor', 'AwaitingDeposit', 'Applied', 'Rejected')),
  note             text,
  transaction_code varchar(100) UNIQUE,
  paid_date        timestamptz,
  created_date     timestamptz NOT NULL DEFAULT now(),
  decided_date     timestamptz,
  applied_date     timestamptz
);

CREATE INDEX IF NOT EXISTS ix_order_adjustments_order ON public.order_adjustments (order_id, created_date DESC);
-- Mỗi đơn chỉ có một yêu cầu đang chờ
CREATE UNIQUE INDEX IF NOT EXISTS ux_order_adjustments_open ON public.order_adjustments (order_id) WHERE status IN ('AwaitingVendor', 'AwaitingDeposit');

ALTER TABLE public.order_adjustments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.order_adjustments IS 'Yêu cầu đổi số khách của đơn tiệc đã cọc: giá trị mới = đơn giá lúc đặt × max(số bàn mới, số bàn tối thiểu); cọc bổ sung 10% phần tăng';
COMMENT ON COLUMN public.orders.guest_count IS 'Số khách của đơn tiệc (cập nhật khi đổi số khách được áp dụng)';
COMMENT ON COLUMN public.orders.cancel_requested_date IS 'Khách yêu cầu hủy đơn đã cọc, chờ NCC xác nhận (NULL: không có yêu cầu)';

COMMIT;

-- ROLLBACK (chạy tay nếu cần gỡ):
-- DROP TABLE IF EXISTS public.order_adjustments;
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS guest_count, DROP COLUMN IF EXISTS cancel_requested_date, DROP COLUMN IF EXISTS cancel_request_note;
