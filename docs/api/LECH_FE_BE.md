# Chỗ lệch giữa Frontend và Backend

> Ghi lại những chỗ FE đã làm theo hợp đồng trong `docs/api/*.md` nhưng backend (`backend/`) chưa khớp, để người làm backend bổ sung.
> `docs/database.md` hiện còn trống, nên phần đối chiếu cơ sở dữ liệu dưới đây dựa vào `backend/prisma/schema.prisma`.

## Backend cần bổ sung

Hiện chưa có mục nào.

## Đã đối chiếu, BE đã khớp (luồng "Tạo đơn" trong Tin nhắn NCC)

- `POST /vendors/me/orders` nhận `conversationId`; BE suy `wedding_id` từ `conversations.couple_id` → `weddings.user_id` (FE không gửi `weddingId`).
- Khách chưa có bản ghi `weddings`: BE trả `409 WEDDING_NOT_SET`. FE hiện "Khách chưa điền thông tin đám cưới nên chưa tạo đơn được" kèm nút "Nhắc khách" (gửi một tin mẫu nhờ khách điền).
- Ngày sự kiện (`orders.event_date`, `NOT NULL`) do NCC tự nhập, không lấy từ `weddings.wedding_date`. FE bắt nhập ngày trước khi lưu nháp để BE không phải tự đặt ngày hôm nay (`OrdersService.parse` đang gán ngày hôm nay khi `eventDate` trống).
- Lưu nháp không kiểm tra số điện thoại; gửi đơn (`send = true`) bắt buộc số điện thoại hợp lệ (9 đến 15 ký tự). Cột `orders.customer_phone` là `NOT NULL` nên bản nháp trống được lưu thành chuỗi rỗng.
- `customer.name` = "Chú rể & Cô dâu" (`weddings.groom_name` & `weddings.bride_name`), không có `weddings` thì `users.full_name`; `customer.phone` = `users.phone_number` (rỗng nếu khách chưa nhập). FE điền sẵn hai giá trị này vào đơn, NCC sửa được, sửa không đổi hồ sơ khách.
