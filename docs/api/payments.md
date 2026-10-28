# API: payments (đặt cọc và hoa hồng qua VietQR + SePay)

> Quy ước chung: [README.md](README.md). `Order`: xem [orders.md](orders.md). Hoa hồng NCC: [commissions.md](commissions.md).

Cặp đôi đặt cọc cho đơn dịch vụ (mục 7.3) và NCC nộp hoa hồng dùng **chung một tài khoản nhận**, cấu hình trong `.env`: `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`, `SEPAY_TOKEN`. Thiếu một biến thì các API thanh toán trả 501 `PAYMENT_NOT_CONFIGURED`.

## Luồng

1. FE (trang `/plan/deal/:orderId`, hoặc nút "Thanh toán" ở Tài chính & đối soát) gọi API tạo thanh toán. BE lấy **số tiền từ DB** (`orders.deposit_amount`, `commission_statements.total_amount`) và trả mã QR dựng bằng Quick Link `img.vietqr.io` cùng nội dung chuyển khoản.
2. Nội dung chuyển khoản phân biệt hai luồng: **`EVERLY` + mã đơn** (cọc) và **`EVHH` + 8 ký tự hex đầu của id bảng kê, viết hoa** (hoa hồng). SePay (VietinBank) yêu cầu nội dung bắt đầu bằng **`SEVQR `**, nên đầy đủ là `SEVQR EVERLYDH26100001` và `SEVQR EVHH3F9A1C2B`; tối đa 25 ký tự, in hoa, không dấu. Mã `DS<MM><YYYY>` của bảng kê trùng giữa các NCC nên không dùng làm nội dung.
3. FE hiện QR và tự gọi API kiểm tra mỗi 5 giây cho tới khi nhận được tiền (không có nút xác nhận do khách bấm). BE gọi SePay API v2 `GET {SEPAY_API_BASE}/v2/transactions` (mặc định `https://userapi.sepay.vn`, Bearer `SEPAY_TOKEN`) và tìm giao dịch tiền vào có **nội dung chứa mã yêu cầu** (so sánh sau khi chuẩn hóa: chữ hoa, bỏ ký tự không phải chữ/số) và **số tiền đúng bằng** số tiền trong DB. BE không tin kết quả do trình duyệt báo.
4. Mỗi giao dịch SePay chỉ dùng được **một lần**: id giao dịch lưu vào `payments.transaction_code` / `commission_statements.transaction_code` (cùng `UNIQUE`), và BE tra cả hai bảng trước khi nhận. Hai lần kiểm tra đồng thời vẫn chỉ ghi một lần (cập nhật có điều kiện trạng thái).
5. Cọc: đơn `Pending` → `Deposited`, `payments` → `Paid`, tạo giấy xác nhận cọc, mở việc chi tiết trên timeline, thêm tin hệ thống vào hội thoại, báo NCC. Hoa hồng: bảng kê `Unpaid` → `Paid`, báo NCC và Admin. Đơn bị hủy / hết hạn trong lúc khách đang chuyển: không ghi, báo liên hệ hoàn tiền và ghi log.

Mã QR hiển thị 15 phút (`expiresAt`); hết hạn vẫn bấm kiểm tra lại được. SePay giới hạn khoảng 2 lần gọi mỗi giây nên BE giữ danh sách giao dịch 3 giây.

Admin xác nhận tay một bảng kê hoa hồng bằng `POST /admin/commissions/:id/record-payment` (xem [admin.md](admin.md)). Đơn cọc chưa có thao tác xác nhận tay.

### POST /payments
Role: **COUPLE**, đơn của mình, đơn đang chờ cọc.

Request

```json
{ "orderId": "od-1" }
```

Response 200

```json
{ "data": { "paymentId": "pay-1", "qrUrl": "https://img.vietqr.io/image/970422-0123456789-compact2.png?amount=18440000&addInfo=SEVQR%20EVERLYDH26100001&accountName=...", "amount": 18440000, "content": "SEVQR EVERLYDH26100001", "bankBin": "970422", "accountNo": "0123456789", "accountName": "CONG TY EVERLY", "expiresAt": "2026-10-28T06:15:00.000Z" } }
```

Lỗi: 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_PAYABLE`, 501 `PAYMENT_NOT_CONFIGURED`

### POST /payments/check
Role: **COUPLE**. Request `{ "orderId": "od-1" }`. Response 200 `{ "data": { "status": "PAID" | "PENDING" | "FAILED", "message": "..." } }`: `PAID` đã ghi nhận cọc (hoặc đơn đã cọc từ trước), `PENDING` chưa thấy tiền, `FAILED` đơn đổi trạng thái trong lúc thanh toán.

Lỗi: 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_PAYABLE`, 502 `PAYMENT_PROVIDER_ERROR` (không gọi được SePay), 501 `PAYMENT_NOT_CONFIGURED`

### POST /vendors/me/commissions/:id/pay và /check
Role: **VENDOR**. `:id` là mã bảng kê `DS<MM><YYYY>`. `pay` trả cùng cấu trúc như `POST /payments` (không có `paymentId`); `check` trả `{ "status": "PAID", "statementId", "transactionCode", "message" }` hoặc `{ "status": "PENDING", "message" }`. Lỗi: 404 `COMMISSION_STATEMENT_NOT_FOUND`, 409 `COMMISSION_ALREADY_PAID` / `COMMISSION_NOT_PAYABLE`, 501, 502 như trên.

## Cần chốt

1. Hoàn cọc có làm trong phạm vi đồ án không.
