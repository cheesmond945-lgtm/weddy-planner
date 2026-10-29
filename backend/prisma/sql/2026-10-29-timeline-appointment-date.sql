-- Ngày hẹn với NCC cho việc timeline (khác "Hạn" = scheduled_date).
-- Khách nhập sau khi chốt lịch với NCC qua chat; NULL khi chưa hẹn.
-- Với việc chụp album / chốt concept, ngày này cũng là S để tính lại các việc neo theo S của chính dịch vụ chụp ảnh.
-- CHƯA CHẠY: chờ nhóm duyệt. Sau khi chạy mới thêm cột vào backend/prisma/schema.prisma (model timeline_tasks) và chạy `prisma generate`.
ALTER TABLE timeline_tasks ADD COLUMN IF NOT EXISTS appointment_date date NULL;
