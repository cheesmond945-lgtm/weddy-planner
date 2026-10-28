# Chỗ lệch giữa Frontend và Backend

> Giai đoạn này **phía NCC của frontend chạy hoàn toàn bằng dữ liệu giả** (`frontend/.env`: `VITE_REAL_APIS=catalog,auth`), làm đúng theo `docs/database.md`, `docs/CHOT_NGHIEP_VU_NCC.md`, `docs/api/THE_DON_HANG.md`. Backend làm sau, theo các file `docs/api/*.md` phần NCC (đã viết lại thành hợp đồng đúng CSDL).
> File này liệt kê **backend hiện tại (`backend/`) chưa đúng ở đâu** để người làm backend sửa. Chưa sửa gì trong `backend/`.
> Đối chiếu ngày 25/10/2026, theo `backend/src/modules/*` và `backend/prisma/schema.prisma`.
> Cập nhật 27/10/2026: **backend tin nhắn đã làm xong** (module `chat`), chat chạy thật được ở cả hai phía; các mục khác vẫn như cũ.

## Backend hiện chưa đúng

### Đơn hàng (`orders`) — hợp đồng: [orders.md](orders.md), [THE_DON_HANG.md](THE_DON_HANG.md), [THE_DON_PHIA_KHACH.md](../THE_DON_PHIA_KHACH.md)

Backend đơn hàng **đã làm lại ngày 27/10/2026** theo thiết kế mới, gồm cả hủy đơn: CSDL có cột `Orders.CancelReason` (CHECK `CUSTOMER_REQUEST` | `VENDOR_UNABLE`) do `backend/prisma/sql/2026-10-27-orders-cancel-reason.sql`. **Cột `CancelNote` đã bị bỏ theo quyết định nhóm 27/10/2026** (Chika xóa khỏi DB): ghi chú khi hủy chỉ nằm trong tin hệ thống trong chat, không lưu cột. Còn lại:

1. **`GET /vendors/me/orders/summary` chưa làm.** FE vẫn tự tính 4 thẻ số liệu từ danh sách đơn (tối đa 100 đơn mới nhất mỗi trang). Cần chốt tên trường trả về cùng định nghĩa ở `features/vendorOrders/summary.ts` trước khi làm.
2. **VNPay thật chưa có.** `POST /payments` chạy chế độ thử (`PAYMENT_MODE=simulate`), xem [payments.md](payments.md). Chưa có IPN.
3. **Sửa ngày thực hiện sau cọc chưa dời việc trên timeline** của khách (các việc chi tiết giữ lịch cũ).
4. **Quét toàn hệ thống mặc định tắt** (`ORDER_JOBS_ENABLED=false`): đơn `Pending` quá hạn và đơn `Deposited` quá `eventDate` + 7 ngày chỉ được cập nhật khi chính NCC hoặc khách đó mở đơn. Dữ liệu thật hiện có 1 đơn `Pending` quá hạn và 2 đơn `Deposited` đã qua `eventDate` chưa được xử lý vì thế.
5. Dữ liệu cũ: còn `OrderRevisions` `AfterDeposit` trạng thái `Requested` (1) và `Rejected` (1), trái quy tắc mới. Không migrate; giao diện chỉ hiện trong lịch sử ở "Xem chi tiết".
6. Tìm đơn theo số điện thoại so khớp chuỗi lưu trong CSDL (có khoảng trắng nếu NCC nhập có), không chuẩn hóa chỉ còn chữ số.

### Tin nhắn (`chat`) — hợp đồng: [chat.md](chat.md)

Phần tin nhắn **đã làm xong ngày 27/10/2026** (xem mục "Đã đối chiếu" bên dưới). Còn lại:

1. Các nơi trong `orders.service.ts` gọi `postMessage` (khách yêu cầu chỉnh sửa, hết hạn, hủy, xác nhận cọc, hoàn thành, hóa đơn cuối) chưa được rà theo quy ước: tin liên quan đơn có `type` đúng (`Order`, `DepositReceipt`, `FinalInvoice`), `orderId` đủ, tin hệ thống `SenderId` rỗng và là `Text`. Rà lại khi sửa `orders.service.ts`.
2. `needsAction` hiện gồm đơn `Draft`, `NeedRevision` và `Deposited` đã qua `EventDate`. Nếu sau này có "yêu cầu sửa sau cọc đang `Requested`" thì thêm vào.
3. Chưa có trạng thái trực tuyến (`customer.online`): giao diện đang ẩn.
4. API thông báo (`GET /notifications`, `unread-count`, `read`, `read-all`) **đã làm** (27/10/2026) và cổng NCC có chuông; **chuông phía khách chưa nối** (nút tĩnh).

### Hoa hồng (`commissions`) — hợp đồng: [commissions.md](commissions.md)

**Đã làm lại ngày 27/10/2026** theo hợp đồng (trước đó backend còn trả mảng kiểu cũ, làm trang Tổng quan NCC báo `Cannot read properties of undefined (reading 'some')`): `GET /vendors/me/commissions` trả `{ rate, statements[] }` (`id` là UUID bảng kê, `periodMonth` "YYYY-MM"), `GET …/:id/lines`, `POST …/:id/pay`. Còn lại:

1. **VNPay thật chưa có:** `POST …/:id/pay` chạy chế độ thử (`PAYMENT_MODE=simulate`, ghi nhận nộp thành công ngay và trả `{ paymentUrl: null, statement }`); các chế độ khác trả 501.
2. Chưa có việc nhắc hoa hồng sắp đến hạn / quá hạn (cần API và thông báo `Notifications`).
3. Phía Admin xem và đối soát: làm sau.

### Hồ sơ NCC (`vendors`) — hợp đồng viết lại ở bước sau (vendors.md)

