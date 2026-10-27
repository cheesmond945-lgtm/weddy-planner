# API: orders (phía cặp đôi)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/chat.ts`).
> Quy ước chung: [README.md](README.md).
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md` (trạng thái đơn).**

> **Triển khai thật (khớp CSDL Supabase):** đơn hàng, chat, kế hoạch, timeline, hoa hồng đã chạy trên dữ liệu thật. Điểm khác so với bản nháp bên dưới:
> - Mỗi đơn chỉ có **hai đợt**: đặt cọc theo `rate` % (khách trả qua cổng thanh toán) và phần còn lại (khách trả trực tiếp, NCC bấm xác nhận đã thu đủ thì đơn `Completed`, lập hóa đơn và tính hoa hồng).
> - Không có phiên bản đơn (`versions` tối đa 1; gửi lại thì ghi đè và ghi các thay đổi vào tin hội thoại), không có phương án điều chỉnh (`POST .../adjustments` trả 409 `ORDER_NOT_ADJUSTABLE`), không lưu minh chứng thanh toán, không lưu nháp cho đơn đã gửi.
> - Trạng thái: `Draft`→`DRAFT`, `Pending`→`AWAITING_CONFIRMATION` (chờ đặt cọc), `NeedRevision`→`REVISION_REQUESTED`, `Deposited`/`Completed`→`CONFIRMED` (+ `DEPOSIT_PAID`/`PAID`), `Expired`/`Cancelled`→`CANCELLED`. Phía cặp đôi thêm `CANCELLED`.
> - `POST /payments` chạy **giả lập** (ghi nhận thanh toán thành công ngay) vì chưa có tài khoản VNPay; đặt `PAYMENT_MODE` khác `simulate` để tắt.
> - Số lượng dòng báo giá phải là số nguyên; `code` đơn dạng `DH<YYMM><số>`.

Phạm vi: cặp đôi xem đơn dịch vụ NCC gửi trong khung chat và yêu cầu chỉnh sửa (mục 7.3). NCC tạo/sửa đơn làm khi tới phần NCC. Đặt cọc: xem [payments.md](payments.md).

Role: **COUPLE**, chỉ đơn của mình.

`Order`

```json
{
  "id": "od-1",
  "code": "#001",
  "planItemId": "pi-1",
  "serviceId": "sv-11",
  "conversationId": "cv-1",
  "packageName": "Gói ngoại cảnh 1 ngày",
  "serviceDate": "2027-01-16",
  "totalAmount": 14000000,
  "depositAmount": 1400000,
  "status": "SENT",
  "revisionNote": null,
  "paidAt": null
}
```

| Trường | Ghi chú |
|---|---|
| `code` | Mã hiển thị, tăng dần theo cặp đôi (`#001`) |
| `serviceDate` | Ngày thực hiện; khác ngày cưới thì timeline có mục `SERVICE_DATE` |
| `depositAmount` | NCC đặt, mặc định 10% `totalAmount` làm tròn 100.000đ; > 0 và ≤ `totalAmount` |
| Còn lại | FE tính `totalAmount - depositAmount`, thanh toán trực tiếp cho NCC (ngoài hệ thống) |

`OrderStatus` (nhãn FE trong ngoặc):

- `SENT` (Chờ thanh toán cọc): NCC vừa gửi hoặc gửi lại đơn. Kế hoạch chuyển `AWAITING_DEPOSIT`.
- `REVISION_REQUESTED` (Đang chỉnh sửa): cặp đôi yêu cầu sửa. Kế hoạch về `DISCUSSING`. NCC sửa và gửi lại thì về `SENT` (giữ nguyên `id`, `code`).
- `PAID` (Đã cọc): đặt cọc thành công. Kế hoạch chuyển `CONFIRMED`.

### GET /orders/:id
Response 200: `{ "data": Order }`

Lỗi: 404 `ORDER_NOT_FOUND`

