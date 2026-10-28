# API: orders (phía cặp đôi)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/chat.ts`).
> Quy ước chung: [README.md](README.md).
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md` (trạng thái đơn).**

> **Triển khai thật (khớp CSDL Supabase):** đơn hàng, chat, kế hoạch, timeline, hoa hồng đã chạy trên dữ liệu thật. Điểm khác so với bản nháp bên dưới:
> - Mỗi đơn chỉ có **hai đợt**: đặt cọc theo `rate` % (khách trả qua cổng thanh toán) và phần còn lại (khách trả trực tiếp, NCC bấm xác nhận đã thu đủ thì đơn `Completed`, lập hóa đơn và tính hoa hồng).
> - Không có phiên bản đơn (`versions` tối đa 1; gửi lại thì ghi đè và ghi các thay đổi vào tin hội thoại), không có phương án điều chỉnh (`POST .../adjustments` trả 409 `ORDER_NOT_ADJUSTABLE`), không lưu minh chứng thanh toán, không lưu nháp cho đơn đã gửi.
> - Trạng thái: `Draft`→`DRAFT`, `Pending`→`AWAITING_CONFIRMATION` (chờ đặt cọc), `NeedRevision`→`REVISION_REQUESTED`, `Deposited`/`Completed`→`CONFIRMED` (+ `DEPOSIT_PAID`/`PAID`), `Expired`/`Cancelled`→`CANCELLED`. Phía cặp đôi thêm `CANCELLED`.
> - `POST /payments` trả mã QR VietQR; tiền cọc được SePay xác nhận (xem [payments.md](payments.md)).
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

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/vendorChat.ts`; kiểu ở `frontend/src/types/serviceOrder.ts`). Phần này bổ sung, không đổi các endpoint phía cặp đôi ở trên.
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md`**: tên trường, trạng thái đơn, trạng thái thanh toán, phương án điều chỉnh đang suy từ prototype NCC (`docs/prototype/prototype_vendor`, màn Tin nhắn và Quản lý đơn hàng).

Phạm vi: NCC tạo đơn trong hội thoại, lưu nháp, gửi đơn (v1), sửa và gửi lại theo phiên bản (v2, v3…) (trang Tin nhắn); xem danh sách đơn, ghi nhận khoản thu, lập / sửa phương án điều chỉnh, hủy đơn (trang Quản lý đơn hàng). Mọi thao tác đều thêm tin tương ứng vào hội thoại ([chat.md](chat.md) phần Nhà cung cấp).

## Khác với `Order` phía cặp đôi ở trên

Theo quyết định của nhóm, đơn phía NCC theo prototype NCC và đặt ở kiểu mới `ServiceOrder`. `Order` cũ (`frontend/src/types/order.ts`) **giữ nguyên**, phía cặp đôi chuyển dần.

| `Order` (cặp đôi, ở trên) | `ServiceOrder` (NCC) |
|---|---|
| Một `packageName`, `totalAmount`, `depositAmount` | Nhiều `lines` (hạng mục, ĐVT, SL, đơn giá) + nhiều `installments` (đợt thanh toán) |
| Một trạng thái gộp `SENT` / `REVISION_REQUESTED` / `PAID` | `status` (trạng thái đơn) **tách** `paymentStatus` (trạng thái thanh toán) |
| Không có bước khách xác nhận | Khách xác nhận đơn (`CONFIRMED`) trước khi đặt cọc |
| Gửi lại giữ nguyên `id`, không lưu bản cũ | `versions[]`: v1, v2… kèm `changes` |
| | Phương án điều chỉnh sau khi đã xác nhận |

Ánh xạ đề xuất khi phía cặp đôi chuyển sang `ServiceOrder`:

| `Order.status` cũ | `ServiceOrder` |
|---|---|
| `SENT` | `status = AWAITING_CONFIRMATION`, hoặc `CONFIRMED` + `paymentStatus = AWAITING_DEPOSIT` |
| `REVISION_REQUESTED` | `status = REVISION_REQUESTED` |
| `PAID` | `status = CONFIRMED`, `paymentStatus` ∈ `DEPOSIT_PAID`, `PARTIALLY_PAID`, `PAID` |
| `depositAmount` | `installments[0].amount` (đợt đặt cọc) |
| `packageName` | tên dòng đầu (`lines[0].name`) |
| `serviceDate` | `eventDate` của phiên bản hiện hành |

**Thanh toán (kết hợp, theo quyết định của nhóm):** đợt 1 (đặt cọc) khách trả qua VietQR như [payments.md](payments.md), BE tự ghi nhận khi SePay xác nhận đã nhận tiền; các đợt sau trả ngoài hệ thống (chuyển khoản, tiền mặt), NCC tự ghi nhận. `POST /payments` của cặp đôi khi chuyển sang đơn mới lấy số tiền từ `installments[0].amount` và chỉ cho khi `status = CONFIRMED`, đợt cọc chưa thu. **Cần sửa `payments.md` cùng bạn làm phần cặp đôi.**

## Kiểu dữ liệu

`ServiceOrder`

```json
{
  "id": "so-1024",
  "code": "#WP1024",
  "conversationId": "vc-5",
  "status": "AWAITING_CONFIRMATION",
  "paymentStatus": "UNPAID",
  "versions": [
    { "version": 1, "sentAt": "2026-10-12T07:00:00.000Z", "content": "OrderContent", "changes": [], "fromAdjustmentId": null },
    { "version": 2, "sentAt": "2026-10-13T02:10:00.000Z", "content": "OrderContent", "changes": ["Tiệc cưới – Menu A: số lượng 25 → 22 Bàn"], "fromAdjustmentId": null }
  ],
  "draft": null,
  "revisionRequest": null,
  "adjustmentRequest": null,
  "payments": [],
  "adjustments": [],
  "totalAmount": 92200000,
  "paidAmount": 0,
  "history": [{ "at": "2026-10-12T07:00:00.000Z", "text": "Gửi đơn v1 cho khách" }],
  "createdAt": "2026-10-12T07:00:00.000Z",
  "updatedAt": "2026-10-13T02:10:00.000Z"
}
```

`OrderContent` (nội dung một phiên bản, bản nháp, phương án điều chỉnh)

```json
{
  "customerName": "Ngọc Mai & Hoàng Nam",
  "customerPhone": "0923 456 789",
  "eventDate": "2026-12-06",
  "note": "Giữ sảnh Mây tầng 2.",
  "lines": [
    { "id": "l-1", "packageId": "DV101", "name": "Tiệc cưới – Menu A", "unit": "Bàn", "quantity": 22, "unitPrice": 4000000, "isPolicyFee": false }
  ],
  "installments": [
    { "id": "i-1", "name": "Đợt 1 – Đặt cọc", "rate": 20, "amount": 18440000, "dueDate": "2026-10-25", "method": "VIETQR", "note": null },
    { "id": "i-2", "name": "Đợt 2 – Thanh toán còn lại", "rate": 80, "amount": 73760000, "dueDate": "2026-12-06", "method": "CASH", "note": "Thanh toán trong ngày tiệc" }
  ]
}
```

| Trường | Ghi chú |
|---|---|
| `code` | Mã hiển thị, tăng dần toàn hệ thống (`#WP1021`, `#WP1022`…) |
| `lines[].packageId` | Gói đã đăng dùng để điền nhanh (nếu có), xem [catalog.md](catalog.md) phần Nhà cung cấp |
| `lines[].quantity` | Số > 0, có thể lẻ |
| `lines[].isPolicyFee` | Phí theo chính sách (thêm khi điều chỉnh) |
| `installments[0]` | Luôn là đặt cọc, `method = VIETQR` |
| `installments[].rate` | **Số nguyên phần trăm** (0–100, theo README mục 4, nhóm đã chốt); `null` khi nhập số tiền trực tiếp. Số tiền = làm tròn `total × rate / 100`; khi mọi đợt có tỷ lệ và cộng đủ 100%, **đợt cuối nhận phần tiền lẻ còn lại** để tổng các đợt bằng tổng đơn |
| `installments[].method` | `VIETQR` (chỉ đợt 1), `BANK_TRANSFER`, `CASH` |
| `totalAmount`, `paidAmount`, `paymentStatus` | BE tính |
| `draft` | Chỉ NCC thấy. `kind = NEW`: đơn chưa gửi lần nào; `EDIT`: bản sửa của đơn đã gửi, phiên bản đang gửi giữ nguyên |
| `history` | Câu hiển thị sẵn, mới nhất cuối |

