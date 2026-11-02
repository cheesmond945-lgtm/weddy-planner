-- Nơi tổ chức đám cưới: một phường/xã của Hà Nội từ 01/07/2025 (Nghị quyết 1656/NQ-UBTVQH15, 51 phường + 75 xã).
-- Đặc tả: docs/api/weddings.md mục 4.1.
-- Chạy THỦ CÔNG trên Supabase (SQL Editor hoặc `npx prisma db execute --file prisma/manual/<file>` trong backend/).
-- Ứng dụng KHÔNG tự chạy file này. Không dùng prisma migrate / db push. schema.prisma đã được sửa tay cho khớp.
-- An toàn khi chạy lại (IF NOT EXISTS, kiểm tra constraint). Cột cho phép rỗng: đám cưới cũ chưa chọn nơi tổ chức.
-- Câu gỡ (rollback) ở cuối file.

BEGIN;

ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS ward varchar(50);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_weddings_ward') THEN
    -- Cùng danh sách với HANOI_WARDS (backend/src/modules/weddings/wards.ts, frontend/src/features/weddings/wards.ts)
    ALTER TABLE public.weddings ADD CONSTRAINT ck_weddings_ward CHECK (
      ward IS NULL OR ward IN (
        'Phường Hoàn Kiếm', 'Phường Cửa Nam', 'Phường Ba Đình', 'Phường Ngọc Hà',
        'Phường Giảng Võ', 'Phường Hai Bà Trưng', 'Phường Vĩnh Tuy', 'Phường Bạch Mai',
        'Phường Đống Đa', 'Phường Kim Liên', 'Phường Văn Miếu - Quốc Tử Giám', 'Phường Láng',
        'Phường Ô Chợ Dừa', 'Phường Hồng Hà', 'Phường Lĩnh Nam', 'Phường Hoàng Mai',
        'Phường Vĩnh Hưng', 'Phường Tương Mai', 'Phường Định Công', 'Phường Hoàng Liệt',
        'Phường Yên Sở', 'Phường Thanh Xuân', 'Phường Khương Đình', 'Phường Phương Liệt',
        'Phường Cầu Giấy', 'Phường Nghĩa Đô', 'Phường Yên Hòa', 'Phường Tây Hồ',
        'Phường Phú Thượng', 'Phường Tây Tựu', 'Phường Phú Diễn', 'Phường Xuân Đỉnh',
        'Phường Đông Ngạc', 'Phường Thượng Cát', 'Phường Từ Liêm', 'Phường Xuân Phương',
        'Phường Tây Mỗ', 'Phường Đại Mỗ', 'Phường Long Biên', 'Phường Bồ Đề',
        'Phường Việt Hưng', 'Phường Phúc Lợi', 'Phường Hà Đông', 'Phường Dương Nội',
        'Phường Yên Nghĩa', 'Phường Phú Lương', 'Phường Kiến Hưng', 'Phường Thanh Liệt',
        'Phường Chương Mỹ', 'Phường Sơn Tây', 'Phường Tùng Thiện', 'Xã Thanh Trì',
        'Xã Đại Thanh', 'Xã Nam Phù', 'Xã Ngọc Hồi', 'Xã Thượng Phúc',
        'Xã Thường Tín', 'Xã Chương Dương', 'Xã Hồng Vân', 'Xã Phú Xuyên',
        'Xã Phượng Dực', 'Xã Chuyên Mỹ', 'Xã Đại Xuyên', 'Xã Thanh Oai',
        'Xã Bình Minh', 'Xã Tam Hưng', 'Xã Dân Hòa', 'Xã Vân Đình',
        'Xã Ứng Thiên', 'Xã Hòa Xá', 'Xã Ứng Hòa', 'Xã Mỹ Đức',
        'Xã Hồng Sơn', 'Xã Phúc Sơn', 'Xã Hương Sơn', 'Xã Phú Nghĩa',
        'Xã Xuân Mai', 'Xã Trần Phú', 'Xã Hòa Phú', 'Xã Quảng Bị',
        'Xã Minh Châu', 'Xã Quảng Oai', 'Xã Vật Lại', 'Xã Cổ Đô',
        'Xã Bất Bạt', 'Xã Suối Hai', 'Xã Ba Vì', 'Xã Yên Bài',
        'Xã Đoài Phương', 'Xã Phúc Thọ', 'Xã Phúc Lộc', 'Xã Hát Môn',
        'Xã Thạch Thất', 'Xã Hạ Bằng', 'Xã Tây Phương', 'Xã Hòa Lạc',
        'Xã Yên Xuân', 'Xã Quốc Oai', 'Xã Hưng Đạo', 'Xã Kiều Phú',
        'Xã Phú Cát', 'Xã Hoài Đức', 'Xã Dương Hòa', 'Xã Sơn Đồng',
        'Xã An Khánh', 'Xã Đan Phượng', 'Xã Ô Diên', 'Xã Liên Minh',
        'Xã Gia Lâm', 'Xã Thuận An', 'Xã Bát Tràng', 'Xã Phù Đổng',
        'Xã Thư Lâm', 'Xã Đông Anh', 'Xã Phúc Thịnh', 'Xã Thiên Lộc',
        'Xã Vĩnh Thanh', 'Xã Mê Linh', 'Xã Yên Lãng', 'Xã Tiến Thắng',
        'Xã Quang Minh', 'Xã Sóc Sơn', 'Xã Đa Phúc', 'Xã Nội Bài',
        'Xã Trung Giã', 'Xã Kim Anh'
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN public.weddings.ward IS 'Phường/xã nơi tổ chức đám cưới (Hà Nội), có tiền tố: "Phường Cầu Giấy", "Xã Đông Anh". NULL: chưa chọn';

COMMIT;

-- ROLLBACK (chạy tay nếu cần gỡ):
-- ALTER TABLE public.weddings DROP CONSTRAINT IF EXISTS ck_weddings_ward, DROP COLUMN IF EXISTS ward;
