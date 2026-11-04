# Hiện trạng luồng thanh toán của đơn hàng

> **Tài liệu cũ, có thể không còn đúng.** Viết ở một thời điểm trước các thay đổi ngày 04/11/2026 (hạn đợt 2, VietQR thay VNPay, tên Forever, trang Quản lý đơn hàng). Xem tài liệu hiện hành: `LUONG_CHAT_DON_HANG.md` (phần Cập nhật đầu file), `api/orders.md`, `api/THE_DON_HANG.md`.


Khảo sát ngày 01/11/2026 trên nhánh `Chanh`. Chỉ đọc code và `schema.prisma`; không chạy lệnh nào đụng CSDL, không đọc giá trị `.env`. Bỏ qua hoa hồng và màn "Tài chính & đối soát".

Đường dẫn gọn: `BE` = `backend/src/modules`, `FE` = `frontend/src/features`.

## Tóm tắt

- Hệ thống **chỉ lưu và kiểm soát đợt 1 (tiền cọc)**. Đợt 2 (phần còn lại, tiền mặt) **không có dòng dữ liệu nào**, không có API hay nút để NCC hoặc khách đánh dấu "đã nhận tiền mặt".
- Số tiền còn lại luôn là **suy ra** (`tổng − cọc`), không phải số liệu đã thu.
- Hai chỗ đang **mặc định coi đợt 2 đã thu**: câu trong tin "Hóa đơn cuối" ("đã thanh toán tiền mặt …") và cột "Đợt 2" của lịch thanh toán ("Đã hoàn thành" khi đơn Completed).
- Việc timeline `PAY:<orderId>` chỉ là việc nhắc, không nối với `payments` hay hóa đơn. Nó bị đóng tự động khi hoàn thành đơn, nên "Done" ở đó không chứng minh đã thu tiền.

## 1. Dữ liệu

### 1.1 `orders` (`prisma/schema.prisma:205-240`)

| Cột | Ý nghĩa |
|---|---|
| `total_amount` Decimal(18,2) | Tổng giá trị đơn |
| `deposit_percent` Decimal(5,2) | Tỷ lệ cọc (%) |
| `deposit_amount` Decimal(18,2) | **Tiền cọc** (đợt 1) |
| `deposit_due_date` timestamptz | Hạn cọc (gửi đơn + 24 giờ) |
| `status` varchar(20) | `Draft, Pending, NeedRevision, Deposited, Completed, Expired, Cancelled` |
| `completed_date`, `cancelled_date`, `cancel_reason` | Ngày hoàn thành, hủy; lý do `CUSTOMER_REQUEST` / `VENDOR_UNABLE` |

Không có cột "số tiền còn lại", "đã thu", "phương thức thanh toán" hay "ngày thu đợt 2". Tiền còn lại luôn tính tại chỗ: `totalAmount − depositAmount` (ví dụ `FE/vendorOrders/components/OrderCard.tsx:96`, `FE/orders/components/OrderCard.tsx:103`, `BE/orders/orders.service.ts:463`).

### 1.2 `payments` (`schema.prisma:286-294`)

`id`, `order_id` (**unique**: tối đa MỘT dòng mỗi đơn), `transaction_code` (unique), `status` varchar(20) mặc định `Unpaid`, `paid_date`, `created_date`.

- **Không có** cột số tiền, phương thức, hay loại đợt. Một dòng = khoản cọc VietQR duy nhất của đơn. Vì `order_id` unique nên **không thể thêm dòng thứ hai cho đợt 2** mà không đổi cấu trúc.
- Giá trị `status`: `Unpaid`, `Paid` (`docs/database.md:540`). CHECK theo tài liệu: `Status = 'Unpaid' OR (TransactionCode IS NOT NULL AND PaidDate IS NOT NULL)` (`docs/database.md:2261`). Ràng buộc này nằm ở CSDL thật, **không có trong `prisma/sql/`** nên tôi chưa xác minh được.

### 1.3 `invoices` (`schema.prisma:104-113`)