`OrderPayment`: `{ id, installmentId, installmentName, amount, paidAt, method, plannedMethod, recordedBy: "SYSTEM" | "VENDOR", proofFile: VendorFile | null, note }`. `method` là **hình thức thanh toán thực tế**: `VIETQR` (khách trả trực tuyến, `recordedBy = SYSTEM`), `BANK_TRANSFER` hoặc `CASH` (khách trả trực tiếp, `recordedBy = VENDOR`). `plannedMethod`: phương thức dự kiến của đợt, để đối chiếu. `proofFile`: ảnh / PDF minh chứng ([vendors.md](vendors.md), upload với `purpose = PAYMENT_PROOF`).
`OrderAdjustment`: `{ id, status, reason, proposedAt, before, after, beforeTotal, afterTotal, paidAmount, customerNote, customerNoteAt, resultVersion, revisionOf, forRequest }` (`before`, `after` là `OrderContent`; `forRequest`: yêu cầu điều chỉnh của khách mà phương án đáp ứng).
`ServiceOrder.cancellation`: `{ reason, cancelledAt }` khi `CANCELLED`, ngược lại `null`.

### Trạng thái đơn (`ServiceOrderStatus`)

| Giá trị | Nhãn FE |
|---|---|
| `DRAFT` | Bản nháp (chưa gửi lần nào) |
| `AWAITING_CONFIRMATION` | Chờ khách xác nhận |
| `REVISION_REQUESTED` | Khách yêu cầu chỉnh sửa |
| `CONFIRMED` | Đã xác nhận |
| `CANCELLED` | Đã hủy |