### POST /orders/:id/revision-requests
Body `{ "note": "Đổi ngày thực hiện: lùi 1 ngày" }`. Chỉ khi `SENT`.

Hệ thống thêm vào hội thoại: tin của cặp đôi "Yêu cầu chỉnh sửa đơn #001:\n<note>" và tin hệ thống "Đã gửi yêu cầu chỉnh sửa cho nhà cung cấp…".

Response 200: `{ "data": Order }` (`REVISION_REQUESTED`, có `revisionNote`)

Lỗi: 400 `VALIDATION_ERROR` (note rỗng), 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_REVISABLE`

## Cần chốt

1. Đơn có hết hạn cọc không (ARCHITECTURE có job "hết hạn cọc"): sau bao lâu, trạng thái khi hết hạn là gì.
2. Có cho cặp đôi hủy đơn không.

---

# Phía Nhà cung cấp: đơn dịch vụ

> **Hợp đồng theo CSDL** (`docs/database.md`, mục 4.19 đến 4.24 và 9.5 đến 9.8), `docs/CHOT_NGHIEP_VU_NCC.md` mục 4, và `docs/api/THE_DON_HANG.md` (nội dung thẻ, nút). Khi mâu thuẫn, theo thứ tự đó.
> Bản này **thay thế hoàn toàn** bản cũ có phiên bản đơn v1/v2, đợt thanh toán tùy chỉnh, "ghi nhận thanh toán", phương án điều chỉnh và NCC hủy đơn. Frontend (`frontend/src/mocks/vendorOrders.ts`) làm đúng theo tài liệu này, backend làm theo tài liệu này.
> Quy ước chung: [README.md](README.md). Role: **VENDOR**, chỉ thấy đơn của mình. JSON dùng camelCase, giá trị enum viết đúng như CSDL (`Pending`, `Deposited`…).

## Quy tắc nghiệp vụ (tóm tắt)

- **7 trạng thái:** `Draft` → `Pending` → (`NeedRevision` ↔ `Pending`) → `Deposited` → `Completed`; `Pending` quá hạn thành `Expired`; `Deposited` bị **NCC hủy** (trước `eventDate`) thành `Cancelled`.
- **Chỉ một khoản trong hệ thống: tiền cọc qua VNPay** (`Payments`). Phần còn lại khách trả **tiền mặt trực tiếp cho NCC, ngoài hệ thống, không ghi nhận**. Không có nhiều đợt, không có "ghi nhận thanh toán", không có "đã thu / còn phải thu".
- **Hai giai đoạn.** Trước cọc: khách Thanh toán cọc, Yêu cầu chỉnh sửa; NCC Cập nhật đơn. Sau cọc (`Deposited`): khách không yêu cầu chỉnh sửa, không hủy; **NCC tự Chỉnh sửa hoặc Hủy đơn**. Không có `OrderRevisions` `AfterDeposit` trạng thái `Requested`.
- **NCC hủy đơn:** chỉ khi `Deposited` và hôm nay (giờ VN) **nhỏ hơn** `eventDate` (xem `POST …/cancel`). Đơn `Pending` không cọc thì tự `Expired`, không hủy được.
- Đơn `Expired` và `Cancelled` bị khóa. Muốn tiếp tục: NCC tạo **đơn mới** (mã mới) bằng cách chép hạng mục và ghi chú (FE gọi `POST /vendors/me/orders`, không có endpoint riêng).
- **Backend tính tiền**, không tin số tiền từ giao diện:
  - `OrderItems.amount = quantity × unitPrice`; `totalAmount = SUM(amount)`.
  - `depositAmount = totalAmount × depositPercent / 100`, **làm tròn gần nhất đến 100.000đ, TỐI THIỂU 100.000đ** (cọc 0đ thì khách không thanh toán được qua VNPay). Chờ nhóm xác nhận, xem mục "Chưa chốt" của CHOT; FE dùng đúng công thức này (`frontend/src/lib/deposit.ts`), backend làm giống hệt.
  - **Tổng đơn quá nhỏ để đặt cọc:** nếu `depositAmount` (đã làm tròn, tối thiểu) **lớn hơn hoặc bằng** `totalAmount` thì không cho Gửi đơn (`400 VALIDATION_ERROR`, `details.deposit` = "Tổng đơn quá nhỏ để đặt cọc."). Lưu nháp vẫn được. Không kiểm khi Chỉnh sửa sau cọc (tiền cọc đã khóa).
  - `depositDueDate` = thời điểm gửi đơn + 1 ngày (24 giờ).
  - NCC chỉ nhập: hạng mục, `depositPercent`, `eventDate`, `note` (cùng tên và số điện thoại khách, điền sẵn từ tài khoản khách).
- `depositPercent`: lớn hơn 0 và nhỏ hơn 100 (FE chỉ cho nhập số nguyên 1 đến 99).
- Đơn vị tính (`unit`): `Gói` (số lượng mặc định 1) hoặc `Bàn` (số lượng tùy chỉnh).
- Mã đơn `orderCode` dạng `DH<yyMM><số 4 chữ số>` (ví dụ `DH26100001`), không đổi dù sửa nhiều lần.

## Kiểu dữ liệu

### `Order`

```json
{
  "id": "5d1c8b1e-…",
  "orderCode": "DH26100004",
  "conversationId": "fb9cffdf-…",
  "status": "Pending",
  "customerName": "Thu Hà & Đức Minh",
  "customerPhone": "0938 221 904",
  "eventDate": "2026-12-13",
  "items": [
    { "id": "…", "itemName": "Tiệc cưới – Menu A", "unit": "Bàn", "quantity": 18, "unitPrice": 3200000, "amount": 57600000 }
  ],
  "totalAmount": 57600000,
  "depositPercent": 30,
  "depositAmount": 17300000,
  "depositDueDate": "2026-10-26T07:30:00.000Z",
  "note": "Giữ sảnh tầng 2.",
  "payment": { "status": "Unpaid", "paidDate": null, "transactionCode": null },
  "revisions": [],
  "invoices": [],
  "completedDate": null,
  "cancelledDate": null,
  "createdDate": "2026-10-25T07:30:00.000Z"
}
```

| Trường | Ghi chú |
|---|---|
| `payment` | `null` khi `Draft` (dòng `Payments` được tạo lúc gửi đơn). `status`: `Unpaid` hoặc `Paid`; khi `Paid` thì `paidDate`, `transactionCode` có giá trị |
| `depositDueDate` | `null` khi `Draft` |
| `revisions` | Lịch sử `OrderRevisions`, mới nhất trước |
| `invoices` | `Invoices` của đơn: tối đa một `DepositReceipt` và một `FinalInvoice` |
| `completedDate` | Ngày hoàn thành, mốc tính hoa hồng |
| `cancelledDate` | Ngày NCC hủy |
| `cancelReason` | `CUSTOMER_REQUEST` (khách yêu cầu hủy, khách mất cọc) hoặc `VENDOR_UNABLE` (NCC không thể thực hiện, hoàn cọc ngoài hệ thống); `null` nếu chưa hủy. **CSDL cần thêm cột `Orders.CancelReason`** |
| `cancelNote` | Ghi chú tùy chọn khi hủy; `null` nếu không có (cần cột `Orders.CancelNote`, hoặc nối vào tin hệ thống nếu nhóm không muốn thêm cột) |
| (không có) | Không có phiên bản v1/v2, không có đợt, không có "đã thu". Hạn trả nốt (`eventDate`, trả muộn tới +7 ngày) FE suy từ `eventDate` |

### `OrderRevision`

```json
{
  "id": "…",
  "revisionType": "BeforeDeposit",
  "requestNote": "Giảm xuống 15 bàn, đổi sang ngày 20/12 nhé.",
  "changes": ["Quantity", "EventDate"],
  "oldTotalAmount": 64000000,
  "newTotalAmount": null,
  "status": "Requested",
  "createdDate": "2026-10-24T03:10:00.000Z",
  "appliedDate": null
}
```

- `revisionType`: `BeforeDeposit` (khách yêu cầu trước cọc), `AfterDeposit` (**do NCC tạo** khi Chỉnh sửa đơn đã cọc). `status`: `Requested` (chỉ `BeforeDeposit`: khách yêu cầu, đang chờ NCC sửa) hoặc `Applied` (NCC đã sửa; `newTotalAmount` và `appliedDate` có giá trị). `AfterDeposit` luôn `Applied`.
- `requestNote`: `BeforeDeposit` là lời nhắn của khách; `AfterDeposit` là **"Nội dung thay đổi"** do NCC ghi (khách sẽ thấy), không thêm cột mới.
- `changes` là các `ChangeType` khách chọn (`OrderRevisionChanges`): `Item` (đổi hạng mục), `Quantity` (đổi số lượng), `EventDate` (đổi ngày thực hiện), `Other` (khác). **Danh sách đầy đủ chưa chốt** (CSDL mục 15).
- NCC tự sửa vì nhập sai (không có yêu cầu của khách): backend tạo luôn dòng `Applied` với `requestNote = null`, `changes = []`.

### `Invoice`

```json
{ "id": "…", "invoiceCode": "XNC26100001", "type": "DepositReceipt", "createdDate": "2026-10-24T05:00:00.000Z" }
```

`type`: `DepositReceipt` (giấy xác nhận cọc, tự động khi cọc thành công), `FinalInvoice` (hóa đơn cuối, NCC xuất). Mã: giấy xác nhận cọc `XNC<yyMM><số>`, hóa đơn cuối `HD<yyMM><số>`.

### `OrderContent` (body khi tạo, lưu nháp, gửi, sửa)

```json
{
  "customerName": "Thu Hà & Đức Minh",
  "customerPhone": "0938 221 904",
  "eventDate": "2026-12-13",
  "note": "Giữ sảnh tầng 2.",
  "depositPercent": 30,
  "items": [{ "itemName": "Tiệc cưới – Menu A", "unit": "Bàn", "quantity": 18, "unitPrice": 3200000 }]
}
```

Không có `totalAmount`, `depositAmount`, `amount`: backend tính.

## Kiểm tra

| Khi | Quy tắc |
|---|---|
| Lưu nháp (tạo, `PUT draft`) | **Bắt buộc `eventDate`** (cột `NOT NULL`, backend không tự đặt ngày hôm nay). Các trường khác được để trống; `depositPercent` trống thì mặc định 30; `customerPhone` trống thì lưu chuỗi rỗng |
| Gửi đơn (`send`) | Đủ `customerName`, `customerPhone` (9 đến 15 ký tự gồm số, khoảng trắng, `+ ( ) . -`), `eventDate`, ít nhất một hạng mục (`itemName` không rỗng, `quantity` nguyên > 0, `unitPrice` ≥ 0), `totalAmount` > 0, `depositPercent` lớn hơn 0 và nhỏ hơn 100 |
| Cập nhật đơn / Chỉnh sửa sau cọc | Như gửi đơn, và phải có thay đổi so với nội dung hiện tại |
| **Ngày sự kiện** (Gửi đơn, Tạo lại đơn, Chỉnh sửa sau cọc) | `eventDate` phải **từ hôm nay trở đi** (giờ Việt Nam), nếu không trả **`422 EVENT_DATE_IN_PAST`** (`details.eventDate`). Cập nhật đơn hoặc Chỉnh sửa mà **giữ nguyên** `eventDate` đang có của đơn thì không kiểm (đơn đã qua ngày vẫn sửa được hạng mục để Hoàn tất). **Lưu nháp không chặn.** |

Lỗi kiểm tra trả `400 VALIDATION_ERROR` với `details` theo trường: `customerName`, `customerPhone`, `eventDate`, `depositPercent`, `items`, `items.<i>.itemName`, `items.<i>.quantity`, `items.<i>.unitPrice`.

## Endpoint

### GET /vendors/me/orders

Query: `q` (mã đơn, tên khách, số điện thoại), `status` (một trong 7 trạng thái), `from`, `to` (ngày sự kiện `YYYY-MM-DD`, gồm hai đầu), `depositFrom`, `depositTo` (ngày cọc `Payments.PaidDate`, giờ VN, `YYYY-MM-DD`, gồm hai đầu: đơn đã cọc trong khoảng này, **mọi trạng thái** kể cả đã hoàn thành; dùng cho thẻ "Đặt cọc trong tháng"), `conversationId`, `page`, `pageSize` (mặc định 20, tối đa 100). Sắp xếp `createdDate` giảm dần. Gồm cả bản nháp.

Response 200: `{ "data": Order[], "meta": { page, pageSize, total, totalPages } }`

### GET /vendors/me/orders/counts

Số đơn theo từng trạng thái, không phụ thuộc bộ lọc.

Response 200: `{ "data": { "Draft": 1, "Pending": 2, "NeedRevision": 1, "Deposited": 3, "Completed": 4, "Expired": 1, "Cancelled": 1 } }`

### GET /vendors/me/orders/:id

Response 200: `{ "data": Order }`. Lỗi: 404 `ORDER_NOT_FOUND`.

### POST /vendors/me/orders

Tạo đơn trong hội thoại. Backend suy `weddingId` từ hội thoại (`Weddings.UserId` = `Conversations.CoupleId`); FE không gửi `weddingId`.

```json
{ "conversationId": "fb9cffdf-…", "content": "OrderContent", "send": false }
```

- `send = false`: lưu nháp (`Draft`, không tạo tin nhắn, khách không thấy).
- `send = true`: kiểm tra đủ rồi gửi luôn: `Draft` → `Pending`, tạo `Payments` (`Unpaid`), `depositDueDate` = +1 ngày, thêm tin `Order` vào hội thoại.

Response 201: `{ "data": Order }`. Lỗi: 400 `VALIDATION_ERROR`, 404 `CONVERSATION_NOT_FOUND`, 409 `WEDDING_NOT_SET` (khách chưa điền thông tin đám cưới).

### PUT /vendors/me/orders/:id/draft

Lưu bản nháp của đơn `Draft`. Body: `{ "content": OrderContent }`. Response 200: `{ "data": Order }`. Lỗi: 400, 404, 409 `ORDER_NOT_DRAFT`.

### POST /vendors/me/orders/:id/send

Body: `{ "content": OrderContent }`. Chấp nhận đơn `Draft`, `Pending`, `NeedRevision`.

- `Draft`: gửi lần đầu (như `send = true` ở trên).
- `Pending` / `NeedRevision` ("Cập nhật đơn"): lưu nội dung mới; nếu có `OrderRevisions` `Requested` thì thành `Applied` (ghi `newTotalAmount`, `appliedDate`), nếu NCC tự sửa thì tạo luôn dòng `Applied`; tính lại `totalAmount`, `depositAmount`; đơn về `Pending`; **đặt lại `depositDueDate` = +1 ngày**; thêm một tin `Order` mới (thẻ mới).
- Phải có thay đổi so với nội dung hiện tại (trừ `Draft`).

Response 200: `{ "data": Order }`. Lỗi: 400 `VALIDATION_ERROR`, 400 `ORDER_NO_CHANGES`, 404, 409 `ORDER_NOT_SENDABLE` (đơn `Deposited`, `Completed`, `Expired`, `Cancelled`).

### PATCH /vendors/me/orders/:id

**Sửa đơn sau cọc** (`Deposited`). Body: `{ "content": OrderContent, "changeNote": "Tăng từ 20 lên 22 bàn theo yêu cầu của khách." }`. `changeNote` bắt buộc (khách thấy), lỗi `400 VALIDATION_ERROR` nếu rỗng.

- Sửa được: hạng mục, `eventDate`, `note`. **Khóa** `depositPercent` và `depositAmount` (giá trị gửi lên bị bỏ qua); `customerName`, `customerPhone` giữ nguyên.
- `totalAmount` mới phải lớn hơn hoặc bằng `depositAmount` đã cọc.
- Ghi `OrderRevisions` loại `AfterDeposit` trạng thái **`Applied` luôn** (`requestNote` = `changeNote`, `oldTotalAmount` → `newTotalAmount`, `appliedDate`). Thêm một tin `Order` (thẻ cập nhật). Đơn **vẫn** `Deposited`.
- Tiền còn phải trả = `totalAmount` mới trừ `depositAmount` (ví dụ đơn 10 triệu, cọc 1 triệu, sửa lên 12 triệu thì còn 11 triệu).

Response 200: `{ "data": Order }`. Lỗi: 400 `VALIDATION_ERROR`, 400 `ORDER_NO_CHANGES`, 400 `ORDER_TOTAL_BELOW_DEPOSIT`, 404, 409 `ORDER_NOT_EDITABLE` (không phải `Deposited`).

### POST /vendors/me/orders/:id/cancel

**NCC hủy đơn đã cọc.** Chỉ khi `Deposited` và hôm nay (giờ Việt Nam) nhỏ hơn `eventDate`.

```json
{ "reason": "CUSTOMER_REQUEST", "note": "Khách báo không tổ chức nữa." }
```

- `reason` bắt buộc: `CUSTOMER_REQUEST` (khách yêu cầu hủy, khách mất cọc) hoặc `VENDOR_UNABLE` (NCC không thể thực hiện, NCC hoàn cọc cho khách ngoài hệ thống). `note` tùy chọn.
- Thành công: `Deposited` → `Cancelled`, ghi `cancelledDate`, `cancelReason` (và `note`); thêm tin hệ thống vào chat `NCC đã hủy đơn {OrderCode} · Lý do: {nhãn lý do}[ · {note}]` (nhãn: "Khách yêu cầu hủy" / "NCC không thể thực hiện"); **không tạo hoa hồng**; xóa việc chi tiết của dịch vụ trên timeline của khách; thông báo `OrderCancelled` cho khách.

Response 200: `{ "data": Order }`. Lỗi: 400 `VALIDATION_ERROR` (thiếu hoặc sai `reason`), 404 `ORDER_NOT_FOUND`, **422 `ORDER_NOT_CANCELLABLE`** (đơn không phải `Deposited`, hoặc đã tới `eventDate`).

### POST /vendors/me/orders/:id/complete

**Hoàn tất.** Chỉ khi `Deposited` và `eventDate` **đã qua** (hôm nay theo giờ Việt Nam lớn hơn `eventDate`). Thành công: `Completed`, ghi `completedDate`, tạo `Commissions` gắn vào bảng kê của tháng chứa `completedDate` (xem [commissions.md](commissions.md)), thêm tin hệ thống "Đơn … đã hoàn thành".

Response 200: `{ "data": Order }`. Lỗi: 404, 409 `ORDER_NOT_COMPLETABLE` (không phải `Deposited`), 409 `ORDER_EVENT_NOT_PASSED`.

### POST /vendors/me/orders/:id/final-invoice

**Xuất hóa đơn cuối** khi khách yêu cầu, mỗi đơn một lần. Chỉ khi `Deposited` hoặc `Completed`. Tạo `Invoices` loại `FinalInvoice`, thêm tin `FinalInvoice` vào hội thoại.

Response 200: `{ "data": Order }` (đã có hóa đơn trong `invoices`). Lỗi: 404, 409 `INVOICE_NOT_AVAILABLE` (đơn chưa cọc, hết hạn hoặc đã hủy), 409 `INVOICE_EXISTS`.

## Mã lỗi riêng

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Nội dung đơn không hợp lệ (`details` theo trường) |
| 400 | `ORDER_NO_CHANGES` | Gửi lại hoặc sửa mà không có thay đổi |
| 400 | `ORDER_TOTAL_BELOW_DEPOSIT` | Sửa sau cọc làm tổng mới nhỏ hơn tiền đã cọc |
| 404 | `ORDER_NOT_FOUND`, `CONVERSATION_NOT_FOUND` | Không có hoặc không thuộc NCC |
| 409 | `WEDDING_NOT_SET` | Khách chưa có thông tin đám cưới, chưa tạo được đơn |
| 409 | `ORDER_NOT_DRAFT` | Lưu nháp đơn không còn là `Draft` |
| 409 | `ORDER_NOT_SENDABLE` | Gửi đơn không ở `Draft`, `Pending`, `NeedRevision` |
| 409 | `ORDER_NOT_EDITABLE` | Sửa sau cọc nhưng đơn không phải `Deposited` |
| 422 | `EVENT_DATE_IN_PAST` | Gửi đơn, Tạo lại đơn hoặc Chỉnh sửa sau cọc với `eventDate` trước hôm nay (giờ VN) |
| 422 | `ORDER_NOT_CANCELLABLE` | Hủy đơn không phải `Deposited`, hoặc đã tới `eventDate` |
| 409 | `ORDER_NOT_COMPLETABLE`, `ORDER_EVENT_NOT_PASSED` | Hoàn thành sai trạng thái, hoặc chưa qua `eventDate` |
| 409 | `INVOICE_NOT_AVAILABLE`, `INVOICE_EXISTS` | Xuất hóa đơn cuối sai trạng thái, hoặc đã xuất |

## Việc backend tự chạy hằng ngày

Theo CSDL mục 9.12 (múi giờ Việt Nam):

1. **Hết hạn đơn:** `Pending` có `depositDueDate` đã qua thì thành `Expired`, thêm tin hệ thống "Đơn … đã hết hạn đặt cọc". (`NeedRevision` không hết hạn vì đang chờ NCC.)
2. **Tự hoàn thành:** `Deposited` mà `eventDate` + 7 ngày đã qua thì thành `Completed`, ghi `completedDate`, tạo hoa hồng, thêm tin hệ thống.
3. Nhắc hoa hồng (xem [commissions.md](commissions.md)).

Mock của FE chạy các việc này mỗi lần đọc dữ liệu, có nút "giả lập thời gian" để thử.

## Không còn trong hợp đồng NCC

Phiên bản đơn (`versions`, v1/v2), đợt thanh toán tùy chỉnh (`installments`), `POST .../payments` (ghi nhận thanh toán), `POST .../adjustments` (phương án điều chỉnh), `paymentStatus` 6 giá trị, `paidAmount`, "phí theo chính sách", liên kết dòng báo giá với gói.

## Việc backend cần thêm cho trang Quản lý đơn hàng

- **Endpoint tổng hợp (summary) cho 4 thẻ số liệu** (ví dụ `GET /vendors/me/orders/summary`). FE hiện tự tính từ danh sách đơn (tối đa 100 đơn mỗi trang), sẽ thiếu số khi NCC có hơn 100 đơn. Trả về: số đơn `Pending` và số đơn sắp hết hạn trong 24 giờ; số đơn `Deposited` có `eventDate` trong [hôm nay, hôm nay + 30 ngày] và tổng giá trị (cùng định nghĩa ở Tổng quan và trang Đơn hàng); số đơn `Deposited` đã qua `eventDate` (cần Hoàn tất); số đơn và tổng giá trị đơn có `Payments` `Paid` và `PaidDate` trong tháng hiện tại (giờ Việt Nam), mọi trạng thái (thẻ "Đặt cọc trong tháng"; bấm vào thì lọc bằng `depositFrom`, `depositTo`).
- Bảng đơn lọc được theo `status`, khoảng `eventDate` (`from`, `to`), và tìm `q` theo mã đơn, tên khách, số điện thoại (đã có ở danh sách đơn). `GET /vendors/me/orders/counts` trả số đơn theo từng trạng thái cho các tab.
