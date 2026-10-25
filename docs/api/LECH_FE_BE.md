# Chỗ lệch giữa Frontend và Backend

> Giai đoạn này **phía NCC của frontend chạy hoàn toàn bằng dữ liệu giả** (`frontend/.env`: `VITE_REAL_APIS=catalog,auth`), làm đúng theo `docs/database.md`, `docs/CHOT_NGHIEP_VU_NCC.md`, `docs/api/THE_DON_HANG.md`. Backend làm sau, theo các file `docs/api/*.md` phần NCC (đã viết lại thành hợp đồng đúng CSDL).
> File này liệt kê **backend hiện tại (`backend/`) chưa đúng ở đâu** để người làm backend sửa. Chưa sửa gì trong `backend/`.
> Đối chiếu ngày 25/10/2026, theo `backend/src/modules/*` và `backend/prisma/schema.prisma`.

## Backend hiện chưa đúng

### Đơn hàng (`orders`) — hợp đồng: [orders.md](orders.md) phần NCC

1. **Trạng thái bị gộp.** `order-mapping.ts` đang đổi `Completed` thành `CONFIRMED`, `Expired` thành `CANCELLED`, `Deposited` thành `CONFIRMED`. Cần trả đủ **7 trạng thái thô** (`Draft`, `Pending`, `NeedRevision`, `Deposited`, `Completed`, `Expired`, `Cancelled`).
2. **Đang dựng giả dữ liệu cũ.** Phản hồi đơn tạo ra "phiên bản", "đợt thanh toán" (`installments`), "khoản đã thu" (`payments`, `paidAmount`), `paymentStatus` 6 giá trị. Cần trả đúng: `items`, `depositPercent`, `depositAmount`, `depositDueDate`, `payment` (`Payments.Status`, `PaidDate`, `TransactionCode`), `revisions` (`OrderRevisions` + `OrderRevisionChanges`), `invoices`.
3. **Chưa có việc chạy hằng ngày** (không có `Cron`/`Schedule`): hết hạn đơn `Pending` quá `DepositDueDate`; tự hoàn thành sau `EventDate + 7 ngày`.
4. **Chưa có `POST /vendors/me/orders/:id/complete`** (Đánh dấu hoàn thành, chỉ khi đã qua `EventDate`). Hiện đơn chỉ thành `Completed` qua `POST …/payments` ("ghi nhận thanh toán phần còn lại"), trái với CHOT.
5. **Chưa có `POST /vendors/me/orders/:id/final-invoice`.** Hiện hóa đơn cuối bị tạo tự động khi "ghi nhận thanh toán".
6. **Chưa có sửa đơn sau cọc** (`PATCH /vendors/me/orders/:id`): `send` đang từ chối đơn `Deposited`. Cần: sửa hạng mục, ngày, ghi chú; khóa `DepositPercent`, `DepositAmount`; tổng mới ≥ tiền đã cọc; ghi `OrderRevisions` (`AfterDeposit`); thêm tin `Order`.
7. **NCC vẫn hủy được đơn** (`POST …/cancel` cho `Draft`, `Pending`, `NeedRevision`). Theo CHOT NCC không hủy đơn: cần bỏ endpoint này. Cũng bỏ `POST …/payments` và `POST …/adjustments` (đang trả 409).
8. **Lưu nháp thiếu ngày sự kiện bị đổi thành ngày hôm nay** (`OrdersService.parse`). Cần bắt buộc `eventDate` cả khi lưu nháp (`400 VALIDATION_ERROR`).
9. **Làm tròn tiền cọc đến 100.000đ:** cần làm đúng quy tắc (tạm làm tròn gần nhất, xem mục "Chưa chốt" của CHOT); hiện `deposit_amount` chưa được xác nhận có làm tròn.
10. **Gửi lại đơn `Pending`/`NeedRevision`** phải đặt lại `DepositDueDate` = +1 ngày và thêm tin `Order` mới (hiện ghi đè và ghi thay đổi vào tin hội thoại).
11. Thanh toán cọc VNPay đang **giả lập** (`POST /payments` ghi nhận ngay). Cần tích hợp VNPay thật theo CSDL mục 9.6.