`id`, `order_id`, `invoice_code` (unique), `type` varchar(20), `created_date`; `@@unique([order_id, type])` (mỗi đơn tối đa một hóa đơn mỗi loại).

- `type` hợp lệ: `DepositReceipt` (giấy xác nhận cọc), `FinalInvoice` (hóa đơn cuối) (`docs/database.md:542`, `:2274`).
- **Không có** cột số tiền, trạng thái, hay phương thức: số tiền trong chứng từ được dựng lại từ `orders` lúc hiển thị / lúc gửi tin.

### 1.4 Bảng liên quan

- `messages` (`schema.prisma:118`): `type` ∈ `Text, Order, DepositReceipt, FinalInvoice`; `order_id` gắn thẻ đơn. Nội dung tiền nằm trong chữ `content`.
- `timeline_tasks`: việc `PAY:<orderId>` (mục 3.4). Không có khóa nào tới `payments`.
- `commissions` bỏ qua theo yêu cầu.

**Kết luận:** CSDL hiện chỉ biết "đã cọc hay chưa" (`payments.status`, `paid_date`). Phân biệt đợt 1 / đợt 2 và chuyển khoản / tiền mặt chỉ có trong **chữ cứng trên giao diện** ("VietQR (trực tuyến)", "Tiền mặt, trả trực tiếp cho NCC"), không có trong dữ liệu.

## 2. Đợt 1 (đặt cọc), tóm tắt

Biến môi trường tồn tại (không in giá trị): `PAYMENT_DEMO_MODE`, `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`, `SEPAY_TOKEN`, `SEPAY_API_BASE` (`integrations/vietqr/*.ts`).

1. **Gửi đơn** (`applySend`, `BE/orders/orders.service.ts:610`): đơn sang `Pending`, `deposit_amount` tính từ `total × %`, `deposit_due_date` = +24 giờ, tạo sẵn `payments` `Unpaid` nếu chưa có.
2. **Tạo cọc** `POST /payments` → `createDeposit` (`:315`): chặn nếu đơn không Pending / hết hạn / ngày sau ngày cưới / hạng mục đã có đơn Deposited / sảnh bận; upsert `payments` Unpaid (`:356`); trả mã QR (`img.vietqr.io`) và nội dung chuyển khoản `depositContent(order_code)`.
3. **Xác nhận**, ba đường vào cùng một hàm `markDepositPaid` (`:409`):
   - `POST /payments/check` → `checkDeposit` (`:384`): hỏi SePay `findPayment(nội dung, số tiền)` (`integrations/vietqr/sepay.service.ts:80`), bỏ qua giao dịch đã dùng cho `payments` hoặc bảng kê.
   - `POST /payments/demo-confirm` → `confirmDemoDeposit` (`:371`): chỉ khi `PAYMENT_DEMO_MODE` đúng bằng `"true"` (`demo-mode.ts:6`), mã giao dịch `DEMO-<mã đơn>`, ngược lại trả 404.
4. **`markDepositPaid`** ghi trong một transaction (`:415-440`): khóa `pg_advisory_xact_lock` theo (đám cưới, hạng mục); chặn đơn khác Deposited cùng hạng mục / sảnh bận; `orders` `Pending → Deposited` (có điều kiện chưa quá hạn, `:427`); `payments` upsert `Paid` + `transaction_code` + `paid_date` (`:429`); `invoices` tạo `DepositReceipt` (`:434`); `plan_vendors` upsert.
5. **Sau transaction:** `onOrderDeposited` (`:454`): Mốc chốt `*_BOOK` sang Done, sinh việc chi tiết từ gói + việc `PAY:`; tin chat `DepositReceipt` hệ thống gửi (`:460`, nội dung ghi "Số còn lại … thanh toán trực tiếp với NCC"); thông báo `OrderDeposited` cho NCC.
6. Trường hợp không ghi nhận (hạng mục đã có đơn khác, sảnh bận, đơn đã hết hạn / hủy): khách đã chuyển tiền nhưng hệ thống chỉ ghi log "cần hoàn tiền thủ công" và báo khách liên hệ Forever (`:441-452`, `checkDeposit`).

