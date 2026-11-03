-- Thành viên cùng lập kế hoạch đám cưới (owner, editor, viewer). Kế hoạch: docs/KE_HOACH_KE_HOACH_CUA_TOI.md, GĐ 2.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor) sau khi báo nhóm. KHÔNG dùng prisma migrate / db push.
-- Chạy xong: npm run db:pull && npm run db:generate (trong backend/).
-- An toàn khi chạy lại (IF NOT EXISTS, ON CONFLICT) và giữ dữ liệu cũ: mỗi đám cưới đang có thành owner của chính nó.
-- Không đổi bảng weddings: weddings.user_id vẫn là owner, hội thoại và đơn hàng tiếp tục gắn với owner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.wedding_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   uuid        NOT NULL REFERENCES public.weddings (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  user_id      uuid        NOT NULL REFERENCES public.users (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  role         varchar(20) NOT NULL,
  relation     varchar(20),
  display_name varchar(40),
  -- Subtab được xem: overview, timeline, services, budget, guests. NULL = tất cả (owner luôn NULL)
  tabs         text[],
  joined_date  timestamptz NOT NULL DEFAULT now(),
  -- Phiên bản này: mỗi tài khoản chỉ thuộc một đám cưới
  CONSTRAINT uq_wedding_members_user UNIQUE (user_id),
  CONSTRAINT uq_wedding_members_wedding_user UNIQUE (wedding_id, user_id),
  CONSTRAINT ck_wedding_members_role CHECK (role IN ('Owner', 'Editor', 'Viewer')),
  CONSTRAINT ck_wedding_members_relation CHECK (relation IS NULL OR relation IN ('Bride', 'Groom', 'Relative')),
  -- Tab nào cũng tắt được, miễn còn ít nhất 1 tab; owner không bị giới hạn tab
  CONSTRAINT ck_wedding_members_tabs CHECK (
    tabs IS NULL
    OR (tabs <@ ARRAY['overview', 'timeline', 'services', 'budget', 'guests']::text[] AND cardinality(tabs) >= 1 AND role <> 'Owner')
  )
);

-- Mỗi đám cưới có đúng một owner
CREATE UNIQUE INDEX IF NOT EXISTS uq_wedding_members_owner ON public.wedding_members (wedding_id) WHERE role = 'Owner';

-- Dữ liệu cũ: người tạo đám cưới thành owner
INSERT INTO public.wedding_members (wedding_id, user_id, role, joined_date)
SELECT w.id, w.user_id, 'Owner', w.created_date
FROM public.weddings w
ON CONFLICT (user_id) DO NOTHING;

-- Như các bảng riêng tư khác: bật RLS, không policy (chỉ backend truy cập)
ALTER TABLE public.wedding_members ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wedding_members IS 'Người cùng lập kế hoạch đám cưới. Mỗi tài khoản thuộc tối đa một đám cưới.';
COMMENT ON COLUMN public.wedding_members.role IS 'Owner: toàn quyền; Editor: sửa timeline, ngân sách, khách, kế hoạch, chat và đặt cọc, không quản lý thành viên hay chia sẻ; Viewer: chỉ xem, không xem chat';
COMMENT ON COLUMN public.wedding_members.relation IS 'Quan hệ khi được mời: Bride (cô dâu), Groom (chú rể), Relative (người thân). Owner tạo đám cưới thì để trống';
COMMENT ON COLUMN public.wedding_members.display_name IS 'Tên hiển thị do owner đặt khi mời, ví dụ "Mẹ cô dâu"';
COMMENT ON COLUMN public.wedding_members.tabs IS 'Subtab của Kế hoạch mà thành viên được xem, ít nhất 1 tab. NULL: xem tất cả. Backend chặn API của tab không được xem';

COMMIT;

-- Kiểm tra sau khi chạy (số owner phải bằng số đám cưới):
-- SELECT (SELECT count(*) FROM public.weddings) AS weddings,
--        (SELECT count(*) FROM public.wedding_members WHERE role = 'Owner') AS owners;
