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
12. **Hủy đơn đổi sang NCC hủy** (nhóm đã quyết hai giai đoạn): thêm `POST /vendors/me/orders/:id/cancel` body `{ reason: CUSTOMER_REQUEST | VENDOR_UNABLE, note? }`. Chỉ khi `Deposited` và hôm nay (giờ VN) < `EventDate`; lỗi `422 ORDER_NOT_CANCELLABLE`. Ghi `CancelledDate`, `CancelReason`, thêm tin hệ thống "NCC đã hủy đơn {mã} · Lý do: …", không tạo hoa hồng. (Endpoint `POST …/cancel` cũ của NCC cho `Draft/Pending/NeedRevision` cần bỏ như mục 7.)
13. **CSDL cần thêm `Orders.CancelReason`** (CHECK: `CUSTOMER_REQUEST`, `VENDOR_UNABLE`), và nên có `Orders.CancelNote` (TEXT, tùy chọn). Sửa `database.md` mục 9.5: luồng "Deposited → Khách hủy → Cancelled" thành "NCC hủy (trước EventDate)"; trạng thái `Cancelled` "Khách hủy sau khi đã cọc, mất cọc" thành "NCC hủy sau khi đã cọc (khách mất cọc hoặc NCC hoàn cọc ngoài hệ thống)"; mục 9.8 "Không tính hoa hồng" giữ nguyên.
14. **Yêu cầu chỉnh sửa sau cọc của khách bỏ.** `OrderRevisions` loại `AfterDeposit` do **NCC tạo** khi Chỉnh sửa (`PATCH /vendors/me/orders/:id` nhận thêm `changeNote` bắt buộc, lưu vào `RequestNote`), trạng thái `Applied` luôn. Sửa `database.md` mục 9.5 ("Sau cọc: đơn vẫn ở Deposited, yêu cầu của khách ghi OrderRevisions Requested") và đoạn tương ứng ở mục 9.5 dưới bảng trạng thái.

### Tin nhắn (`chat`) — hợp đồng: [chat.md](chat.md) phần NCC

1. `Messages.Type` chỉ có `Text`, `Order`, `DepositReceipt`, `FinalInvoice` (và tin hệ thống `SenderId` rỗng). Backend đang ánh xạ về các loại cũ của FE (`PAYMENT_RECORDED`, `ORDER_REVISION_REQUESTED`…): cần trả đúng 4 loại và `sender` `COUPLE`/`VENDOR`/`SYSTEM`.
2. Tin liên quan đơn do hệ thống gửi (khách yêu cầu chỉnh sửa, hết hạn, hủy, hoàn thành) phải là tin `Text` với `SenderId` rỗng.
3. `VendorConversation`: `latestOrder.status` dùng 7 trạng thái thô; `needsAction` thêm trường hợp đơn `Deposited` đã qua `EventDate` và có yêu cầu sửa sau cọc đang `Requested`.
4. Chưa có trạng thái trực tuyến (`customer.online`): giao diện đang ẩn.

### Hoa hồng (`commissions`) — hợp đồng: [commissions.md](commissions.md)

1. `POST /vendors/me/commissions/:id/payments` (minh chứng) đang trả 409 "do Admin ghi nhận". Cần bỏ, thay bằng `POST /vendors/me/commissions/:id/pay`: NCC **nộp một lần cho cả bảng kê qua VNPay**, trả `paymentUrl`; thành công thì `Paid`, ghi `PaidDate`, `TransactionCode`.
2. Phản hồi đang giả các trường `supplementCount`, `pendingAmount`, `paidAmount`, `transfer` (thông tin chuyển khoản), trạng thái `OPEN`/`UNPAID`/`PAID`. Cần trả đúng `CommissionStatement` thô (`periodMonth`, `totalOrders`, `totalAmount`, `dueDate`, `status` `Unpaid`/`Paid`, `paidDate`, `transactionCode`). "Đang tạm tính" và "Quá hạn" không lưu, giao diện tính.
3. Đổi dạng `GET /vendors/me/commissions` thành `{ rate, statements }`; thêm `GET /vendors/me/commissions/:id/lines` (hoa hồng từng đơn kèm `orderCode`, `customerName`, `completedDate`).
4. Hoa hồng phải phát sinh khi đơn `Completed` (đúng tại mốc hoàn thành), không từ "ghi nhận thanh toán"; cộng dồn `TotalOrders`, `TotalAmount` của bảng kê tháng `CompletedDate`.
5. Tỷ lệ theo loại dịch vụ lấy từ `service_categories.commission_rate` (Nhà hàng 5, Decor 7, Hoa cưới 8, Trang phục 8, Chụp ảnh 8, Makeup 10); bỏ tỷ lệ cố định 8/10/12 và hạn ngày 20 trong code cũ (nếu còn).