## 3. Đợt 2 (trọng tâm)

### 3.1 Có chỗ nào để đánh dấu "đã nhận tiền mặt phần còn lại" không?

**Không.** Đã tìm trong controller và service:

- `orders.controller.ts` phía NCC (`vendors/me/orders`): `create`, `saveDraft`, `send`, `edit`, `reject`, `cancel`, `complete`, `final-invoice`, và các API việc (`tasks`, `schedule`). Không có API nào ghi nhận thu tiền.
- Phía khách (`payments`): chỉ `POST /payments`, `/demo-confirm`, `/check`, đều dành cho **đợt cọc** và chỉ chạy với đơn `Pending`.
- Giao diện NCC: không có nút "Đã nhận tiền mặt". Menu thao tác của đơn (`FE/vendorOrders/actions.tsx:10`): `view, continue, resend, edit, reject, again, complete, invoice, viewInvoice, cancel`.
- Tài liệu cũng xác nhận đây là chủ ý ban đầu: "Đợt 2 không có dòng dữ liệu … Form chỉ cho xem, không có nút thêm đợt" (`docs/database.md:2681`), "Thanh toán nốt: bằng tiền mặt ngoài hệ thống, không có dòng nào trong dữ liệu" (`:748`).

### 3.2 "Xuất hóa đơn cuối" (`finalInvoice`, `BE/orders/orders.service.ts:764`)

- Điều kiện: đơn `Deposited` hoặc `Completed`; mỗi đơn một lần (409 `INVOICE_EXISTS`).
- Làm gì: tạo `invoices` loại `FinalInvoice` (`:770`) và gửi tin chat `FinalInvoice` do NCC gửi (`:778-781`).
- **Không** ghi `payments`, **không** đổi trạng thái đơn, **không** kiểm tra đã thu tiền hay chưa.
- Có tính số còn lại, nhưng chỉ để in chữ: `total − deposit` (`:772-773`), và câu tin viết cứng **"đã thanh toán tiền mặt {tổng − cọc}"** (`:780`). Tức là hóa đơn cuối **khẳng định đã thu đủ** dù hệ thống không biết điều đó. Hộp xem chứng từ cũng ghi "Đã thanh toán tiền mặt" (`FE/vendorOrders/components/InvoiceDialog.tsx:80`) và "không có giao dịch trên hệ thống" (`:85`).
- Có thể xuất hóa đơn cuối **ngay khi đơn Deposited**, kể cả trước ngày thực hiện.

### 3.3 "Hoàn tất" và tự hoàn thành sau E+7

- `complete` (`:755`): NCC bấm; điều kiện đơn `Deposited` và đã qua ngày thực hiện (`todayVn() > event_date`); gọi `completeOrder(..., 'VENDOR')`.
- Tự hoàn thành: `autoComplete` (`BE/orders/order-lifecycle.ts:89`), do `OrderJobsService` quét (`order-jobs.service.ts:58`): đơn `Deposited` quá `event_date + 7` thì `completeOrder(..., 'SYSTEM')`, `completed_date` = cuối ngày E+7.
- `completeOrder` (`order-lifecycle.ts:67`): `orders` `Deposited → Completed` có điều kiện, ghi hoa hồng (bỏ qua), **đóng mọi việc chi tiết chưa Done sang Done** (kể cả `PAY:`), gửi tin hệ thống "Đơn … đã hoàn thành", thông báo khách (và NCC nếu hệ thống tự hoàn thành).
- **Không kiểm tra và không ghi nhận** đợt 2: không đọc `payments`, không yêu cầu hóa đơn cuối, không có trường nào lưu "đã thu". Hoàn thành tự động sau E+7 **mặc định coi như đã thu đủ** (docs gọi E+7 là "khoảng chờ trả muộn", `docs/database.md:2681`).

