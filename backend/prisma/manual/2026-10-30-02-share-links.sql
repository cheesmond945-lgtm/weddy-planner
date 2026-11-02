-- Link xem kế hoạch công khai (chỉ đọc, người xem không cần đăng nhập). Kế hoạch: docs/KE_HOACH_KE_HOACH_CUA_TOI.md GĐ 5 (P7), docs/api/sharing.md.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor hoặc `npx prisma db execute --file prisma/manual/<file>` trong backend/).
-- Ứng dụng KHÔNG tự chạy file này. schema.prisma đã được sửa tay cho khớp. Chưa chạy thì backend khóa phần chia sẻ (503).
-- An toàn khi chạy lại (IF NOT EXISTS). Chỉ thêm bảng mới (đã bỏ bảng lời mời wedding_invites 02/11/2026). Câu gỡ (rollback) ở cuối file.
-- Mã trong link KHÔNG lưu trong DB: backend sinh mã bằng HMAC(khóa bí mật, id dòng) và chỉ lưu SHA-256 của mã để tra cứu.

BEGIN;

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
-- COMMIT;
