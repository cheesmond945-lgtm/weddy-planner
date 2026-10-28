-- Thêm trạng thái 'Hidden' cho hồ sơ nhà cung cấp (Admin ẩn / hiện lại hồ sơ, kéo theo toàn bộ gói dịch vụ).
-- Hoàn tác: đưa các hồ sơ 'Hidden' về 'Approved' rồi tạo lại ràng buộc không có 'Hidden'.
ALTER TABLE vendor_profiles DROP CONSTRAINT vendor_profiles_status_check;
ALTER TABLE vendor_profiles ADD CONSTRAINT vendor_profiles_status_check
  CHECK (status::text = ANY (ARRAY['Draft','Pending','NeedRevision','Approved','Hidden']::text[]));