### 3.4 Việc timeline "Thanh toán phần còn lại" (`PAY:<orderId>`)

- Sinh lúc cọc (`orderTaskRows`, `BE/weddings/timeline-rows.ts:100-127`): `task_code = 'PAY:' + orderId`, tiêu đề "Thanh toán phần còn lại cho <NCC>", status `Waiting` (chờ khách), hạn = max(E+7, hạn lớn nhất của việc gói). Chủ việc suy là `CUSTOMER` (`task-owner.ts`).
- **Không nối** với `payments`, `invoices` hay số tiền: không có khóa, không đọc `payments`, nội dung chỉ là chữ.
- NCC đổi trạng thái việc này giống mọi việc khác (`setStatus`, `BE/orders/order-tasks.service.ts:198`): chỉ `UPDATE timeline_tasks` (`:204`) và, khi sang Done, gửi khách thông báo "đã hoàn thành việc …". **Không ảnh hưởng** `orders`, `payments`, `invoices` hay tin chat.
- Tác dụng phụ đáng lưu ý:
  - Nhắc hạn: việc Waiting sắp đến hạn / quá hạn nhắc khách "<NCC> đang chờ bạn: Thanh toán phần còn lại…" và nhắc NCC khi quá hạn (`remindersFor`, `task-owner.ts`).
  - Hoàn thành đơn tự đóng việc này sang Done (mục 3.3), nên **"Done" không có nghĩa đã nhận tiền**.
  - NCC có thể đổi ngày hay đánh dấu Done tùy ý; không có ràng buộc nào với số tiền.

## 4. Màn hình

| Màn | Nội dung về tiền | Đợt 2 |
|---|---|---|
| **NCC: bảng đơn** (`FE/vendorOrders/components/OrdersTable.tsx:58-71`, cột "Đặt cọc") | "10% · 800.000đ" kèm thanh tiến độ và "Đã cọc dd/mm" (lấy từ `payment.paidDate`) hoặc "Chưa cọc" | Không hiện gì về đợt 2 |
| **NCC: thẻ đơn** (`OrderCard.tsx:95-96`) | "Đặt cọc (x%)" và "Còn lại" = tổng − cọc | Chỉ là số suy ra, không có trạng thái |
| **NCC: chi tiết đơn** (`OrderDetailDialog.tsx:193`, `PaymentScheduleTable.tsx`) | Bảng 2 đợt cố định "chỉ để xem". Đợt 1: số tiền, hạn, VietQR, trạng thái "Đã cọc …". Đợt 2: số tiền = tổng − cọc, hạn "ngày thực hiện (trả muộn tới +7 ngày)", "Tiền mặt, trả trực tiếp cho NCC" | `restState` (`:30-35`): Completed → "Đã hoàn thành" (xanh), Deposited → "Thu khi hoàn thành", Cancelled → "Không thu (khách đã hủy)". Đây là **suy từ trạng thái đơn**, không có dữ liệu thu |
| **NCC: chứng từ** (`InvoiceDialog.tsx:76-85`) | Giấy cọc: "Đã nhận cọc (VietQR)", "Còn lại, trả tiền mặt trực tiếp cho NCC". Hóa đơn cuối: "Đã cọc (VietQR)", **"Đã thanh toán tiền mặt"** + số tiền | Hóa đơn cuối ghi đã thu, không có căn cứ trong dữ liệu |
| **NCC: chat** (`FE/vendorChat/components/MessageItem.tsx:54-55`) | Tin `DepositReceipt` / `FinalInvoice` hiện nguyên chữ do backend dựng | Hóa đơn cuối nói "đã thanh toán tiền mặt …" |
| **Khách: thẻ đơn** (`FE/orders/components/OrderCard.tsx:102-103`, `MyOrderCard.tsx:65`) | "Đặt cọc (x%)", "Còn lại" / "Đợt 2 · Còn lại (tiền mặt cho NCC)" | Chỉ số tiền suy ra |
| **Khách: thanh toán cọc** (`FE/payments/components/DepositView.tsx:159`) | Sau khi cọc: "Phần còn lại … thanh toán trực tiếp cho nhà cung cấp" | Không có trạng thái |
| **Khách: chat** (`FE/chat/components/ChatView.tsx:264-277`, `ReceiptCard`) | Thẻ Giấy cọc / Hóa đơn cuối có nút Xem, dùng chung hộp chứng từ | Như trên |
| **Điều khoản** (`FE/orders/depositTerms.ts:39`) | "Điều 7. Thanh toán phần còn lại: bạn thanh toán trực tiếp cho nhà cung cấp theo thỏa thuận" | Chỉ mô tả |

