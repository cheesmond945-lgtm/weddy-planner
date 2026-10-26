# API: commissions (hoa hồng NCC trả WebPlan)

> **Hợp đồng đúng theo CSDL** (`docs/database.md` mục 9.8, bảng `CommissionStatements`, `Commissions`). Frontend (`frontend/src/mocks/vendorCommissions.ts` và `mocks/vendorOrders.ts`) làm đúng theo tài liệu này; backend làm theo tài liệu này.
> Bản này **thay thế hoàn toàn** bản cũ có minh chứng thanh toán, nộp từng phần, dòng bổ sung, thông tin chuyển khoản, Admin xác nhận.
> Quy ước chung: [README.md](README.md). Đơn hàng: [orders.md](orders.md).

Phạm vi: NCC xem tỷ lệ hoa hồng của mình, các bảng kê theo tháng, hoa hồng từng đơn, và **nộp một lần cho cả bảng kê qua VNPay**.
Không có: nộp từng phần, upload minh chứng, Admin xác nhận. (Phía Admin xem và đối soát làm sau.)

## Quy tắc nghiệp vụ

| Mục | Quy tắc |
|---|---|
| Khi nào phát sinh | **Chỉ khi đơn chuyển sang `Completed`** (NCC bấm Hoàn tất, hoặc hệ thống tự hoàn tất sau `EventDate` + 7 ngày). Không phát sinh ở bất kỳ mốc nào khác (kể cả khi khách cọc) |
| Một dòng `Commissions` | `OrderId` (duy nhất), `StatementId`, `OrderAmount` = `TotalAmount` cuối cùng của đơn lúc hoàn thành, `Rate` = `CommissionRate` của loại dịch vụ của NCC **lúc đó** (chụp lại, đổi tỷ lệ sau không ảnh hưởng dòng cũ), `Amount` = làm tròn từ `OrderAmount × Rate / 100`, `CreatedDate` = lúc hoàn thành |
| Bảng kê | Mỗi NCC mỗi tháng **một** bảng (`UNIQUE (VendorId, PeriodMonth)`). `PeriodMonth` = tháng của `CompletedDate` (giờ Việt Nam). Tạo khi có hoa hồng đầu tiên của tháng; `TotalOrders` và `TotalAmount` **cộng dồn** mỗi khi thêm một `Commissions` |
| Hạn nộp | `DueDate` = **ngày 25 của tháng sau** `PeriodMonth` |
| Trạng thái lưu | Chỉ `Unpaid` / `Paid` |
| "Đang tạm tính" | **Không lưu.** Là bảng kê của tháng hiện tại (giờ Việt Nam): vẫn cộng dồn, **chưa cho nộp** |
| "Quá hạn" | **Không lưu**, tính khi truy vấn: `Unpaid` và ngày hiện tại (giờ Việt Nam) lớn hơn `DueDate` |
| Cho nộp | `Unpaid`, kỳ đã kết thúc (tháng hiện tại > `PeriodMonth`), `TotalAmount` > 0 |
| Nộp | Một lần, đúng `TotalAmount`, qua VNPay. Thành công: `Status` = `Paid`, ghi `PaidDate`, `TransactionCode` (duy nhất) |
| Tỷ lệ | Theo loại dịch vụ (`ServiceCategories.CommissionRate`): Nhà hàng 5%, Decor 7%, Hoa cưới 8%, Trang phục 8%, Chụp ảnh 8%, Makeup 10%. Backend đọc từ CSDL, giao diện không tự tính |

Hiển thị trạng thái (giao diện tính từ dữ liệu trên, không do backend trả):

| Hiển thị | Điều kiện |
|---|---|
| Đang tạm tính | `periodMonth` = tháng hiện tại |
| Chưa nộp | `Unpaid`, kỳ đã kết thúc, chưa quá `dueDate` |
| Quá hạn | `Unpaid`, kỳ đã kết thúc, đã qua `dueDate` |
| Đã nộp | `Paid` |

Tháng hiện tại chưa có bảng kê (chưa đơn nào hoàn tất) thì giao diện tự dựng một dòng 0 đồng "Đang tạm tính"; backend **không** cần tạo bảng kê rỗng.

## Kiểu dữ liệu

`CommissionStatement`