```
DRAFT ──send──▶ AWAITING_CONFIRMATION ──khách xác nhận──▶ CONFIRMED
                   ▲            │
          send (vN+1)           └──khách yêu cầu sửa──▶ REVISION_REQUESTED
                   └────────────────────────────────────────────┘
```

- Gửi lại (phiên bản mới) chỉ khi `AWAITING_CONFIRMATION` hoặc `REVISION_REQUESTED` và chưa có khoản thu. Đơn `CONFIRMED` thay đổi bằng phương án điều chỉnh.
- Hủy (`CANCELLED`): từ mọi trạng thái khác, **chỉ khi chưa có khoản thu nào** (chưa nhận cọc), cần lý do. Sau khi hủy không sửa, gửi lại, nhận thanh toán, điều chỉnh được nữa.

### Trạng thái thanh toán (`OrderPaymentStatus`)

BE tính từ `payments` (tổng đã thu `paid`, tổng đơn `total`, đợt cọc `installments[0]`):

| Giá trị | Nhãn FE | Khi |
|---|---|---|
| `UNPAID` | Chưa thu tiền | Đơn chưa `CONFIRMED` và chưa thu khoản nào |
| `AWAITING_DEPOSIT` | Chờ thanh toán cọc | `CONFIRMED`, chưa thu |
| `PARTIALLY_PAID` | Đã thu một phần | Đã thu nhưng chưa đủ đợt cọc |
| `DEPOSIT_PAID` | Đã nhận cọc | Đã thu đủ đợt cọc, chưa đủ tổng |
| `PAID` | Đã thu đủ | `paid = total` |
| `OVERPAID` | Thu thừa · cần xử lý hoàn | `paid > total` (sau điều chỉnh giảm) |