## 5. Trạng thái đơn liên quan đến tiền

| Chuyển | Điều kiện | Ghi gì về tiền |
|---|---|---|
| `Draft → Pending` | NCC gửi đơn (`applySend`) | Tạo `payments` `Unpaid`, đặt `deposit_amount`, `deposit_due_date` |
| `Pending → Deposited` | `markDepositPaid` (VietQR / SePay / demo), đơn chưa quá hạn | `payments` `Paid`; `invoices` `DepositReceipt` |
| `Pending → Expired` | Quá `deposit_due_date` chưa cọc (`expirePending`, `order-lifecycle.ts:25`) | Không ghi tiền (`payments` giữ `Unpaid`) |
| `Pending/NeedRevision/Deposited` sửa | NCC sửa nội dung; sau cọc không được giảm tổng dưới tiền cọc (`ORDER_TOTAL_BELOW_DEPOSIT`) | `total_amount` đổi thì "còn lại" tự đổi theo |
| `Deposited → Completed` | NCC bấm khi đã qua ngày thực hiện (`complete`), hoặc tự động sau E+7 | Không ghi gì về đợt 2; hoa hồng (bỏ qua) |
| `Deposited → Cancelled` | NCC hủy, đơn còn trước ngày thực hiện (`cancel`, `:791`), lý do bắt buộc | Không đụng `payments` (xem mục 6) |

## 6. Lỗ hổng và chỗ chưa rõ

1. **Không có ghi nhận đã thu đợt 2.** Đơn `Completed` không cho biết NCC đã nhận phần còn lại hay chưa. Mọi chỗ hiển thị "đã hoàn thành" chỉ suy từ trạng thái đơn.
2. **Hóa đơn cuối khẳng định đã thu đủ** ("đã thanh toán tiền mặt …", `orders.service.ts:780`, `InvoiceDialog.tsx:80`) kể cả khi chưa thu, và có thể xuất ngay khi đơn mới Deposited. Hai hệ quả: chứng từ có thể sai sự thật; khách không có cách phản hồi trên hệ thống.
3. **Việc `PAY:` chỉ là việc nhắc.** Đóng bằng tay hoặc bị đóng tự động khi hoàn thành đơn; không thể dùng làm bằng chứng đã thu. Nó còn có thể nhắc "NCC đang chờ bạn thanh toán" cho cả đơn đã thu xong ngoài hệ thống.
4. **Hủy đơn sau cọc không xử lý tiền cọc.** `cancel` chỉ đổi trạng thái, ghi `cancelled_date`, `cancel_reason`, gửi tin và gỡ việc (`:791-830`). `payments` vẫn `Paid`, không có dòng hoàn tiền hay ghi chú. Theo chữ trên giao diện: `CUSTOMER_REQUEST` khách mất cọc, `VENDOR_UNABLE` NCC hoàn cọc **ngoài hệ thống** (`order-rules.ts:98-100`, `orders.service.ts` chú thích `cancel`). Không có dữ liệu nào cho biết NCC đã hoàn cọc hay chưa.
5. **Cọc đã chuyển nhưng không ghi nhận** (hạng mục đã có đơn khác, sảnh bận, đơn đã hết hạn / hủy lúc khách chuyển): chỉ có log "cần hoàn tiền thủ công" (`markDepositPaid`, `:441-452`) và câu báo khách; không có bảng hay danh sách theo dõi các khoản này.
6. **`payments` chỉ một dòng mỗi đơn** (`order_id` unique) và không có cột số tiền: không thể mô hình hóa đợt 2 trong bảng này nếu không đổi cấu trúc.
7. **Tiền còn lại đổi theo `total_amount`.** Sửa đơn sau cọc (miễn không thấp hơn tiền cọc) làm "còn lại" đổi; hệ thống không lưu số đã thỏa thuận ban đầu.
8. **Hạn đợt 2 chỉ là chữ** ("ngày thực hiện, trả muộn tới +7 ngày"); không có quá hạn thật hay nhắc dựa trên thu tiền, chỉ nhắc theo việc `PAY:`.
9. **CHECK trong CSDL thật chưa xác minh** (chỉ có theo `docs/database.md`); `prisma/sql/` không chứa ràng buộc của `payments`, `invoices`, `orders.status`.