1. Backend lưu "quận" vào cột `Ward`; cần nhận/trả `address`, `ward` (phường/xã), `city` (thành phố), `description`.
2. Giờ làm việc đang parse/format có cấu trúc; theo CHOT là **một chuỗi mô tả** (`WorkingHours`).
3. Giấy tờ: thêm `SkillCertificate` (Makeup); kiểm tra bắt buộc theo CHOT (mọi loại cần `BusinessLicense` và `StorefrontPhoto`; `FoodSafety`, `FireSafety` chỉ Nhà hàng).
4. Trả lý do `NeedRevision` (`VendorVerifications.AdminNote`).

### Gói dịch vụ — hợp đồng viết lại ở bước sau (catalog.md)

1. Đang gộp `NeedRevision` vào `DRAFT`; cần trả `NeedRevision` kèm `AdminNote` (`PackageVerifications`).
2. "Xóa" gói theo CSDL thực chất là `Hidden`; hiện có `DELETE` xóa hẳn bản nháp.

### Chung

- **Giới hạn 100 đơn ở FE (chờ `summary`, xem mục Đơn hàng):** Tổng quan và 4 thẻ số liệu trang Đơn hàng đang tự tính từ tối đa 100 đơn mới nhất (trang lớn nhất API cho phép), sẽ thiếu số khi NCC có hơn 100 đơn (đơn cũ đã cọc chưa hoàn tất có thể rơi khỏi danh sách). Cần **endpoint tổng hợp** `GET /vendors/me/orders/summary` (chi tiết ở [orders.md](orders.md), mục "Việc backend cần thêm cho trang Quản lý đơn hàng"). FE chưa sửa việc này.
- ~~Danh sách đơn cần bộ lọc `depositFrom`, `depositTo`~~ **đã làm** (27/10/2026).
- **Tiền cọc:** làm tròn gần nhất đến 100.000đ, **tối thiểu 100.000đ**, và chặn Gửi đơn khi tiền cọc ≥ tổng đơn ("Tổng đơn quá nhỏ để đặt cọc", `400 VALIDATION_ERROR` `details.deposit`). Hiện backend chưa có (xem [orders.md](orders.md) mục Quy tắc nghiệp vụ).
- **Ngày thực hiện:** Gửi đơn, Tạo lại đơn, Chỉnh sửa sau cọc phải từ hôm nay trở đi (giờ VN), nếu không `422 EVENT_DATE_IN_PAST`; giữ nguyên ngày đang có thì không kiểm; Lưu nháp không chặn.
- **Tự hoàn thành:** job hằng ngày phải ghi `CompletedDate` = cuối ngày `EventDate` + 7 (giờ VN) chứ không phải lúc job chạy, để hoa hồng vào đúng bảng kê tháng.

- API thông báo đã làm (xem [notifications.md](notifications.md)); còn thiếu thông báo nhắc việc và nhắc hoa hồng, và chuông phía khách.

## Đã đối chiếu, BE đã khớp

- `POST /vendors/me/orders` nhận `conversationId`; BE suy `wedding_id` từ `conversations.couple_id` → `weddings.user_id` (FE không gửi `weddingId`); khách chưa có đám cưới thì `409 WEDDING_NOT_SET`.
- Gửi đơn bắt buộc số điện thoại hợp lệ; lưu nháp không kiểm tra số điện thoại.
- `customer.name` = "Chú rể & Cô dâu", không có đám cưới thì `users.full_name`; `customer.phone` = `users.phone_number` (rỗng nếu chưa nhập).
- Tỷ lệ hoa hồng đọc từ `service_categories.commission_rate`, hạn nộp ngày 25 tháng sau.
- **Tin nhắn (27/10/2026):** `GET/POST /conversations`, `/conversations/:id/messages`, `/conversations/:id/read` dùng chung cho khách và NCC (vai trò lấy từ JWT), bí danh `/vendors/me/conversations/*`. Tin theo `database.md` 4.18: `content`, `sentDate`, `isRead`, `type` ∈ `Text`/`Order`/`DepositReceipt`/`FinalInvoice`, `sender` ∈ `COUPLE`/`VENDOR`/`SYSTEM`; tin hệ thống là `Text` với `SenderId` rỗng. `latestOrder.status` trả 7 trạng thái thô. `needsAction` gồm `Deposited` đã qua `EventDate`. Mỗi hội thoại chỉ giữ một thông báo `NewMessage` chưa đọc cho mỗi người nhận.
- **Đơn hàng (27/10/2026):** DTO đơn dùng chung cho khách và NCC (`toOrderDto`), 7 trạng thái thô; tiền cọc làm tròn gần nhất đến 100.000đ, tối thiểu 100.000đ, chặn khi cọc ≥ tổng (`details.deposit`); `EVENT_DATE_IN_PAST` (422) khi gửi/cập nhật/sửa sau cọc; hạn cọc = lúc gửi hoặc cập nhật + 24 giờ; `PATCH` sửa sau cọc (khóa tỷ lệ và tiền cọc, `OrderRevisions` `AfterDeposit` `Applied`); `cancel` (chỉ `Deposited` còn trước `eventDate`, lý do `CUSTOMER_REQUEST`/`VENDOR_UNABLE`, tin hệ thống, không tính hoa hồng, xóa việc chi tiết trên timeline); `complete`, `final-invoice`; khách yêu cầu chỉnh sửa chỉ khi `Pending`, một tin hệ thống, ghi `OrderRevisionChanges`; đặt cọc (thử) ghi `Payments`/`Invoices`/tin `DepositReceipt`/timeline; hết hạn và tự hoàn thành idempotent (hoa hồng vào tháng của cuối ngày `eventDate` + 7, giờ VN).
