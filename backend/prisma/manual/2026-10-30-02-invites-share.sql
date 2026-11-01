-- Lời mời cùng lập kế hoạch và link xem công khai. Kế hoạch: docs/KE_HOACH_KE_HOACH_CUA_TOI.md GĐ 5 (P7), docs/api/sharing.md.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor hoặc `npx prisma db execute --file prisma/manual/<file>` trong backend/).
-- Ứng dụng KHÔNG tự chạy file này. schema.prisma đã được sửa tay cho khớp. Chưa chạy thì backend khóa phần chia sẻ (503).
-- An toàn khi chạy lại (IF NOT EXISTS). Chỉ thêm bảng mới. Câu gỡ (rollback) ở cuối file.
-- Mã trong link KHÔNG lưu trong DB: backend sinh mã bằng HMAC(khóa bí mật, id dòng) và chỉ lưu SHA-256 của mã để tra cứu.

BEGIN;

CREATE TABLE IF NOT EXISTS public.wedding_invites (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   uuid        NOT NULL REFERENCES public.weddings (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  token_hash   char(64)    NOT NULL,
  role         varchar(20) NOT NULL,
  relation     varchar(20) NOT NULL,
  display_name varchar(40),
  tabs         text[]      NOT NULL,
  created_by   uuid        NOT NULL REFERENCES public.users (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  expires_date timestamptz NOT NULL,
  used_by      uuid        REFERENCES public.users (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  used_date    timestamptz,
  revoked_date timestamptz,
  created_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_wedding_invites_token UNIQUE (token_hash),
  CONSTRAINT ck_wedding_invites_role CHECK (role IN ('Editor', 'Viewer')),
  CONSTRAINT ck_wedding_invites_relation CHECK (relation IN ('Bride', 'Groom', 'Relative')),
  CONSTRAINT ck_wedding_invites_tabs CHECK (tabs <@ ARRAY['overview', 'timeline', 'services', 'budget', 'guests']::text[] AND cardinality(tabs) >= 1),
  CONSTRAINT ck_wedding_invites_used CHECK ((used_by IS NULL) = (used_date IS NULL))
);

CREATE INDEX IF NOT EXISTS ix_wedding_invites_wedding ON public.wedding_invites (wedding_id, created_date);

ALTER TABLE public.wedding_invites ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wedding_invites IS 'Link mời cùng lập kế hoạch. Còn hiệu lực khi chưa dùng, chưa thu hồi, chưa hết hạn. Tối đa 10 link chờ mỗi đám cưới (backend kiểm tra)';
COMMENT ON COLUMN public.wedding_invites.token_hash IS 'SHA-256 (hex) của mã trong link. Mã không lưu trong DB';
COMMENT ON COLUMN public.wedding_invites.tabs IS 'Subtab người được mời sẽ xem được, ít nhất 1';

CREATE TABLE IF NOT EXISTS public.wedding_share_links (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   uuid        NOT NULL REFERENCES public.weddings (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  token_hash   char(64)    NOT NULL,
  is_enabled   boolean     NOT NULL DEFAULT false,
  tabs         text[]      NOT NULL DEFAULT ARRAY['overview', 'timeline', 'services']::text[],
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_wedding_share_links_wedding UNIQUE (wedding_id),
  CONSTRAINT uq_wedding_share_links_token UNIQUE (token_hash),
  CONSTRAINT ck_wedding_share_links_tabs CHECK (tabs <@ ARRAY['overview', 'timeline', 'services', 'budget', 'guests']::text[] AND cardinality(tabs) >= 1)
);

ALTER TABLE public.wedding_share_links ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wedding_share_links IS 'Link xem kế hoạch công khai (chỉ đọc), mỗi đám cưới tối đa một link. Tạo lại link thì xóa dòng cũ, link cũ hết hiệu lực';
COMMENT ON COLUMN public.wedding_share_links.tabs IS 'Subtab người xem công khai được xem, ít nhất 1';

COMMIT;

-- ===== ROLLBACK =====
-- BEGIN;
-- DROP TABLE IF EXISTS public.wedding_share_links;
-- DROP TABLE IF EXISTS public.wedding_invites;
-- COMMIT;