### Hồ sơ NCC (`vendors`) — hợp đồng viết lại ở bước sau (vendors.md)

1. Backend lưu "quận" vào cột `Ward`; cần nhận/trả `address`, `ward` (phường/xã), `city` (thành phố), `description`.
2. Giờ làm việc đang parse/format có cấu trúc; theo CHOT là **một chuỗi mô tả** (`WorkingHours`).
3. Giấy tờ: thêm `SkillCertificate` (Makeup); kiểm tra bắt buộc theo CHOT (mọi loại cần `BusinessLicense` và `StorefrontPhoto`; `FoodSafety`, `FireSafety` chỉ Nhà hàng).
4. Trả lý do `NeedRevision` (`VendorVerifications.AdminNote`).

### Gói dịch vụ — hợp đồng viết lại ở bước sau (catalog.md)

1. Đang gộp `NeedRevision` vào `DRAFT`; cần trả `NeedRevision` kèm `AdminNote` (`PackageVerifications`).
2. "Xóa" gói theo CSDL thực chất là `Hidden`; hiện có `DELETE` xóa hẳn bản nháp.

### Chung

- **Giới hạn 100 đơn ở FE:** Tổng quan và 4 thẻ số liệu trang Đơn hàng đang tự tính từ tối đa 100 đơn mới nhất (trang lớn nhất API cho phép), sẽ thiếu số khi NCC có hơn 100 đơn (đơn cũ đã cọc chưa hoàn tất có thể rơi khỏi danh sách). Cần **endpoint tổng hợp** `GET /vendors/me/orders/summary` (chi tiết ở [orders.md](orders.md), mục "Việc backend cần thêm cho trang Quản lý đơn hàng"). FE chưa sửa việc này.
- Danh sách đơn cần thêm bộ lọc `depositFrom`, `depositTo` (ngày cọc) cho thẻ "Đặt cọc trong tháng".
- **Tiền cọc:** làm tròn gần nhất đến 100.000đ, **tối thiểu 100.000đ**, và chặn Gửi đơn khi tiền cọc ≥ tổng đơn ("Tổng đơn quá nhỏ để đặt cọc", `400 VALIDATION_ERROR` `details.deposit`). Hiện backend chưa có (xem [orders.md](orders.md) mục Quy tắc nghiệp vụ).
- **Ngày thực hiện:** Gửi đơn, Tạo lại đơn, Chỉnh sửa sau cọc phải từ hôm nay trở đi (giờ VN), nếu không `422 EVENT_DATE_IN_PAST`; giữ nguyên ngày đang có thì không kiểm; Lưu nháp không chặn.
- **Tự hoàn thành:** job hằng ngày phải ghi `CompletedDate` = cuối ngày `EventDate` + 7 (giờ VN) chứ không phải lúc job chạy, để hoa hồng vào đúng bảng kê tháng.

- Chưa có API đọc `Notifications` cho NCC (`notifications.md` còn trống). Chuông thông báo để sau.

## Đã đối chiếu, BE đã khớp

- `POST /vendors/me/orders` nhận `conversationId`; BE suy `wedding_id` từ `conversations.couple_id` → `weddings.user_id` (FE không gửi `weddingId`); khách chưa có đám cưới thì `409 WEDDING_NOT_SET`.
- Gửi đơn bắt buộc số điện thoại hợp lệ; lưu nháp không kiểm tra số điện thoại.
- `customer.name` = "Chú rể & Cô dâu", không có đám cưới thì `users.full_name`; `customer.phone` = `users.phone_number` (rỗng nếu chưa nhập).
- Tỷ lệ hoa hồng đọc từ `service_categories.commission_rate`, hạn nộp ngày 25 tháng sau.
