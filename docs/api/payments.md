# API: payments (đặt cọc)

> **Đã làm ở backend** (`backend/src/modules/orders`, cập nhật 27/10/2026): chế độ **thanh toán thử (giả lập)**. Cổng VNPay **chưa tích hợp**.
> Quy ước chung: [README.md](README.md). `Order`: xem [orders.md](orders.md). Giao diện khách: [THE_DON_PHIA_KHACH.md](../THE_DON_PHIA_KHACH.md) mục 3.1.

Phạm vi: cặp đôi đặt cọc cho đơn dịch vụ. **Chỉ một khoản trong hệ thống là tiền cọc** (`Payments`, 1 dòng cho mỗi đơn, tạo lúc NCC gửi đơn); phần còn lại khách trả tiền mặt trực tiếp cho NCC, không ghi nhận.

## Chế độ thanh toán (biến `PAYMENT_MODE` trong `backend/.env`)

| Giá trị | Hành vi |
|---|---|
| `simulate` | Ghi nhận thanh toán thành công ngay (dùng để chạy thử và demo). Sinh mã giao dịch ngẫu nhiên |
| `vnpay` | VNPay thật (cần `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`; xem phần "Triển khai thật" bên dưới). Thiếu cấu hình: `POST /payments` trả 501 `PAYMENT_NOT_CONFIGURED` |
| (không đặt) | Chạy dev (`NODE_ENV` khác `production`): như `simulate`. Khi `NODE_ENV=production`: **không giả lập**, trả 501 trừ khi đặt **rõ** `PAYMENT_MODE=simulate` (để bản demo triển khai vẫn bật được) |

## POST /payments
Role: **Couple**, đơn của mình. Body `{ "orderId": "…", "method": "VNPAY_QR" }` (`method` hiện chưa dùng; số tiền backend lấy từ `depositAmount` của đơn, FE không gửi).
> FE **không** coi `vnp_ResponseCode` trên URL là bằng chứng đã trả tiền; chỉ dựa vào trạng thái đơn do BE cập nhật.

> **Triển khai thật** (`backend/src/integrations/vnpay/vnpay.ts`, dùng chung với hoa hồng NCC): bật khi có `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` và `PAYMENT_MODE` khác `simulate`, ngược lại chạy giả lập (ghi nhận ngay). Vì chạy cục bộ VNPay không gọi IPN được, ngoài IPN còn có **`POST /payments/vnpay/confirm`** (Role: COUPLE, body = các tham số `vnp_*` trên URL quay về): trang `/plan/deal/:orderId` thấy `vnp_SecureHash` thì gửi lên, BE kiểm chữ ký HMAC-SHA512, mã phản hồi, số tiền rồi ghi nhận, trả `{ status: PAID | FAILED, message }`. IPN và confirm ghi nhận chung một chỗ, chỉ ghi một lần (đơn còn chờ cọc mới chuyển sang đã cọc). Đơn bị hủy / hết hạn trong lúc khách đang trả: không ghi, báo liên hệ hoàn tiền và ghi log. `vnp_TxnRef` = `D`/`C` (đặt cọc / hoa hồng) + id 32 ký tự hex + thời điểm; `method` → `vnp_BankCode` (`VNPAYQR`, `VNBANK`, `INTCARD`). IPN trả `00` ghi nhận xong, `01` không thấy, `02` đã xử lý, `04` sai số tiền, `97` sai chữ ký, `99` lỗi khác.

Chỉ khi đơn `Pending` và chưa quá hạn cọc. Thành công (một giao dịch):
1. `Payments`: `Paid`, `TransactionCode`, `PaidDate`.
2. `Orders`: `Pending` → `Deposited`.
3. `Invoices`: `DepositReceipt` (mã `XNC<yyMM><số>`).
4. Thêm NCC vào kế hoạch của khách (`PlanVendors`, nếu chưa có).
5. Sinh các việc chi tiết của dịch vụ trên timeline của khách; việc "Chốt …" của hạng mục xong.
6. Chat: tin `DepositReceipt` do **hệ thống** gửi (`SenderId` rỗng): "Giấy xác nhận cọc XNC…: đã nhận … cho đơn DH…. Số còn lại … thanh toán trực tiếp với NCC."
7. Báo NCC (`OrderDeposited`).

Response 200: `{ "data": { "paymentId": "…", "paymentUrl": "/plan/deal/{orderId}?vnp_ResponseCode=00" } }`. FE chuyển tới `paymentUrl` rồi đọc lại `GET /orders/:id`: trạng thái `Deposited` mới là bằng chứng đã cọc (FE **không** coi `vnp_ResponseCode` trên URL là bằng chứng).

Lỗi: 404 `ORDER_NOT_FOUND`, 409 `ORDER_NOT_PAYABLE` (đơn không phải `Pending`: đang chờ NCC sửa, đã cọc, hết hạn, hủy), 501 `PAYMENT_NOT_CONFIGURED`.

## Khi làm VNPay thật (chưa làm)

1. FE gọi `POST /payments`; BE tạo link thanh toán, trả `paymentUrl` của VNPay (cần biến `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL`, địa chỉ IPN công khai).
2. VNPay gọi **IPN** `GET /payments/vnpay/ipn` (Public, không bọc `{ data }`, dùng `@RawResponse()`): kiểm tra chữ ký, số tiền, trạng thái, **idempotent**; thành công thì làm các bước 1 đến 7 ở trên.
3. VNPay đưa người dùng về `VNPAY_RETURN_URL` = `/plan/deal/:orderId?vnp_ResponseCode=…`.

`Payments` không có cột số tiền hay phương thức; số tiền luôn lấy từ `Orders.DepositAmount`.

## Cần chốt

1. Thời hạn của một link VNPay.
2. Hoàn cọc có làm trong phạm vi đồ án không (hiện hoàn cọc ngoài hệ thống: NCC hoàn trực tiếp khi tự hủy vì không thể thực hiện).
