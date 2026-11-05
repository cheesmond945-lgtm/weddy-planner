# API: orders (phía cặp đôi)

> **Đã làm ở backend** (`backend/src/modules/orders`, cập nhật 27/10/2026), đúng với `docs/database.md`, [THE_DON_HANG.md](THE_DON_HANG.md) và [THE_DON_PHIA_KHACH.md](../THE_DON_PHIA_KHACH.md). Thay hoàn toàn bản nháp cũ (trạng thái `SENT/PAID`, mã `#001`, `planItemId`).
> Quy ước chung: [README.md](README.md). Role: **Couple**, chỉ thấy đơn của mình và **không thấy bản nháp** (`Draft` trả 404).
> Khách và NCC dùng **cùng một DTO `Order`** (mô tả ở phần Nhà cung cấp bên dưới, kiểu `frontend/src/types/vendorOrder.ts`), thêm hai trường để khách mở trang dịch vụ và hiện tên NCC: `serviceId` (`VendorProfiles.Id`) và `vendorName`. Trạng thái trả thô như CSDL: `Draft`, `Pending`, `NeedRevision`, `Deposited`, `Completed`, `Expired`, `Cancelled`.

**Hai giai đoạn (cập nhật 28/10/2026):** trước cọc (`Pending`, `NeedRevision`) khách có Thanh toán cọc (chỉ `Pending`) và Yêu cầu chỉnh sửa (chỉ `Pending`). Sau cọc (`Deposited`, còn trước `eventDate`) khách **vẫn gửi được Yêu cầu chỉnh sửa**, đơn giữ `Deposited` và **tiền cọc không đổi**; NCC áp dụng bằng `PATCH` hoặc từ chối. **Khách không có API hủy đơn** (muốn hủy thì nhắn NCC; quy tắc hoàn cọc khi hủy gần ngày chưa chốt). Hai đợt thanh toán: đợt 1 cọc (tối thiểu 10%) qua VietQR trong 12 giờ, đợt 2 phần còn lại trả tiền mặt trực tiếp cho NCC, ngoài hệ thống.

### GET /orders
**Đơn của khách** (trang Kế hoạch của tôi `/plan`, hiện dưới từng hạng mục): mọi đơn đã gửi của khách, **không có bản nháp**, mới nhất trước (tối đa 200). Lọc tùy chọn `?status=` (một trong 6 trạng thái trừ `Draft`; sai thì 400). Mỗi `Order` có thêm `category: { id, slug, name }` (lĩnh vực của NCC) để FE nhóm theo hạng mục. Trước khi đọc, backend quét hết hạn / tự hoàn thành riêng đơn của khách.

Response 200: `{ "data": Order[] }`. NCC gọi thì 403.

### GET /orders/:id
Response 200: `{ "data": Order }`. Lỗi: 404 `ORDER_NOT_FOUND` (không có, không phải của khách, hoặc đang là `Draft`).

Trước khi đọc, backend tự đưa đơn `Pending` quá hạn cọc sang `Expired` và đơn `Deposited` có `eventDate < hôm nay − 7` (quá ngày thực hiện hơn 7 ngày) sang `Completed` (chỉ riêng đơn của khách này, xem mục "Việc theo thời gian" ở phần NCC).

### POST /orders/:id/revision-requests
**Yêu cầu chỉnh sửa: khi `Pending`, hoặc khi `Deposited` còn trước `eventDate` và chưa có yêu cầu đang chờ.** Body:

```json
{ "changes": ["Quantity", "EventDate"], "note": "Giảm từ 20 xuống 15 bàn và dời sang 25/04 được không ạ?" }
```

- `changes` **tùy chọn**: các ô khách chọn, giá trị trong `Item` (Đổi hạng mục), `Quantity` (Đổi số bàn, chỉ đơn trung tâm tiệc cưới đặt theo bàn), `EventDate` (Đổi ngày thực hiện), `Other` (Khác). Lưu vào `OrderRevisionChanges`.
- `note` **bắt buộc**: nội dung chi tiết, lưu `OrderRevisions.RequestNote`.
- Thành công: tạo `OrderRevisions` (`BeforeDeposit`, `Requested`, `OldTotalAmount` = tổng hiện tại); đơn `Pending` → `NeedRevision` (hạn cọc tạm dừng, đơn không hết hạn khi chờ NCC); thêm **một tin hệ thống** vào chat (không thêm tin riêng của khách): `Khách yêu cầu chỉnh sửa đơn {OrderCode}: {nội dung chọn, nối bằng ", "} · "{note}"` (thiếu phần nào thì bỏ phần đó); báo NCC (`OrderRevisionRequested`). Phía khách hiển thị "Bạn đã yêu cầu chỉnh sửa đơn …".

