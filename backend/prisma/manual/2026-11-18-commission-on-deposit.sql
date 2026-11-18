-- Hoa hồng tính từ lúc khách cọc và bỏ cọc bổ sung. Đặc tả: docs/api/commissions.md, docs/api/orders.md.
--   * commissions: thêm cột kind (Deposit = trên tiền cọc, tính lúc khách cọc; Final = trên phần còn lại, tính lúc hoàn thành).
--     Một đơn tối đa 2 dòng: bỏ UNIQUE(order_id), thêm UNIQUE(order_id, kind).
--   * order_adjustments: bỏ extra_deposit, transaction_code, paid_date; status chỉ còn AwaitingVendor, Applied, Rejected.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor hoặc `npx prisma db execute --file prisma/manual/<file>` trong backend/).
-- Ứng dụng KHÔNG tự chạy file này. Không dùng prisma migrate / db push. schema.prisma đã được sửa tay cho khớp.
-- Chạy SAU KHI đã deploy code mới (code cũ ghi commissions không có kind và đọc extra_deposit sẽ lỗi), hoặc tắt backend trong lúc chạy.
-- An toàn khi chạy lại. Câu gỡ (rollback) ở cuối file.

BEGIN;

-- 1. commissions.kind ---------------------------------------------------------------------------------------------
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS kind varchar(20) NOT NULL DEFAULT 'Final';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.commissions'::regclass AND conname = 'ck_commissions_kind') THEN
    ALTER TABLE public.commissions ADD CONSTRAINT ck_commissions_kind CHECK (kind IN ('Deposit', 'Final'));
  END IF;
END $$;

-- Dòng cũ của đơn đã hủy tính trên tiền cọc: đó chính là dòng Deposit. Dòng của đơn hoàn thành tính trên tổng đơn: giữ là Final.
UPDATE public.commissions c SET kind = 'Deposit' FROM public.orders o WHERE o.id = c.order_id AND o.status = 'Cancelled' AND c.kind = 'Final';

