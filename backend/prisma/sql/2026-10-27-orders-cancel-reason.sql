-- LƯU Ý (27/10/2026): cột cancel_note ĐÃ BỊ BỎ theo quyết định của nhóm (Chika đã xóa khỏi DB). Chỉ còn cancel_reason.
-- Các lệnh liên quan cancel_note bên dưới đã được comment, KHÔNG chạy lại để thêm cột này. Ghi chú khi hủy chỉ nằm trong tin hệ thống trong chat.
-- Thêm lý do hủy cho đơn hàng (NCC hủy đơn đã cọc, trước ngày sự kiện).
-- Chạy THỦ CÔNG trên Supabase (SQL Editor) sau khi báo nhóm. KHÔNG dùng prisma migrate / db push.
-- An toàn khi chạy lại (IF NOT EXISTS) và không đổi dữ liệu cũ: hai cột mới cho phép rỗng.

BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_reason varchar(20);
-- ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_note text;  -- đã bỏ

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_orders_cancel_reason') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT ck_orders_cancel_reason
      CHECK (cancel_reason IS NULL OR cancel_reason IN ('CUSTOMER_REQUEST', 'VENDOR_UNABLE'));
  END IF;
END $$;

COMMENT ON COLUMN public.orders.cancel_reason IS 'Lý do NCC hủy đơn: CUSTOMER_REQUEST (khách yêu cầu hủy, khách mất cọc) hoặc VENDOR_UNABLE (NCC không thể thực hiện, NCC hoàn cọc ngoài hệ thống)';
-- COMMENT ON COLUMN public.orders.cancel_note IS 'Ghi chú tùy chọn khi hủy đơn';  -- đã bỏ

COMMIT;

-- Kiểm tra sau khi chạy:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'cancel_reason';