### Trạng thái phương án điều chỉnh (`AdjustmentStatus`)

`AWAITING_CONFIRMATION` (Chờ khách xác nhận), `REVISION_REQUESTED` (Khách yêu cầu sửa phương án), `ACCEPTED` (Khách đồng ý, sinh phiên bản mới `fromAdjustmentId`), `SUPERSEDED` (Đã thay thế bởi phương án mới).

## Kiểm tra khi gửi

Lưu nháp không kiểm tra. Gửi (`send`) kiểm tra như prototype, lỗi trả `400 VALIDATION_ERROR` với `details[].field`:

- `customerName` bắt buộc; `customerPhone` 9–15 ký tự số, khoảng trắng, `+().-`; `eventDate` bắt buộc.
- Ít nhất một dòng; mỗi dòng có tên, `quantity > 0`, `unitPrice >= 0`; tổng > 0. Dòng trống hoàn toàn bị bỏ.
- Mỗi đợt: có tên, `amount > 0` và ≤ tổng, `rate` là số nguyên 0–100, có `dueDate`.
- Tổng các đợt **bằng** tổng đơn.
- Gửi lại: phải có ít nhất một thay đổi so với phiên bản đang gửi (`400 ORDER_NO_CHANGES`).

---

### GET /vendors/me/orders
Role: VENDOR

Danh sách đơn của NCC (gồm bản nháp và đơn đã hủy), mã đơn giảm dần. Có phân trang.

| Query | Ghi chú |
|---|---|
| `conversationId` | Đơn của một hội thoại (trang Tin nhắn dùng, lấy hết một trang) |
| `q` | Tìm trong mã đơn, tên khách; từ 3 chữ số thì tìm cả số điện thoại |
| `status` | `ServiceOrderStatus` |
| `paymentStatus` | `OrderPaymentStatus` |
| `from`, `to` | Ngày sự kiện của phiên bản hiện hành (bản nháp: nội dung nháp), `YYYY-MM-DD`, gồm cả hai đầu |
| `page`, `pageSize` | Mặc định 1, 20 |

Response 200: `{ "data": ServiceOrder[], "meta": { … } }`

### GET /vendors/me/orders/counts
Role: VENDOR

Số đơn theo từng trạng thái, không theo bộ lọc (dải đếm đầu trang Quản lý đơn hàng).

Response 200: `{ "data": { "DRAFT": 1, "AWAITING_CONFIRMATION": 2, "REVISION_REQUESTED": 1, "CONFIRMED": 5, "CANCELLED": 1 } }`

### GET /vendors/me/orders/:id
Role: VENDOR

Response 200: `{ "data": ServiceOrder }`

Lỗi: 404 `ORDER_NOT_FOUND`

### POST /vendors/me/orders
Role: VENDOR

Tạo đơn trong hội thoại. `send = false`: lưu nháp (`DRAFT`, `draft.kind = NEW`). `send = true`: kiểm tra và gửi luôn v1 (`AWAITING_CONFIRMATION`), thêm tin `ORDER` vào hội thoại.

Request

```json
{ "conversationId": "vc-1", "content": "OrderContent", "send": true }
```

Response 201: `{ "data": ServiceOrder }`

Lỗi: 400 `VALIDATION_ERROR`, 404 `CONVERSATION_NOT_FOUND`

### PUT /vendors/me/orders/:id/draft
Role: VENDOR

Lưu nháp. Đơn chưa gửi: `draft.kind = NEW`; đơn đã gửi: `draft.kind = EDIT`, phiên bản đang gửi và trạng thái giữ nguyên.

Request `{ "content": OrderContent }`. Response 200: `{ "data": ServiceOrder }`

