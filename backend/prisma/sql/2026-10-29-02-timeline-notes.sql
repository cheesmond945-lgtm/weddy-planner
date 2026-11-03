-- Ghi chú cho việc trong timeline (không ghi ai viết, ai làm: bỏ giao việc 01/11/2026, bỏ người viết và người hoàn thành 02/11/2026). Kế hoạch: docs/KE_HOACH_KE_HOACH_CUA_TOI.md, GĐ 3 (P4).
-- Chạy THỦ CÔNG trên Supabase (SQL Editor) sau khi báo nhóm. KHÔNG dùng prisma migrate / db push.
-- Chạy xong: npm run db:pull && npm run db:generate (trong backend/).
-- An toàn khi chạy lại (IF NOT EXISTS). Chỉ thêm cột cho phép rỗng, việc cũ giữ nguyên (chưa có ghi chú).

BEGIN;

ALTER TABLE public.timeline_tasks
  ADD COLUMN IF NOT EXISTS note varchar(200);

COMMENT ON COLUMN public.timeline_tasks.note IS 'Ghi chú của việc (tối đa 200 ký tự), link xem công khai thì không hiện';

COMMIT;