## 7. Đề xuất ngắn (chưa làm)

Mục tiêu: NCC ghi nhận "đã nhận tiền mặt đợt 2", ưu tiên **không đổi cấu trúc DB**.

### Phương án A (không đổi DB): dùng chính việc `PAY:<orderId>`

- Coi việc `PAY:<orderId>` ở `Done` là "đã nhận tiền mặt phần còn lại"; `completed_date` của việc là **ngày nhận** (đã có sẵn cột, `order-tasks.service.ts:204`).
- Việc cần làm:
  1. Backend: đơn trả thêm `restPayment: { status: 'Pending' | 'Received', receivedDate }` suy từ việc `PAY:` (một truy vấn đọc, không ghi thêm).
  2. Nút "Đã nhận tiền mặt" trên chi tiết đơn NCC gọi lại `PATCH …/tasks/:taskId { status: 'Done' }` của việc PAY (API đã có); nút "Bỏ ghi nhận" đưa về `Waiting`.
  3. **Không** đóng việc `PAY:` tự động khi hoàn thành đơn (`order-lifecycle.ts:75`); đơn Completed mà `PAY:` chưa Done hiện "Chưa nhận" (màu cam; nhãn "Chưa ghi nhận thu đợt 2" ở bản đầu đã đổi thành chữ này).
  4. `restState` trong `PaymentScheduleTable.tsx` và câu của hóa đơn cuối đọc từ `restPayment` thay vì suy từ trạng thái đơn; hóa đơn cuối chỉ ghi "đã thanh toán tiền mặt" khi đã ghi nhận, còn không thì "còn lại … thanh toán trực tiếp cho NCC".
  5. (Tùy chọn) Chặn "Hoàn tất" hoặc cảnh báo khi chưa ghi nhận đợt 2; tự hoàn thành sau E+7 giữ nguyên nhưng hiển thị "Chưa ghi nhận thu".
- Ưu điểm: không đổi CSDL; tận dụng realtime, thông báo khách, nhắc hạn đã có. Hạn chế: số tiền nhận không được lưu riêng (luôn bằng tổng − cọc); việc `PAY:` chỉ có từ khi đơn cọc sau khi có đợt 2 (đơn cũ thiếu việc này, cần `timelines:repair --orders=…` hoặc coi như "chưa ghi nhận").

### Phương án B (đổi DB, nếu cần lưu số tiền và ngày nhận)

Chỉ thêm cột nullable, không sửa dữ liệu cũ (chạy thủ công trên Supabase, chưa chạy):

```sql
-- Ghi nhận đã nhận tiền mặt đợt 2 (phần còn lại) của đơn
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rest_paid_amount numeric(18,2) NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rest_paid_date timestamptz NULL;
ALTER TABLE public.orders ADD CONSTRAINT ck_orders_rest_paid
  CHECK ((rest_paid_amount IS NULL) = (rest_paid_date IS NULL) AND (rest_paid_amount IS NULL OR rest_paid_amount >= 0));
COMMIT;
-- Rollback: ALTER TABLE public.orders DROP CONSTRAINT ck_orders_rest_paid, DROP COLUMN rest_paid_amount, DROP COLUMN rest_paid_date;
```

