-- Phân công, ghi chú và người hoàn thành cho việc trong timeline. Kế hoạch: docs/KE_HOACH_KE_HOACH_CUA_TOI.md, GĐ 3 (P4).
-- Chạy THỦ CÔNG trên Supabase (SQL Editor) sau khi báo nhóm. KHÔNG dùng prisma migrate / db push.
-- Chạy xong: npm run db:pull && npm run db:generate (trong backend/).
-- An toàn khi chạy lại (IF NOT EXISTS). Chỉ thêm cột cho phép rỗng, việc cũ giữ nguyên (chưa giao, chưa có ghi chú).

BEGIN;

ALTER TABLE public.timeline_tasks
  ADD COLUMN IF NOT EXISTS assignee         varchar(20),
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES public.users (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD COLUMN IF NOT EXISTS note             varchar(200),
  ADD COLUMN IF NOT EXISTS note_by          uuid REFERENCES public.users (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD COLUMN IF NOT EXISTS note_date        timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by     uuid REFERENCES public.users (id) ON DELETE NO ACTION ON UPDATE NO ACTION;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_timeline_tasks_assignee') THEN
    -- Member (một người thân cụ thể) thì phải có assignee_user_id; các giá trị khác thì không
    ALTER TABLE public.timeline_tasks ADD CONSTRAINT ck_timeline_tasks_assignee CHECK (
      (assignee IS NULL AND assignee_user_id IS NULL)
      OR (assignee IN ('Bride', 'Groom', 'Both') AND assignee_user_id IS NULL)
      OR (assignee = 'Member' AND assignee_user_id IS NOT NULL)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_timeline_assignee_user ON public.timeline_tasks (assignee_user_id) WHERE assignee_user_id IS NOT NULL;

COMMENT ON COLUMN public.timeline_tasks.assignee IS 'Người phụ trách: Bride (cô dâu), Groom (chú rể), Both (cả hai), Member (người thân, xem assignee_user_id). NULL: chưa giao';
COMMENT ON COLUMN public.timeline_tasks.assignee_user_id IS 'Thành viên được giao khi assignee = Member';
COMMENT ON COLUMN public.timeline_tasks.note IS 'Ghi chú của việc (tối đa 200 ký tự), thành viên cùng lập kế hoạch đều thấy, link công khai thì không';
COMMENT ON COLUMN public.timeline_tasks.note_by IS 'Người viết ghi chú gần nhất';
COMMENT ON COLUMN public.timeline_tasks.note_date IS 'Lúc sửa ghi chú gần nhất';
COMMENT ON COLUMN public.timeline_tasks.completed_by IS 'Người đánh dấu xong ("Xong bởi ..."). NULL khi tự xong (mốc Chốt) hoặc việc cũ';

COMMIT;