Lỗi: 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_REVISABLE` (đơn `CONFIRMED`)

### POST /vendors/me/orders/:id/send
Role: VENDOR

Gửi đơn. Chưa có phiên bản: gửi v1 (như `POST` với `send = true`). Đã có: tạo phiên bản mới, tính `changes`, xóa `revisionRequest` và `draft`, `status = AWAITING_CONFIRMATION`; thêm tin `ORDER_RESENT` (SYSTEM) và `ORDER` (phiên bản mới).

Request

```json
{ "content": "OrderContent", "baseVersion": 1 }
```

`baseVersion`: phiên bản hiện hành lúc NCC mở form. Khác phiên bản hiện hành của BE thì từ chối (tránh ghi đè khi đơn vừa đổi).

Response 200: `{ "data": ServiceOrder }`

Lỗi: 400 `VALIDATION_ERROR`, 400 `ORDER_NO_CHANGES`, 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_REVISABLE` (`CONFIRMED`), 409 `ORDER_VERSION_CONFLICT`, 409 `ORDER_HAS_PAYMENTS`

### POST /vendors/me/orders/:id/payments
Role: VENDOR

NCC ghi nhận một khoản khách **trả trực tiếp** (chuyển khoản, tiền mặt) cho một đợt bất kỳ, **kể cả đợt đặt cọc** khi khách không trả qua VietQR. Cọc trả qua VietQR vẫn là cách mặc định và do hệ thống tự ghi nhận ([payments.md](payments.md)), NCC không ghi nhận lại. Chỉ khi `status = CONFIRMED`. Được ghi nhận nhiều lần cho một đợt; vượt số còn phải thu thì đơn thành `OVERPAID`, hệ thống không tự đánh dấu đã hoàn.

Request

```json
{
  "installmentId": "i-2",
  "amount": 64000000,
  "paidAt": "2026-11-22T10:15:00.000Z",
  "method": "CASH",
  "proofFile": { "url": "https://…", "publicId": "…", "fileName": "phieu-thu.jpg", "size": 210000, "mimeType": "image/jpeg" },
  "note": "Người nhận: Thu Mây"
}
```

`method` (hình thức thanh toán): `BANK_TRANSFER` hoặc `CASH`; `VIETQR` chỉ do hệ thống ghi. `proofFile`, `note` tùy chọn (`null`). BE tính lại `paidAmount`, `paymentStatus`, thêm lịch sử và tin `PAYMENT_RECORDED` (SYSTEM) "Đã ghi nhận 64.000.000đ · Đợt 2 – Thanh toán còn lại · Tiền mặt".

Response 200: `{ "data": ServiceOrder }`

Lỗi: 400 `VALIDATION_ERROR` (đợt không có trong phiên bản hiện hành, số tiền ≤ 0, phương thức VietQR), 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_PAYABLE` (chưa `CONFIRMED`)

### POST /vendors/me/orders/:id/adjustments
Role: VENDOR

Lập phương án điều chỉnh đơn đã xác nhận và gửi khách qua chat. Đơn hiện hành giữ nguyên tới khi khách đồng ý (khi đó sinh phiên bản mới `fromAdjustmentId`). Khi đơn đang có `adjustmentRequest` của khách, phương án lưu vào `forRequest` và `adjustmentRequest` về `null`.

Request

```json
{ "reason": "Khách tăng từ 20 lên 22 bàn.", "after": "OrderContent", "revisionOf": null }
```

- `after`: nội dung đơn sau điều chỉnh. Các đợt đã có khoản thu giữ nguyên; phí theo chính sách là một dòng `isPolicyFee = true`.
- `revisionOf`: id phương án khách yêu cầu sửa (`REVISION_REQUESTED`); phương án cũ thành `SUPERSEDED`. `null`: phương án mới, khi đơn chưa có phương án đang chờ.
- Kiểm tra: `reason` bắt buộc; các dòng hợp lệ như khi gửi đơn; nếu tổng mới ≥ số đã thu thì các đợt cộng đủ tổng mới; phải khác đơn hiện hành.

Thêm tin `ADJUSTMENT_PROPOSED` (VENDOR) vào hội thoại.

Response 200: `{ "data": ServiceOrder }`

Lỗi: 400 `VALIDATION_ERROR`, 400 `ORDER_NO_CHANGES`, 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_ADJUSTABLE` (chưa `CONFIRMED`), 409 `ADJUSTMENT_PENDING` (đã có phương án đang chờ khách), 409 `CONFLICT` (phương án `revisionOf` không còn ở `REVISION_REQUESTED`)