- **Sau cọc** (`Deposited`): tạo `OrderRevisions` `AfterDeposit` / `Requested`, đơn **giữ `Deposited`**, tin hệ thống có thêm "(đã đặt cọc, tiền cọc giữ nguyên)". NCC áp dụng bằng `PATCH /vendors/me/orders/:id` (yêu cầu thành `Applied`) hoặc từ chối bằng `POST /vendors/me/orders/:id/revision-requests/reject` (thành `Rejected`). Mỗi lúc chỉ một yêu cầu đang chờ.

Response 200: `{ "data": Order }`. Lỗi: 400 `VALIDATION_ERROR` (`details.note` thiếu nội dung, `details.changes` sai giá trị), 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_REVISABLE` (đơn đang `NeedRevision`; đơn đã cọc nhưng đã đến ngày thực hiện hoặc đang có yêu cầu chờ NCC; đơn hết hạn, hủy, hoàn thành).

### Đặt cọc
Xem [payments.md](payments.md): `POST /payments`.

### GET /conversations (liên quan đơn)
Mỗi hội thoại của khách có `latestOrder` = đơn đã gửi mới nhất với NCC đó (bỏ bản nháp): `{ "id", "orderCode", "status", "depositDueDate" }` hoặc `null`. Giao diện dùng cho nhãn Chờ cọc / Chờ chỉnh sửa / Đã cọc / Hoàn thành / Hết hạn / Đã hủy (chấm đỏ khi `Pending` còn dưới 6 giờ). Xem [chat.md](chat.md).

---

# Phía Nhà cung cấp: đơn dịch vụ

> **Hợp đồng theo CSDL** (`docs/database.md`, mục 4.19 đến 4.24 và 9.5 đến 9.8), `docs/CHOT_NGHIEP_VU_NCC.md` mục 4, và `docs/api/THE_DON_HANG.md` (nội dung thẻ, nút). Khi mâu thuẫn, theo thứ tự đó.
> Bản này **thay thế hoàn toàn** bản cũ có phiên bản đơn v1/v2, đợt thanh toán tùy chỉnh, "ghi nhận thanh toán", phương án điều chỉnh. Frontend (`frontend/src/mocks/vendorOrders.ts`) và **backend (`backend/src/modules/orders`, 27/10/2026)** đều làm đúng theo tài liệu này. Mã HTTP: tạo đơn `201`; gửi/cập nhật, sửa, hủy, hoàn tất, xuất hóa đơn `200`. Phần còn chờ: endpoint `summary` (xem `LECH_FE_BE.md`).
> Quy ước chung: [README.md](README.md). Role: **VENDOR**, chỉ thấy đơn của mình. JSON dùng camelCase, giá trị enum viết đúng như CSDL (`Pending`, `Deposited`…).

### Đổi số khách khi tiệc đã cọc

Đơn tiệc (tính theo bàn: có sảnh, hoặc dòng đơn vị bàn/mâm), trạng thái Deposited, hôm nay ≤ ngày thực hiện − 7 ngày (`GUEST_CHANGE_CUTOFF_DAYS`). Phép tính: `backend/src/modules/orders/order-adjustment-rules.ts` (test: `backend/test/order-adjustment-rules.test.cjs`). Cần `prisma/manual/2026-11-02-02-order-adjustments.sql` (chưa chạy: 503 `DB_MIGRATION_PENDING`).

- Giá trị đơn mới = giá trị cũ − dòng tiền bàn + **đơn giá lúc đặt** × max(⌈số khách mới / 10⌉, số bàn tối thiểu của sảnh); số bàn tối thiểu không vượt số bàn đã thỏa thuận trong đơn (sảnh tăng tối thiểu sau khi đặt). Giảm khách không hoàn cọc (giá trị mới không thấp hơn số đã cọc).
- Cọc bổ sung = 10% phần tăng (`EXTRA_DEPOSIT_RATE`). Hoa hồng tính trên giá trị đơn cuối cùng (lúc hoàn thành).
- Số khách mới vượt sức chứa của sảnh: 409 `GUEST_CHANGE_CAPACITY`. Quá hạn: 409 `GUEST_CHANGE_CUTOFF`. Trùng số khách hiện tại: 409 `GUEST_CHANGE_SAME`. Đã có yêu cầu đang chờ: 409 `GUEST_CHANGE_PENDING`.
- Trạng thái (`order_adjustments.status`): `AwaitingVendor` Chờ NCC xác nhận → (tăng giá trị) `AwaitingDeposit` Chờ nộp cọc bổ sung → `Applied` Đã áp dụng; hoặc `Rejected` Bị từ chối. Giảm hoặc giữ giá trị: NCC đồng ý là áp dụng ngay.
- Áp dụng: dòng tiền bàn = đơn giá × số bàn tính tiền mới; `total_amount`, `deposit_amount` (+ cọc bổ sung), `guest_count` của đơn; số khách dự kiến của đám cưới; một dòng lịch sử chỉnh sửa (AfterDeposit, Quantity). Đơn đã đổi giá trị từ lúc khách gửi (NCC sửa đơn): 409 `ADJUSTMENT_OUTDATED`, khách gửi lại.

| Phía | Endpoint |
|---|---|
| Khách | `GET /orders/:id/guest-changes/quote?guestCount=` xem trước `{ oldTables, newTables, chargedTables, oldAmount, newAmount, extraDeposit, deadline }` |
| Khách | `POST /orders/:id/guest-changes` `{ guestCount, note? }` |
| Khách | `POST /orders/:id/guest-changes/pay` mã VietQR cọc bổ sung (nội dung `EVBS` + 8 ký tự đầu id yêu cầu); `POST …/pay/check` hỏi SePay; `POST …/pay/demo-confirm` (chế độ thử) |
| NCC | `POST /vendors/me/orders/:id/guest-changes/approve`, `POST /vendors/me/orders/:id/guest-changes/reject` `{ note? }` |

### Khách yêu cầu hủy đơn đã cọc

- `POST /orders/:id/cancel-requests` `{ note? }`: đơn Deposited, còn trước ngày thực hiện. Tiền cọc không hoàn. Ghi `orders.cancel_requested_date`, `cancel_request_note`; báo NCC. Đã gửi rồi: 409 `CANCEL_ALREADY_REQUESTED`.
- `DELETE /orders/:id/cancel-requests`: khách rút yêu cầu.
- NCC đồng ý: `POST /vendors/me/orders/:id/cancel` với `reason = CUSTOMER_REQUEST` (đơn Cancelled, không hoa hồng, cọc tính là khoản mất trong tab Ngân sách, hạng mục trở về chưa chọn). NCC từ chối: `POST /vendors/me/orders/:id/cancel-requests/reject` `{ note? }`, đơn giữ nguyên.
- `Order` có thêm `guestCount`, `cancelRequest { requestedDate, note } | null`, `guestChanges[]` (mới nhất trước).

## Quy tắc nghiệp vụ (tóm tắt)

- **7 trạng thái:** `Draft` → `Pending` → (`NeedRevision` ↔ `Pending`) → `Deposited` → `Completed`; `Pending` quá hạn thành `Expired`; `Deposited` bị **NCC hủy** (trước `eventDate`) thành `Cancelled`.
- **Chỉ một khoản trong hệ thống: tiền cọc qua VietQR** (`Payments`). Phần còn lại khách trả **tiền mặt trực tiếp cho NCC, ngoài hệ thống, không ghi nhận**. Không có nhiều đợt, không có "ghi nhận thanh toán", không có "đã thu / còn phải thu".
- **Hai giai đoạn.** Trước cọc: khách Thanh toán cọc, Yêu cầu chỉnh sửa; NCC Chỉnh sửa đơn. Sau cọc (`Deposited`): khách **Yêu cầu chỉnh sửa** được (trước `eventDate`, `AfterDeposit` / `Requested`, đơn vẫn `Deposited`, tiền cọc giữ nguyên), không hủy; **NCC Chỉnh sửa** (áp dụng yêu cầu nếu có), **Từ chối yêu cầu**, hoặc **Hủy đơn**.
- **Mỗi hạng mục tối đa MỘT đơn `Deposited` cùng lúc** (một đám cưới, tính theo hạng mục của NCC, không phân biệt NCC). Khách đặt cọc đơn thứ hai cùng hạng mục, hoặc NCC Gửi / Cập nhật / Tạo lại đơn khi hạng mục đã có đơn `Deposited` khác, đều bị chặn `409 CATEGORY_ALREADY_DEPOSITED`; muốn đổi NCC thì NCC cũ hủy đơn trước. Đơn `Completed` không giữ chỗ; lưu nháp không bị chặn. Kiểm tra cả trong transaction ghi nhận cọc (khóa theo đám cưới + hạng mục) để hai khoản cọc song song không cùng thành công.
- **NCC hủy đơn:** chỉ khi `Deposited` và hôm nay (giờ VN) **nhỏ hơn** `eventDate` (xem `POST …/cancel`). Đơn `Pending` không cọc thì tự `Expired`, không hủy được.
- Đơn `Expired` và `Cancelled` bị khóa. Muốn tiếp tục: NCC tạo **đơn mới** (mã mới) bằng cách chép hạng mục và ghi chú (FE gọi `POST /vendors/me/orders`, không có endpoint riêng).
- **Backend tính tiền**, không tin số tiền từ giao diện:
  - `OrderItems.amount = quantity × unitPrice`; `totalAmount = SUM(amount)`.
  - `depositAmount = totalAmount × depositPercent / 100`, **làm tròn gần nhất đến 1.000đ, TỐI THIỂU 100.000đ** (cọc 0đ thì khách không thanh toán được qua VietQR). Chờ nhóm xác nhận, xem mục "Chưa chốt" của CHOT; FE dùng đúng công thức này (`frontend/src/lib/deposit.ts`), backend làm giống hệt.
  - **Tổng đơn quá nhỏ để đặt cọc:** nếu `depositAmount` (đã làm tròn, tối thiểu) **lớn hơn hoặc bằng** `totalAmount` thì không cho Gửi đơn (`400 VALIDATION_ERROR`, `details.deposit` = "Tổng đơn quá nhỏ để đặt cọc."). Lưu nháp vẫn được. Không kiểm khi Chỉnh sửa sau cọc (tiền cọc đã khóa).
  - `depositDueDate` = thời điểm gửi đơn + 1 ngày (24 giờ).
  - NCC chỉ nhập: hạng mục, `depositPercent`, `eventDate`, `note` (cùng tên và số điện thoại khách, điền sẵn từ tài khoản khách).
- `depositPercent`: **tối thiểu 10** và nhỏ hơn 100 khi Lưu nháp, Gửi đơn và Chỉnh sửa đơn (sửa sau cọc giữ tỷ lệ đã chốt, không kiểm) (`400 VALIDATION_ERROR`, `details.depositPercent` = "Tỷ lệ đặt cọc tối thiểu 10%."). Lưu nháp không chặn; Chỉnh sửa sau cọc giữ tỷ lệ đã chốt. FE chỉ cho nhập số nguyên 10 đến 99.
- "Tạo lại đơn" (đơn `Expired`/`Cancelled`): FE chép **toàn bộ** thông tin đơn cũ (cả ngày thực hiện nếu chưa qua) sang đơn mới, mã mới, hạn cọc 12 giờ mới.
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
| (không có) | Không có phiên bản v1/v2, không có đợt, không có "đã thu". Hạn chót trả nốt là `eventDate` (khách trả sớm lúc nào cũng được; quá hạn khách và NCC tự thỏa thuận, hệ thống không quản lý trả muộn), FE suy từ `eventDate` |

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

`OrderContent` có thêm `packageId` (sảnh, uuid hoặc `null`) cho **Trung tâm tiệc cưới**; dịch vụ khác gửi lên cũng bị bỏ qua. `Order` trả `package: { id, name } | null`. Lịch bận theo sảnh: [../LICH_BAN_SANH.md](../LICH_BAN_SANH.md).

## Kiểm tra

| Khi | Quy tắc |
|---|---|
| Lưu nháp (tạo, `PUT draft`) | **Bắt buộc `eventDate`** (cột `NOT NULL`, backend không tự đặt ngày hôm nay). Các trường khác được để trống; `depositPercent` trống thì mặc định 30; `customerPhone` trống thì lưu chuỗi rỗng |
| Gửi đơn (`send`) | Đủ `customerName`, `customerPhone` (9 đến 15 ký tự gồm số, khoảng trắng, `+ ( ) . -`), `eventDate`, ít nhất một hạng mục (`itemName` không rỗng, `quantity` nguyên > 0, `unitPrice` ≥ 0), `totalAmount` > 0, `depositPercent` lớn hơn 0 và nhỏ hơn 100 |
| Chỉnh sửa đơn / Chỉnh sửa sau cọc | Như gửi đơn, và phải có thay đổi so với nội dung hiện tại |
| **Ngày sự kiện** (Gửi đơn, Tạo lại đơn, Chỉnh sửa sau cọc) | `eventDate` phải **từ hôm nay trở đi** (giờ Việt Nam), nếu không trả **`422 EVENT_DATE_IN_PAST`** (`details.eventDate`). Chỉnh sửa đơn hoặc Chỉnh sửa mà **giữ nguyên** `eventDate` đang có của đơn thì không kiểm (đơn đã qua ngày vẫn sửa được hạng mục để Hoàn tất). **Lưu nháp không chặn.** |
| **Sảnh** (Trung tâm tiệc cưới: Gửi đơn, Chỉnh sửa đơn, Tạo lại đơn, Chỉnh sửa sau cọc) | Bắt buộc `packageId` là gói của chính NCC (`400 VALIDATION_ERROR`, `details.packageId`), gói đang đăng (giữ được sảnh đơn đang có dù đã ẩn). Sảnh **bận** ngày `eventDate` (đơn khác Đã cọc / Hoàn thành cùng sảnh, hoặc NCC đánh dấu bận) thì **`409 HALL_BUSY`**. Chỉnh sửa sau cọc mà giữ nguyên sảnh và ngày thì không kiểm lại. Lưu nháp chỉ kiểm sảnh thuộc NCC. |
| **Ngày thực hiện so với ngày cưới** (Gửi đơn, Chỉnh sửa đơn, Tạo lại đơn, Chỉnh sửa sau cọc) | `eventDate` **không được sau ngày cưới của khách** (`Weddings.WeddingDate`), nếu không **`422 EVENT_DATE_AFTER_WEDDING`** (`details.eventDate`, `details.weddingDate`). Gửi hoặc Chỉnh sửa đơn khi ngày cưới của khách đã qua hoặc là hôm nay: **`409 WEDDING_DATE_PASSED`**. Chỉnh sửa sau cọc mà **giữ nguyên** `eventDate` đang có (đơn cũ lệch ngày) thì không kiểm; Chỉnh sửa đơn `Pending` / `NeedRevision` **không** được miễn (khách chưa cọc, NCC phải sửa). Khách **đặt cọc** cũng bị kiểm lại (`409 EVENT_DATE_AFTER_WEDDING`) phòng khi khách đổi ngày cưới sau lúc đơn được gửi. **Lưu nháp không chặn.** DTO đơn và hội thoại NCC (`customer.weddingDate`) trả ngày cưới để form điền sẵn. |

Lỗi kiểm tra trả `400 VALIDATION_ERROR` với `details` theo trường: `customerName`, `customerPhone`, `eventDate`, `depositPercent`, `items`, `items.<i>.itemName`, `items.<i>.quantity`, `items.<i>.unitPrice`.

## Endpoint

### GET /vendors/me/orders

Query: `q` (mã đơn, tên khách, số điện thoại), `status` (một trạng thái, hoặc nhiều trạng thái ngăn bằng dấu phẩy, ví dụ `Expired,Cancelled` cho tab Hết hạn / Hủy), `from`, `to` (ngày thực hiện `YYYY-MM-DD`, gồm hai đầu), `needsAction=1` (đơn `NeedRevision`, hoặc `Deposited` có yêu cầu chỉnh sửa của khách đang chờ), `restPending=1` (đơn `Deposited` / `Completed` mà đợt 2 tiền mặt chưa ghi nhận), `depositFrom`, `depositTo` (ngày cọc `Payments.PaidDate`, giờ VN, `YYYY-MM-DD`, gồm hai đầu; còn hỗ trợ ở API nhưng giao diện không còn dùng), `conversationId`, `page`, `pageSize` (mặc định 20, tối đa 100). Sắp xếp `createdDate` giảm dần. Gồm cả bản nháp.

Response 200: `{ "data": Order[], "meta": { page, pageSize, total, totalPages } }`

### GET /vendors/me/orders/counts

Số đơn theo từng trạng thái và số liệu 4 thẻ đầu trang Quản lý đơn hàng, tính trên toàn bộ đơn của NCC, không phụ thuộc bộ lọc.

Response 200:

```json
{ "data": { "Draft": 1, "Pending": 2, "NeedRevision": 1, "Deposited": 3, "Completed": 4, "Expired": 1, "Cancelled": 1,
  "tiles": { "pending": 2, "expiringSoon": 1, "needsAction": 2, "upcoming": 1, "upcomingValue": 7900000, "dueToComplete": 1, "dueRestPending": 1 } } }