### Tin nhắn (`chat`) — hợp đồng: [chat.md](chat.md) phần NCC

1. `Messages.Type` chỉ có `Text`, `Order`, `DepositReceipt`, `FinalInvoice` (và tin hệ thống `SenderId` rỗng). Backend đang ánh xạ về các loại cũ của FE (`PAYMENT_RECORDED`, `ORDER_REVISION_REQUESTED`…): cần trả đúng 4 loại và `sender` `COUPLE`/`VENDOR`/`SYSTEM`.
2. Tin liên quan đơn do hệ thống gửi (khách yêu cầu chỉnh sửa, hết hạn, hủy, hoàn thành) phải là tin `Text` với `SenderId` rỗng.
3. `VendorConversation`: `latestOrder.status` dùng 7 trạng thái thô; `needsAction` thêm trường hợp đơn `Deposited` đã qua `EventDate` và có yêu cầu sửa sau cọc đang `Requested`.
4. Chưa có trạng thái trực tuyến (`customer.online`): giao diện đang ẩn.

### Hoa hồng (`commissions`) — hợp đồng viết lại ở bước sau (commissions.md)

1. `POST /vendors/me/commissions/:id/payments` đang trả 409 ("do Admin ghi nhận"). Theo CHOT: NCC **nộp một lần cho cả bảng kê qua VNPay**.
2. Phản hồi đang giả các trường `supplementCount`, `pendingAmount`, `paidAmount`, `transfer` (thông tin chuyển khoản), trạng thái `OPEN`/`UNPAID`/`PAID`. Theo CSDL chỉ có `Unpaid`/`Paid` (quá hạn tính khi truy vấn).
3. Hoa hồng phải phát sinh khi đơn `Completed` (đúng tại mốc hoàn thành), không từ "ghi nhận thanh toán".

### Hồ sơ NCC (`vendors`) — hợp đồng viết lại ở bước sau (vendors.md)

1. Backend lưu "quận" vào cột `Ward`; cần nhận/trả `address`, `ward` (phường/xã), `city` (thành phố), `description`.
2. Giờ làm việc đang parse/format có cấu trúc; theo CHOT là **một chuỗi mô tả** (`WorkingHours`).
3. Giấy tờ: thêm `SkillCertificate` (Makeup); kiểm tra bắt buộc theo CHOT (mọi loại cần `BusinessLicense` và `StorefrontPhoto`; `FoodSafety`, `FireSafety` chỉ Nhà hàng).
4. Trả lý do `NeedRevision` (`VendorVerifications.AdminNote`).

### Gói dịch vụ — hợp đồng viết lại ở bước sau (catalog.md)

1. Đang gộp `NeedRevision` vào `DRAFT`; cần trả `NeedRevision` kèm `AdminNote` (`PackageVerifications`).
2. "Xóa" gói theo CSDL thực chất là `Hidden`; hiện có `DELETE` xóa hẳn bản nháp.

### Chung

- Chưa có API đọc `Notifications` cho NCC (`notifications.md` còn trống). Chuông thông báo để sau.

## Đã đối chiếu, BE đã khớp

- `POST /vendors/me/orders` nhận `conversationId`; BE suy `wedding_id` từ `conversations.couple_id` → `weddings.user_id` (FE không gửi `weddingId`); khách chưa có đám cưới thì `409 WEDDING_NOT_SET`.
- Gửi đơn bắt buộc số điện thoại hợp lệ; lưu nháp không kiểm tra số điện thoại.
- `customer.name` = "Chú rể & Cô dâu", không có đám cưới thì `users.full_name`; `customer.phone` = `users.phone_number` (rỗng nếu chưa nhập).
- Tỷ lệ hoa hồng đọc từ `service_categories.commission_rate`, hạn nộp ngày 25 tháng sau.