```json
{
  "id": "…",
  "periodMonth": "2026-09",
  "totalOrders": 1,
  "totalAmount": 2880000,
  "dueDate": "2026-10-25",
  "status": "Unpaid",
  "paidDate": null,
  "transactionCode": null,
  "createdDate": "2026-09-24T03:00:00.000Z"
}
```

`CommissionLine` (hoa hồng của một đơn)

```json
{
  "id": "…",
  "orderId": "…",
  "orderCode": "DH26080012",
  "customerName": "Lan Hương & Minh Đức",
  "completedDate": "2026-09-24T03:00:00.000Z",
  "orderAmount": 57600000,
  "rate": 5,
  "amount": 2880000
}
```

`completedDate` lấy từ `Orders.CompletedDate`; `customerName`, `orderCode` lấy từ đơn.

## Endpoint (vai trò VENDOR)

### `GET /vendors/me/commissions`

Trả tỷ lệ hiện tại và mọi bảng kê của NCC, mới nhất trước (theo `periodMonth`).

```json
{
  "rate": { "percent": 5, "categoryName": "Nhà hàng" },
  "statements": [ { "…CommissionStatement…" } ]
}
```

- `rate`: tỷ lệ **hiện hành** của loại dịch vụ NCC (để hiển thị "Tỷ lệ hoa hồng của bạn: 5% (Nhà hàng)"); `null` nếu NCC chưa có loại dịch vụ.
- Không phân trang (mỗi tháng một bảng kê, nhiều nhất vài chục dòng).

### `GET /vendors/me/commissions/:id/lines`

Hoa hồng từng đơn của một bảng kê (`CommissionLine[]`), mới hoàn tất trước. Không phải bảng kê của NCC: `404 COMMISSION_STATEMENT_NOT_FOUND`.

### `POST /vendors/me/commissions/:id/pay`

Bắt đầu nộp một lần cho cả bảng kê. Body rỗng.

- Điều kiện: bảng kê `Unpaid`, kỳ đã kết thúc, `totalAmount` > 0.
- Tạo giao dịch VNPay với số tiền = `totalAmount`; trả `{ "paymentUrl": "https://sandbox.vnpayment.vn/…", "statement": null }`. Frontend chuyển trình duyệt sang `paymentUrl`.
- Khi VNPay báo thành công (IPN và/hoặc trang trả về), backend đặt `Status` = `Paid`, `PaidDate`, `TransactionCode`; frontend quay về trang Tài chính & đối soát và tải lại danh sách.
- Dữ liệu giả của frontend: nộp thành công ngay, trả `{ "paymentUrl": null, "statement": <bảng kê đã Paid> }`.

Lỗi:

| HTTP | `code` | Khi |
|---|---|---|
| 404 | `COMMISSION_STATEMENT_NOT_FOUND` | Bảng kê không tồn tại hoặc không của NCC này |
| 409 | `COMMISSION_NOT_PAYABLE` | Kỳ hiện tại (đang tạm tính), hoặc `totalAmount` = 0 |
| 409 | `COMMISSION_ALREADY_PAID` | Bảng kê đã `Paid` |

## Việc backend tự chạy

- **Khi đơn thành `Completed`** (NCC bấm Hoàn tất hoặc tự hoàn tất): tạo `Commissions`, tạo bảng kê của tháng `CompletedDate` nếu chưa có, cộng dồn `TotalOrders`, `TotalAmount` (trong cùng một giao dịch).
- **Nhắc nộp** (thông báo, làm cùng phần Notifications): trước hạn và khi quá hạn. Chưa có API đọc `Notifications` cho NCC.
- Mock của frontend chạy các việc này mỗi lần đọc dữ liệu, có nút "Giả lập thời gian" (tua giờ/ngày/30 ngày) để thử kỳ chuyển Chưa nộp, Quá hạn.

## Không còn trong hợp đồng NCC

Minh chứng thanh toán (`POST …/payments`, `PAYMENT_PROOF`, `reviewNote`), nộp từng phần (`paidAmount`, `pendingAmount`, `PARTIALLY_PAID`), `PENDING_CONFIRMATION`, `OPEN`, dòng bổ sung (`SUPPLEMENT`, `supplementCount`), thông tin chuyển khoản (`transfer`), tỷ lệ cố định 8/10/12%, hạn ngày 20, căn cứ "khoản đã thu thực tế".