```

`tiles`: `pending` = đơn Chờ cọc, `expiringSoon` = trong đó hạn cọc còn dưới 6 giờ; `needsAction` = `NeedRevision` + `Deposited` có yêu cầu chỉnh sửa đang chờ; `upcoming` / `upcomingValue` = `Deposited` có `eventDate` trong [hôm nay, hôm nay + 30 ngày] và tổng giá trị; `dueToComplete` = `Deposited` đã qua `eventDate`, `dueRestPending` = trong đó đợt 2 tiền mặt chưa ghi nhận. Bấm thẻ thì giao diện lọc danh sách: `status=Pending` · `needsAction=1` · `status=Deposited&from&to` · `status=Deposited&to=hôm qua`.

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
- `Pending` / `NeedRevision` ("Chỉnh sửa đơn"): lưu nội dung mới; nếu có `OrderRevisions` `Requested` thì thành `Applied` (ghi `newTotalAmount`, `appliedDate`), nếu NCC tự sửa thì tạo luôn dòng `Applied`; tính lại `totalAmount`, `depositAmount`; đơn về `Pending`; **đặt lại `depositDueDate` = +1 ngày**; thêm một tin `Order` mới (thẻ mới).
- Phải có thay đổi so với nội dung hiện tại (trừ `Draft`).

Response 200: `{ "data": Order }`. Lỗi: 400 `VALIDATION_ERROR`, 400 `ORDER_NO_CHANGES`, 404, 409 `ORDER_NOT_SENDABLE` (đơn `Deposited`, `Completed`, `Expired`, `Cancelled`).

### PATCH /vendors/me/orders/:id

**Sửa đơn sau cọc** (`Deposited`). Body: `{ "content": OrderContent, "changeNote": "Tăng từ 20 lên 22 bàn theo yêu cầu của khách." }`. `changeNote` bắt buộc (khách thấy), lỗi `400 VALIDATION_ERROR` nếu rỗng.

- Sửa được: hạng mục, `eventDate`, `note`. **Khóa** `depositPercent` và `depositAmount` (giá trị gửi lên bị bỏ qua); `customerName`, `customerPhone` giữ nguyên.
- `totalAmount` mới phải lớn hơn hoặc bằng `depositAmount` đã cọc.
- Ghi `OrderRevisions` loại `AfterDeposit` trạng thái **`Applied` luôn** (`requestNote` = `changeNote`, `oldTotalAmount` → `newTotalAmount`, `appliedDate`). Khách đang có yêu cầu `AfterDeposit` / `Requested` thì yêu cầu đó cũng thành `Applied`. Thêm một tin `Order` (thẻ cập nhật). Đơn **vẫn** `Deposited`.
- Tiền còn phải trả = `totalAmount` mới trừ `depositAmount` (ví dụ đơn 10 triệu, cọc 1 triệu, sửa lên 12 triệu thì còn 11 triệu).

Response 200: `{ "data": Order }`. Lỗi: 400 `VALIDATION_ERROR`, 400 `ORDER_NO_CHANGES`, 400 `ORDER_TOTAL_BELOW_DEPOSIT`, 404, 409 `ORDER_NOT_EDITABLE` (không phải `Deposited`).

### POST /vendors/me/orders/:id/revision-requests/reject

**Từ chối yêu cầu chỉnh sửa của khách với đơn đã cọc.** Body `{ "note"?: string }` (lý do, chỉ vào tin hệ thống, không lưu cột). Yêu cầu `AfterDeposit` / `Requested` thành `Rejected`; đơn giữ nguyên; tin hệ thống "NCC đã từ chối yêu cầu chỉnh sửa đơn …"; báo khách (`OrderRevisionRejected`). Khách gửi được yêu cầu mới sau đó.

Response 200: `{ "data": Order }`. Lỗi: 404, 409 `REVISION_NOT_FOUND` (không phải `Deposited` hoặc không có yêu cầu đang chờ).

### POST /vendors/me/orders/:id/cancel

**NCC hủy đơn đã cọc.** Chỉ khi `Deposited` và hôm nay (giờ Việt Nam) nhỏ hơn `eventDate`.

```json
{ "reason": "CUSTOMER_REQUEST", "note": "Khách báo không tổ chức nữa." }
```

- `reason` bắt buộc: `CUSTOMER_REQUEST` (khách yêu cầu hủy, khách mất cọc) hoặc `VENDOR_UNABLE` (NCC không thể thực hiện, NCC hoàn cọc cho khách ngoài hệ thống). `note` tùy chọn: ghi chú cho khách, **chỉ đưa vào nội dung tin hệ thống trong chat, KHÔNG lưu cột** (CSDL không có `Orders.CancelNote`, nhóm đã bỏ cột này ngày 27/10/2026).
- Thành công: `Deposited` → `Cancelled`, ghi `cancelledDate`, `cancelReason`; thêm tin hệ thống vào chat `NCC đã hủy đơn {OrderCode} · Lý do: {nhãn lý do}[ · {note}]` (nhãn: "Khách yêu cầu hủy" / "NCC không thể thực hiện"); **không tạo hoa hồng**; xóa việc chi tiết của dịch vụ trên timeline của khách; thông báo `OrderCancelled` cho khách.

Response 200: `{ "data": Order }`. Lỗi: 400 `VALIDATION_ERROR` (thiếu hoặc sai `reason`), 404 `ORDER_NOT_FOUND`, **422 `ORDER_NOT_CANCELLABLE`** (đơn không phải `Deposited`, hoặc đã tới `eventDate`).

### POST /vendors/me/orders/:id/complete

**Hoàn tất.** Chỉ khi `Deposited` và `eventDate` **đã qua** (hôm nay theo giờ Việt Nam lớn hơn `eventDate`). Thành công: `Completed`, ghi `completedDate`, tạo `Commissions` gắn vào bảng kê của tháng chứa `completedDate` (xem [commissions.md](commissions.md)), thêm tin hệ thống "Đơn … đã hoàn thành".

Response 200: `{ "data": Order }`. Lỗi: 404, 409 `ORDER_NOT_COMPLETABLE` (không phải `Deposited`), 409 `ORDER_EVENT_NOT_PASSED`.

### POST /vendors/me/orders/:id/final-invoice

**Xuất hóa đơn cuối** khi khách yêu cầu, mỗi đơn một lần. Chỉ khi `Deposited` hoặc `Completed`. Tạo `Invoices` loại `FinalInvoice`, thêm tin `FinalInvoice` vào hội thoại.

Response 200: `{ "data": Order }` (đã có hóa đơn trong `invoices`). Lỗi: 404, 409 `INVOICE_NOT_AVAILABLE` (đơn chưa cọc, hết hạn hoặc đã hủy), 409 `INVOICE_EXISTS`.

### GET /vendors/me/orders/:id/tasks, PATCH /vendors/me/orders/:id/tasks/:taskId, GET /vendors/me/orders/progress

**Tiến độ đơn** (việc chi tiết của đơn trên timeline khách, dùng chung dữ liệu). `GET :id/tasks` trả `{ items, progress }`, mỗi việc có `owner` (`CUSTOMER` / `VENDOR` / `BOTH`), `canTick`, `overdue`. `PATCH :id/tasks/:taskId` body `{ isDone: boolean }`: chỉ việc của NCC hoặc hai bên (khác: `403 TIMELINE_ITEM_READONLY`), chỉ khi đơn `Deposited` (`409 ORDER_NOT_ACTIVE`); khách nhận thông báo `TaskUpdated` khi việc xong. `GET progress` trả `{ [orderId]: { total, done, next, open, overdueVendor, overdueCustomer, dueSoonVendor } }` (`next` = việc chưa xong gần hạn nhất của NCC `{ due, title }` hoặc `null`) cho nhãn "Trễ tiến độ" và thẻ "Theo đơn" của lịch. Quy tắc và nhắc hạn: [../TIMELINE.md](../TIMELINE.md) mục 8.

### GET /vendors/me/orders/tasks

**Bảng việc** (kanban ở Lịch làm việc): mọi việc chi tiết của các đơn `Deposited` của NCC trong một lần gọi. Trả `{ items }`, mỗi việc có các trường như `GET :id/tasks` (`id, title, dueDate, isDone, completedDate, owner, canTick, overdue`) cộng thông tin đơn `orderId, orderCode, customerName, eventDate`. Kéo thả trên bảng dùng `PATCH :id/tasks/:taskId`. Xem [../TIMELINE.md](../TIMELINE.md) mục 9.2.

### GET /vendors/me/orders/calendar

Lịch làm việc của NCC: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (tối đa 100 ngày; thiếu, sai định dạng, `from` sau `to` hoặc quá 100 ngày là `400 VALIDATION_ERROR`). Trả `{ items }` sắp theo ngày: mốc `ORDER` (ngày thực hiện của đơn Chờ cọc / Chờ chỉnh sửa / Đã cọc / Hoàn thành) và `TASK` (việc chi tiết của đơn Đã cọc, có `owner`, `canTick`, `overdue`). Xem [../TIMELINE.md](../TIMELINE.md) mục 9.

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
| 409 | `HALL_BUSY` | Trung tâm tiệc cưới: sảnh của đơn đã bận ngày thực hiện, khi NCC Gửi / Cập nhật / Tạo lại / Chỉnh sửa (đổi sảnh hoặc ngày) hoặc khách đặt cọc (`POST /payments`). NCC thấy nguồn (mã đơn, lý do đã ghi); khách chỉ thấy sảnh không nhận ngày đó. Chưa đổi gì. Đã thu cọc qua VietQR mà sảnh vừa bận (hai khách cọc cùng lúc): không ghi nhận, trang quay về báo liên hệ hoàn tiền |
| 409 | `CATEGORY_ALREADY_DEPOSITED` | Gửi / Cập nhật / Tạo lại đơn (có `send`) khi hạng mục của khách đã có đơn `Deposited` khác. Khách đặt cọc đơn thứ hai cùng hạng mục cũng trả mã này (`POST /payments`, xem payments.md). Chưa tạo / đổi gì |
| 409 | `ORDER_NOT_EDITABLE` | Sửa sau cọc nhưng đơn không phải `Deposited` |
| 422 | `EVENT_DATE_IN_PAST` | Gửi đơn, Tạo lại đơn hoặc Chỉnh sửa sau cọc với `eventDate` trước hôm nay (giờ VN) |
| 422 | `EVENT_DATE_AFTER_WEDDING` | Gửi / Cập nhật / Tạo lại / Chỉnh sửa sau cọc với `eventDate` sau ngày cưới của khách. Khách đặt cọc đơn có `eventDate` sau ngày cưới (409, `POST /payments`) cũng trả mã này |
| 409 | `WEDDING_DATE_PASSED` | Gửi hoặc Chỉnh sửa đơn khi ngày cưới của khách đã qua hoặc là hôm nay: nhắn khách cập nhật ngày cưới |
| 422 | `ORDER_NOT_CANCELLABLE` | Hủy đơn không phải `Deposited`, hoặc đã tới `eventDate` |
| 409 | `ORDER_NOT_COMPLETABLE`, `ORDER_EVENT_NOT_PASSED` | Hoàn thành sai trạng thái, hoặc chưa qua `eventDate` |
| 409 | `INVOICE_NOT_AVAILABLE`, `INVOICE_EXISTS` | Xuất hóa đơn cuối sai trạng thái, hoặc đã xuất |

## Việc theo thời gian (hết hạn cọc, tự hoàn thành)

Theo CSDL mục 9.12 (múi giờ Việt Nam). Cả hai việc **idempotent**: chỉ xử lý dòng thật sự đổi trạng thái (cập nhật có điều kiện theo trạng thái cũ), nên chạy lặp hoặc song song không gửi tin hay thông báo trùng.

1. **Hết hạn đơn:** `Pending` có `depositDueDate` đã qua thì thành `Expired`, thêm tin hệ thống "Đơn … đã hết hạn đặt cọc." và thông báo `OrderExpired` cho cả hai bên. (`NeedRevision` không hết hạn vì đang chờ NCC.)
2. **Tự hoàn thành:** `Deposited` có `eventDate < hôm nay − 7` (quá ngày thực hiện hơn 7 ngày; không kiểm tra đã ghi nhận đợt 2 hay chưa) thì thành `Completed`, `completedDate` = **cuối ngày `eventDate` + 7 (giờ VN)** (để hoa hồng vào đúng bảng kê tháng), tạo hoa hồng, thêm tin hệ thống (bấm tay: "NCC đã hoàn tất đơn …"; tự động: "Đơn … được hệ thống tự hoàn tất vì đã quá ngày thực hiện hơn 7 ngày…"), thông báo `OrderCompleted`.
3. Nhắc hoa hồng (xem [commissions.md](commissions.md)): chưa làm.

**Cách chạy:**
- **Quét theo người xem (luôn bật):** trước khi đọc danh sách, chi tiết hoặc đếm đơn, backend quét **riêng đơn của người đang xem** (đơn của NCC đó, hoặc của khách đó), tối thiểu 15 giây một lần cho mỗi người, để đơn của chính họ hiện đúng trạng thái. Không đụng đơn của người khác.
- **Quét toàn hệ thống (mặc định TẮT):** đặt `ORDER_JOBS_ENABLED=true` thì quét mọi đơn một lần lúc khởi động rồi mỗi giờ. Không thêm thư viện lịch (`@nestjs/schedule`).

Mock của FE chạy các việc này mỗi lần đọc dữ liệu, có nút "giả lập thời gian" để thử.

## Không còn trong hợp đồng NCC

Phiên bản đơn (`versions`, v1/v2), đợt thanh toán tùy chỉnh (`installments`), `POST .../payments` (ghi nhận thanh toán), `POST .../adjustments` (phương án điều chỉnh), `paymentStatus` 6 giá trị, `paidAmount`, "phí theo chính sách", liên kết dòng báo giá với gói.

## Việc còn lại cho trang Quản lý đơn hàng

- **Đã làm:** 4 thẻ số liệu của trang Quản lý đơn hàng do backend tính trên **toàn bộ** đơn của NCC, trả trong `GET /vendors/me/orders/counts` (trường `tiles`, định nghĩa ở mục đó). Thẻ "Đặt cọc trong tháng" đã bỏ.
- **Đã làm (lọc ở CSDL, phân trang):** danh sách đơn lọc theo `status`, `from`/`to` (ngày sự kiện), `depositFrom`/`depositTo` (ngày cọc, giờ VN), `conversationId`, và tìm `q` theo mã đơn, tên khách, số điện thoại (số điện thoại tìm theo chuỗi lưu trong CSDL, khớp cả khi gõ liền số nếu số lưu liền). `GET /vendors/me/orders/counts` trả đủ 7 trạng thái cùng `tiles`.

## Số bàn tối thiểu của sảnh và chống lưu đè (cập nhật 04/11/2026)

- **Số bàn tối thiểu:** dòng gắn sảnh (`items[].packageId` = sảnh của đơn) không được thấp hơn `service_packages.min_tables`. Tạo, lưu nháp, gửi / chỉnh sửa đơn: kiểm mọi dòng sảnh. Sửa sau cọc (`PATCH`): chỉ kiểm khi đổi sảnh hoặc số lượng dòng sảnh bị đổi. Lỗi `400 VALIDATION_ERROR`, thông báo "Sảnh <tên> đặt tối thiểu N bàn.", `details["items.<i>.quantity"]`.
- **Chống lưu đè:** đơn trả thêm `version` (dấu vân tay nội dung, bảng `orders` không có `updated_at`). `PUT /:id/draft`, `POST /:id/send`, `PATCH /:id` nhận `expectedVersion` (tùy chọn); khác phiên bản hiện tại thì `409 ORDER_STALE` "Đơn đã được cập nhật ở nơi khác, vui lòng mở lại." Không gửi `expectedVersion` thì không kiểm.
