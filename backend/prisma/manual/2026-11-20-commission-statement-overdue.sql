-- Thêm trạng thái "Overdue" (quá hạn) cho bảng kê hoa hồng: commission_statements.status = Unpaid | Paid | Overdue.
--   * Unpaid: chưa nộp, chưa tới hạn (hạn nộp là ngày 25 tháng sau).
--   * Overdue: chưa nộp và đã quá hạn. Backend (CommissionRemindersService) tự chuyển Unpaid -> Overdue mỗi giờ khi qua ngày hạn;
--     chỉ áp cho bảng kê có hoa hồng > 0. Khi NCC hoặc Admin ghi nhận thanh toán thì Overdue -> Paid.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor hoặc `npx prisma db execute --file prisma/manual/<file>` trong backend/).
-- Ứng dụng KHÔNG tự chạy file này. Không dùng prisma migrate / db push. schema.prisma không đổi (cột vẫn là varchar).
-- Chạy SAU KHI đã deploy code mới (code cũ chỉ nhận Unpaid khi ghi nhận thanh toán), hoặc tắt backend trong lúc chạy.
-- An toàn khi chạy lại. Câu gỡ (rollback) ở cuối file.

BEGIN;

ALTER TABLE public.commission_statements DROP CONSTRAINT IF EXISTS commission_statements_status_check;
ALTER TABLE public.commission_statements
  ADD CONSTRAINT commission_statements_status_check CHECK (status IN ('Unpaid', 'Paid', 'Overdue'));

-- Bảng kê đã quá hạn từ trước (giờ Việt Nam) chuyển sang Overdue
UPDATE public.commission_statements
SET status = 'Overdue'
WHERE status = 'Unpaid'
  AND total_amount > 0
  AND due_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

COMMENT ON COLUMN public.commission_statements.status IS 'Unpaid: chưa nộp; Overdue: chưa nộp và đã quá hạn (ngày 25 tháng sau); Paid: đã nộp';

COMMIT;

-- ROLLBACK (chạy tay nếu cần gỡ):
-- UPDATE public.commission_statements SET status = 'Unpaid' WHERE status = 'Overdue';
-- ALTER TABLE public.commission_statements DROP CONSTRAINT IF EXISTS commission_statements_status_check;
-- ALTER TABLE public.commission_statements ADD CONSTRAINT commission_statements_status_check CHECK (status IN ('Unpaid', 'Paid'));
