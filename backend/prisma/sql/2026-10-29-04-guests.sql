-- Danh sách khách mời. Kế hoạch: docs/KE_HOACH_KE_HOACH_CUA_TOI.md, GĐ 3 (P5).
-- Chạy THỦ CÔNG trên Supabase (SQL Editor) sau khi báo nhóm. KHÔNG dùng prisma migrate / db push.
-- Chạy xong: npm run db:pull && npm run db:generate (trong backend/).
-- An toàn khi chạy lại (IF NOT EXISTS). Bảng mới, không đụng dữ liệu cũ.

BEGIN;

CREATE TABLE IF NOT EXISTS public.wedding_guests (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id   uuid         NOT NULL REFERENCES public.weddings (id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  full_name    varchar(100) NOT NULL,
  side         varchar(20)  NOT NULL,
  group_name   varchar(30)  NOT NULL DEFAULT 'Khác',
  party_size   integer      NOT NULL DEFAULT 1,
  is_invited   boolean      NOT NULL DEFAULT false,
  rsvp_status  varchar(20)  NOT NULL DEFAULT 'Pending',
  created_date timestamptz  NOT NULL DEFAULT now(),
  updated_date timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ck_wedding_guests_name CHECK (length(btrim(full_name)) > 0),
  CONSTRAINT ck_wedding_guests_side CHECK (side IN ('Bride', 'Groom')),
  CONSTRAINT ck_wedding_guests_party CHECK (party_size BETWEEN 1 AND 50),
  CONSTRAINT ck_wedding_guests_rsvp CHECK (rsvp_status IN ('Pending', 'Attending', 'Declined')),
  -- Chưa mời thì chưa có phản hồi
  CONSTRAINT ck_wedding_guests_rsvp_invited CHECK (is_invited OR rsvp_status = 'Pending')
);

CREATE INDEX IF NOT EXISTS ix_wedding_guests_wedding ON public.wedding_guests (wedding_id, created_date);

ALTER TABLE public.wedding_guests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wedding_guests IS 'Khách mời của đám cưới. Trùng khách kiểm tra theo tên (bỏ dấu, không phân biệt hoa thường) + bên, ở backend';
COMMENT ON COLUMN public.wedding_guests.side IS 'Bride: nhà gái; Groom: nhà trai';
COMMENT ON COLUMN public.wedding_guests.group_name IS 'Nhóm: Gia đình, Họ hàng, Bạn bè, Đồng nghiệp, Khác hoặc tự nhập (tối đa 30 ký tự)';
COMMENT ON COLUMN public.wedding_guests.party_size IS 'Số người đi cùng tính cả khách (1-50)';
COMMENT ON COLUMN public.wedding_guests.rsvp_status IS 'Pending: chưa phản hồi; Attending: sẽ đến; Declined: từ chối. Chỉ khác Pending khi is_invited';

COMMIT;