-- Bỏ UNIQUE(order_id) (dù là constraint hay chỉ là unique index), thêm UNIQUE(order_id, kind)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname FROM pg_constraint con
    WHERE con.conrelid = 'public.commissions'::regclass AND con.contype = 'u'
      AND con.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.commissions'::regclass AND attname = 'order_id')]
  LOOP
    EXECUTE format('ALTER TABLE public.commissions DROP CONSTRAINT %I', r.conname);
  END LOOP;
  FOR r IN
    SELECT i.relname FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
    WHERE x.indrelid = 'public.commissions'::regclass AND x.indisunique AND NOT x.indisprimary AND x.indnatts = 1
      AND x.indkey[0] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.commissions'::regclass AND attname = 'order_id')
  LOOP
    EXECUTE format('DROP INDEX public.%I', r.relname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_commissions_order_kind ON public.commissions (order_id, kind);
CREATE INDEX IF NOT EXISTS ix_commissions_order ON public.commissions (order_id);

-- 2. Bù hoa hồng cọc cho các đơn ĐÃ CỌC (Deposited) mà chưa có dòng nào ----------------------------------------------
-- Vào bảng kê của tháng khách cọc (giờ VN); bảng kê đã Paid thì dồn sang tháng sau (giống addCommission trong code).
DO $$
DECLARE
  o record;
  period date;
  stmt_id uuid;
  stmt_status text;
  rate numeric;
  base numeric;
  touched uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR o IN
    SELECT ord.id, ord.deposit_amount, v.id AS vendor_id, v.category_id, p.paid_date
    FROM public.orders ord
    JOIN public.vendor_profiles v ON v.id = ord.vendor_id
    JOIN public.payments p ON p.order_id = ord.id AND p.status = 'Paid'
    WHERE ord.status = 'Deposited'
      AND NOT EXISTS (SELECT 1 FROM public.commissions c WHERE c.order_id = ord.id)
  LOOP
    SELECT commission_rate INTO rate FROM public.service_categories WHERE id = o.category_id;
    IF rate IS NULL THEN CONTINUE; END IF;
    base := o.deposit_amount;
    period := date_trunc('month', o.paid_date AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
    LOOP
      SELECT id, status INTO stmt_id, stmt_status FROM public.commission_statements WHERE vendor_id = o.vendor_id AND period_month = period;
      EXIT WHEN stmt_status IS DISTINCT FROM 'Paid';
      period := (period + interval '1 month')::date;
    END LOOP;
    IF stmt_id IS NULL THEN
      INSERT INTO public.commission_statements (vendor_id, period_month, due_date, total_orders, total_amount, status)
      VALUES (o.vendor_id, period, (period + interval '1 month' + interval '24 days')::date, 0, 0, 'Unpaid')
      RETURNING id INTO stmt_id;
    END IF;
    INSERT INTO public.commissions (order_id, statement_id, order_amount, rate, amount, kind, created_date)
    VALUES (o.id, stmt_id, base, rate, round(base * rate / 100), 'Deposit', o.paid_date);
    touched := touched || stmt_id;
  END LOOP;

  -- Tính lại tổng của các bảng kê vừa thêm dòng (chỉ bảng kê chưa Paid): số đơn khác nhau và tổng hoa hồng
  UPDATE public.commission_statements s
  SET total_orders = x.n, total_amount = x.total
  FROM (SELECT statement_id, count(DISTINCT order_id) AS n, sum(amount) AS total FROM public.commissions WHERE statement_id = ANY (touched) GROUP BY statement_id) x
  WHERE s.id = x.statement_id AND s.status IS DISTINCT FROM 'Paid';
END $$;

COMMENT ON COLUMN public.commissions.kind IS 'Deposit: hoa hồng trên tiền cọc (ghi nhận lúc khách cọc); Final: hoa hồng trên phần còn lại của tổng đơn (ghi nhận lúc hoàn thành). Một đơn tối đa 2 dòng';

-- 3. order_adjustments: bỏ cọc bổ sung ------------------------------------------------------------------------------
-- Yêu cầu đang chờ nộp cọc bổ sung không còn đường xử lý: từ chối (khách gửi lại nếu cần)
UPDATE public.order_adjustments SET status = 'Rejected', decided_date = COALESCE(decided_date, now()) WHERE status = 'AwaitingDeposit';

DROP INDEX IF EXISTS public.ux_order_adjustments_open;
ALTER TABLE public.order_adjustments DROP CONSTRAINT IF EXISTS order_adjustments_status_check;
ALTER TABLE public.order_adjustments
  DROP COLUMN IF EXISTS extra_deposit,
  DROP COLUMN IF EXISTS transaction_code,
  DROP COLUMN IF EXISTS paid_date;
ALTER TABLE public.order_adjustments ADD CONSTRAINT order_adjustments_status_check CHECK (status IN ('AwaitingVendor', 'Applied', 'Rejected'));
-- Mỗi đơn chỉ có một yêu cầu đang chờ
CREATE UNIQUE INDEX ux_order_adjustments_open ON public.order_adjustments (order_id) WHERE status = 'AwaitingVendor';

COMMENT ON TABLE public.order_adjustments IS 'Yêu cầu đổi số khách của đơn tiệc đã cọc: giá trị mới = đơn giá lúc đặt × max(số bàn mới, số bàn tối thiểu). Không có cọc bổ sung, tiền cọc giữ nguyên';

COMMIT;

-- ROLLBACK (chạy tay nếu cần gỡ; dữ liệu cọc bổ sung đã xóa không khôi phục được):
-- DROP INDEX IF EXISTS public.ux_commissions_order_kind;
-- DELETE FROM public.commissions WHERE kind = 'Deposit' AND order_id IN (SELECT order_id FROM public.commissions WHERE kind = 'Final');
-- ALTER TABLE public.commissions DROP COLUMN IF EXISTS kind;
-- CREATE UNIQUE INDEX commissions_order_id_key ON public.commissions (order_id);
-- ALTER TABLE public.order_adjustments ADD COLUMN extra_deposit numeric(18,2) NOT NULL DEFAULT 0, ADD COLUMN transaction_code varchar(100) UNIQUE, ADD COLUMN paid_date timestamptz;