### POST /vendors/me/orders/:id/cancel
Role: VENDOR

Hủy đơn khi chưa có khoản thu nào. Body `{ "reason": "Khách chọn nhà hàng khác." }`. BE đặt `status = CANCELLED`, `cancellation`, xóa `draft`, `revisionRequest`, `adjustmentRequest`, phương án đang chờ thành `SUPERSEDED`. Đơn đã gửi khách (có phiên bản) thì thêm tin `ORDER_CANCELLED` (SYSTEM, `text` = lý do).

Response 200: `{ "data": ServiceOrder }`

Lỗi: 400 `VALIDATION_ERROR` (thiếu lý do), 404 `ORDER_NOT_FOUND`, 409 `ORDER_HAS_PAYMENTS`, 409 `CONFLICT` (đã hủy)

## Mã lỗi riêng (phía NCC)

| HTTP | `code` | Khi nào |
|---|---|---|
| 400 | `ORDER_NO_CHANGES` | Gửi lại mà nội dung không đổi |
| 404 | `ORDER_NOT_FOUND` | Không có hoặc của NCC khác |
| 409 | `ORDER_NOT_REVISABLE` | Sửa / gửi lại đơn đã `CONFIRMED` |
| 409 | `ORDER_VERSION_CONFLICT` | `baseVersion` không còn là phiên bản hiện hành |
| 409 | `ORDER_HAS_PAYMENTS` | Gửi lại hoặc hủy đơn đã có khoản thu |
| 409 | `ORDER_NOT_PAYABLE` | Ghi nhận thanh toán cho đơn chưa `CONFIRMED` |
| 409 | `ORDER_NOT_ADJUSTABLE` | Điều chỉnh đơn chưa `CONFIRMED` |
| 409 | `ADJUSTMENT_PENDING` | Lập phương án mới khi đã có phương án đang chờ khách |

## Chưa có

- Phía cặp đôi: xác nhận đơn, yêu cầu chỉnh sửa theo phiên bản (thay `POST /orders/:id/revision-requests` ở trên), đề nghị điều chỉnh, đồng ý / yêu cầu sửa phương án. Trong mock, các việc này giả lập bằng nút "Giả lập khách" ở trang Tin nhắn NCC.

## Khác biệt với prototype NCC

- Đợt 1 (đặt cọc) luôn qua VietQR theo quyết định thanh toán kết hợp; prototype cho chọn Chuyển khoản / Tiền mặt cho mọi đợt.
- Bỏ nút đính kèm tệp trong ô soạn tin (prototype chỉ ghi tên tệp vào tin, chưa có upload).
- Bỏ ô chọn khách khi tạo đơn ngoài chat ("Thêm đơn hàng" ở trang đơn hàng): đơn luôn tạo trong một hội thoại.
- Tỷ lệ đợt là số nguyên (prototype cho số lẻ, có nút "Dồn vào đợt cuối"); đợt cuối tự nhận phần tiền lẻ.
- Ghi nhận thanh toán có thêm tệp minh chứng và hình thức thanh toán; cọc mặc định qua VietQR (hệ thống ghi nhận), NCC chỉ ghi nhận cọc khi khách trả trực tiếp.
- Thêm luồng hủy đơn (prototype chỉ có nhãn "Đã hủy").