Rồi thêm model field trong `schema.prisma`, API `POST /vendors/me/orders/:id/rest-paid { amount?, date? }` (mặc định = tổng − cọc, ngày = hôm nay) và `DELETE` để bỏ ghi nhận. Không dùng bảng `payments` cho đợt 2 vì `order_id` unique và CHECK buộc `transaction_code` + `paid_date` khi `Paid`.

### Khuyến nghị

Làm **phương án A trước** (không đổi DB), chỉnh luôn câu của hóa đơn cuối để không còn khẳng định "đã thanh toán" khi chưa ghi nhận. Chỉ chuyển sang B nếu nhóm cần lưu số tiền thực nhận (ví dụ nhận khác số dự kiến) hoặc đối soát sau này.

---

## Đã làm (phương án A, không đổi cấu trúc DB)

Quy ước: việc timeline `PAY:<orderId>` ở `Done` = NCC đã nhận đủ tiền mặt phần còn lại, `completed_date` của việc = ngày nhận; `Waiting` (hoặc `Todo`) = chưa nhận.

### Backend

- **`restPayment` trong mọi API trả đơn** (NCC và khách, danh sách và chi tiết): `{ amount: tổng − cọc, status: 'Pending' | 'Received' | 'NotApplicable', receivedDate }`. `NotApplicable` khi đơn chưa cọc, hết hạn hoặc đã hủy. Việc `PAY:` được nạp cùng truy vấn đơn (`ORDER_INCLUDE` trong `order-mapping.ts`), không N+1. Đơn cũ không có việc PAY là `Pending`.
- **`POST /vendors/me/orders/:id/rest-payment`**: ghi nhận (đơn Deposited hoặc Completed của NCC). Chưa có việc `PAY:` thì tạo (hạn = max(E + 7, hạn lớn nhất của việc của đơn)) rồi đặt Done, `completed_date` = bây giờ. Khách nhận thông báo "<NCC> đã xác nhận nhận đủ <số tiền> tiền mặt cho đơn <mã>". **`DELETE`** cùng route: bỏ ghi nhận (về Waiting).
- **Kéo / đổi việc PAY sang Done** ở Bảng việc, Theo đơn, Lịch gọi cùng hàm `applyRestReceived` và cùng thông báo (`setStatus`, `recordsRestPayment`).
- **`POST …/complete`** nhận `{ restReceived?: boolean }`: đã Received thì hoàn tất như cũ; chưa Received mà `restReceived === true` thì ghi nhận rồi hoàn tất **trong cùng transaction** (`completeOrder` nhận `opts.restReceived`); chưa Received mà không gửi thì **409 `REST_PAYMENT_NOT_RECORDED`** kèm `details.amount`.
- **`completeOrder` (và `autoComplete` sau E+7) không còn tự đóng việc `PAY:`**: vẫn đóng các việc chi tiết khác kể cả Waiting. Đơn Completed mà PAY chưa Done có `restPayment.status = 'Pending'`.
- **`POST …/final-invoice`** chỉ chạy khi `restPayment = Received` (409 `REST_PAYMENT_NOT_RECORDED`). Câu trong tin và chứng từ: "đã thanh toán tiền mặt <số tiền> ngày dd/mm/yyyy" theo ngày nhận thật.
- **Nhắc hạn:** việc `PAY:` chưa Done vẫn được nhắc khi đơn là Deposited hoặc Completed; sau khi Received (Done) thì không nhắc nữa.
- Code: `backend/src/modules/orders/rest-payment.ts` (hàm thuần và ghi nhận, dùng chung), `order-lifecycle.ts`, `orders.service.ts`, `orders.controller.ts`, `order-tasks.service.ts`, `order-mapping.ts`, `order-reminders.ts`. Test: `backend/test/rest-payment.test.ts`.

### Frontend

