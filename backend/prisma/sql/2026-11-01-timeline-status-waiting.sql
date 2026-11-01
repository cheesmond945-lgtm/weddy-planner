-- ĐÃ CHẠY trên Supabase 01/11/2026 — KHÔNG chạy lại
-- Lý do: timeline_tasks_status_check chỉ cho 'Todo','Done'; trạng thái 'Waiting' (Chờ khách) bị DB từ chối khi sinh việc lúc cọc.
-- Kiểm tra: SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'timeline_tasks_status_check';
BEGIN;
ALTER TABLE public.timeline_tasks DROP CONSTRAINT IF EXISTS timeline_tasks_status_check;
ALTER TABLE public.timeline_tasks ADD CONSTRAINT timeline_tasks_status_check
  CHECK (status IN ('Todo', 'Waiting', 'Done'));
COMMIT;
-- Rollback (chỉ khi không còn dòng Waiting): SELECT count(*) FROM timeline_tasks WHERE status = 'Waiting'; rồi đổi lại CHECK (status IN ('Todo','Done')).
