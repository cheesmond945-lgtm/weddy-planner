# API: payments (đặt cọc qua VNPay)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/chat.ts`).
> Quy ước chung: [README.md](README.md). `Order`: xem [orders.md](orders.md).
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md` (trạng thái thanh toán).**

Phạm vi: cặp đôi đặt cọc cho đơn dịch vụ (mục 7.3).

## Luồng

1. FE (trang `/plan/deal/:orderId`) gọi `POST /payments` với phương thức đã chọn.
2. BE tạo bản ghi thanh toán, trả `paymentUrl` của VNPay. FE chuyển trình duyệt sang đó.
3. VNPay gọi **IPN** về BE (`GET /payments/vnpay/ipn`). BE **kiểm tra chữ ký**, số tiền, trạng thái; nếu thành công: đơn → `PAID`, kế hoạch → `CONFIRMED`, mở việc chi tiết trên timeline, thêm tin hệ thống "Đã ghi nhận đặt cọc <số tiền>. Dịch vụ được chốt." vào hội thoại.
4. VNPay đưa người dùng về `VNPAY_RETURN_URL` = trang FE `/plan/deal/:orderId?vnp_ResponseCode=…`. FE gọi `GET /orders/:id`: `PAID` → "Đặt cọc thành công"; chưa `PAID` và mã khác `00` → báo "Thanh toán chưa thành công" và cho thử lại.

> FE **không** coi `vnp_ResponseCode` trên URL là bằng chứng đã trả tiền; chỉ dựa vào trạng thái đơn do BE cập nhật.

> **Triển khai thật** (`backend/src/integrations/vnpay/vnpay.ts`, dùng chung với hoa hồng NCC): bật khi có `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` và `PAYMENT_MODE` khác `simulate`, ngược lại chạy giả lập (ghi nhận ngay). Vì chạy cục bộ VNPay không gọi IPN được, ngoài IPN còn có **`POST /payments/vnpay/confirm`** (Role: COUPLE, body = các tham số `vnp_*` trên URL quay về): trang `/plan/deal/:orderId` thấy `vnp_SecureHash` thì gửi lên, BE kiểm chữ ký HMAC-SHA512, mã phản hồi, số tiền rồi ghi nhận, trả `{ status: PAID | FAILED, message }`. IPN và confirm ghi nhận chung một chỗ, chỉ ghi một lần (đơn còn chờ cọc mới chuyển sang đã cọc). Đơn bị hủy / hết hạn trong lúc khách đang trả: không ghi, báo liên hệ hoàn tiền và ghi log. `vnp_TxnRef` = `D`/`C` (đặt cọc / hoa hồng) + id 32 ký tự hex + thời điểm; `method` → `vnp_BankCode` (`VNPAYQR`, `VNBANK`, `INTCARD`). IPN trả `00` ghi nhận xong, `01` không thấy, `02` đã xử lý, `04` sai số tiền, `97` sai chữ ký, `99` lỗi khác.

### POST /payments
Role: **COUPLE**, đơn của mình, đơn đang `SENT`.

Request

```json
{ "orderId": "od-1", "method": "VNPAY_QR" }
```

`method`: `VNPAY_QR` (VNPay QR), `VNPAY_ATM` (Thẻ ATM nội địa qua VNPay), `INTERNATIONAL_CARD` (Thẻ quốc tế). Số tiền BE lấy từ `depositAmount` của đơn, FE không gửi.

Response 200

```json
{ "data": { "paymentId": "pay-1", "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..." } }
```

Lỗi: 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_PAYABLE` (đơn không ở `SENT`)

### GET /payments/vnpay/ipn
Role: Public (VNPay gọi). **Không bọc `{ data }`** (dùng `@RawResponse()`), trả đúng định dạng VNPay yêu cầu, ví dụ `{ "RspCode": "00", "Message": "Confirm Success" }`. Phải idempotent (VNPay có thể gọi lại).

## Ghi chú về dữ liệu giả

Mock không chuyển sang VNPay: `POST /payments` ghi nhận thanh toán thành công luôn (sau 1,2 giây) và trả `paymentUrl` là đường dẫn nội bộ `/plan/deal/:orderId?vnp_ResponseCode=00`.

## Cần chốt

1. Thời hạn của một lần thanh toán (link VNPay hết hạn sau bao lâu), và trạng thái bản ghi thanh toán (`PENDING`, `SUCCEEDED`, `FAILED`…) theo `state-diagrams.md`.
2. Hoàn cọc có làm trong phạm vi đồ án không.