- **NCC:** lịch thanh toán (Đợt 2: "Đã nhận tiền mặt · dd/mm" xanh / "Chưa nhận" vàng / "Không thu" khi hủy); nút "Đã nhận tiền mặt" (và "Bỏ ghi nhận tiền mặt") ở thẻ đơn, bảng đơn, chi tiết đơn, có hộp xác nhận; "Hoàn tất" hỏi "Bạn đã nhận đủ … chưa?" với "Đã nhận, hoàn tất" / "Chưa, để sau"; cột "Thanh toán" hai dòng Đợt 1 / Đợt 2 (đơn Completed mà chưa nhận: cùng chữ "Chưa nhận", màu cam; nhãn "Chưa ghi nhận thu đợt 2" của bản đầu đã bỏ); "Xuất hóa đơn" mờ kèm tooltip "Ghi nhận đã nhận tiền mặt trước" khi chưa nhận; thẻ PAY ở Bảng việc, Theo đơn, Lịch sang Đã xong đều hỏi xác nhận.
- **Khách:** thẻ đơn, chi tiết đơn, lịch thanh toán: "Đợt 2 · <số tiền> tiền mặt — Đã thanh toán dd/mm" hoặc "Chưa thanh toán (trả trực tiếp cho NCC)"; việc PAY trên timeline khi Received hiện xám với nhãn "Đã thanh toán dd/mm".
- Code: `frontend/src/features/vendorOrders/restPayment.ts` (nhãn dùng chung, có test), `actions.tsx`, `components/RestReceivedDialog.tsx`, `PaymentScheduleTable.tsx`, `OrdersTable.tsx`, `OrderCard.tsx` (NCC và khách), `MyOrderCard.tsx`, `InvoiceDialog.tsx`, `TaskBoard.tsx`, `OrderProgressPanel.tsx`, `VendorCalendarPage.tsx`, `TimelineRow.tsx`.

### Lưu ý

- Đơn đã Completed **trước thay đổi này** có việc PAY đã bị đóng Done tự động (`completed_date` = lúc hoàn thành), nên sẽ hiện "Đã nhận" dù NCC chưa từng ghi nhận. Chưa sửa dữ liệu cũ.
- Hóa đơn cuối đã xuất trước đây vẫn giữ câu cũ ("đã thanh toán tiền mặt …" không kèm ngày).
- Số tiền đợt 2 luôn là tổng − cọc; không lưu số tiền thực nhận riêng (cần phương án B nếu muốn).

### Cập nhật giao diện (cột Thanh toán, chat)

- **Bảng đơn NCC:** cột "Thanh toán" (thay "Đặt cọc") hai dòng nhỏ: Đợt 1 (✓ xanh / ○ xám, "CK dd/mm" hoặc "Chưa cọc") và Đợt 2 ("Tiền mặt" và trạng thái: ✓ "Đã nhận dd/mm" xanh; ○ "Chưa nhận" vàng khi Deposited; ! "Chưa nhận" cam khi Completed; "—" khi chưa cọc / hết hạn / hủy). Chữ "Chưa nhận" bấm được để mở hộp xác nhận. Không còn thanh tiến độ.
- **Nút trên dòng:** giữ một nút chính tùy trạng thái (Hoàn tất, Cập nhật đơn, Tạo lại đơn, Sửa theo yêu cầu), dạng viền, cỡ nhỏ, chữ tự xuống dòng; **không** có nút "Đã nhận tiền mặt" trên dòng. Menu "⋯" có mọi thao tác, gồm "Ghi nhận đã nhận tiền mặt" / "Bỏ ghi nhận tiền mặt".
- **Chat:** hóa đơn cuối (NCC xuất) nằm bên phải ở chat NCC và bên trái kèm tên NCC ở chat khách; giấy xác nhận cọc và tin hệ thống nằm giữa ("Forever xác nhận"). Người gửi suy theo loại tin nên tin cũ lưu sai sender vẫn đúng (`frontend/src/features/chat/messageSender.ts`).

