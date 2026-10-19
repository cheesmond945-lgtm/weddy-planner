# API: commissions (hoa hồng NCC trả WebPlan)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/vendorCommissions.ts`; cách tính ở `frontend/src/features/commissions/calc.ts`).
> Quy ước chung: [README.md](README.md). Khoản thu: xem [orders.md](orders.md) phần Nhà cung cấp (`OrderPayment`).
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md`**: tên trường, trạng thái suy từ prototype NCC (`docs/prototype/prototype_vendor`, màn Tài chính & đối soát) và quyết định của nhóm.

Phạm vi: NCC xem bảng kê hoa hồng theo kỳ tháng, chi tiết đơn / khoản thu tính hoa hồng, gửi minh chứng đã chuyển tiền cho WebPlan.
Chưa có: Admin xác nhận / từ chối minh chứng, cấu hình tỷ lệ (làm khi tới phần Admin, bổ sung vào đây).

## Cách tính (theo quyết định của nhóm)

| Mục | Quy tắc |
|---|---|
| Kỳ | Tháng dương lịch theo giờ Việt Nam (`Asia/Ho_Chi_Minh`). Mã bảng kê `DS<MM><YYYY>`, ví dụ `DS092026` |
| Đơn vào kỳ | **Đơn hoàn thành**: `ServiceOrder` có `status = CONFIRMED` và `eventDate` (phiên bản hiện hành) trong tháng của kỳ. Đơn hủy, chưa xác nhận không tính |
| Căn cứ | Tổng các khoản đã thu thực tế của đơn (`payments`, cả VNPay lẫn NCC tự ghi nhận) có `paidAt` **trước thời điểm chốt kỳ** (00:00 ngày 1 tháng sau, giờ VN) |
| Thu sau chốt | Khoản thu của đơn đã tính, `paidAt` sau thời điểm chốt: thành **dòng bổ sung** (`SUPPLEMENT`) ở kỳ của tháng thu. Bảng kê đã chốt không đổi |
| Tỷ lệ | Theo lĩnh vực của NCC (danh mục `GET /categories`), số nguyên phần trăm: **Nhà hàng 8%, Chụp ảnh 12%, Trang phục 12%, lĩnh vực khác 10%**. Lưu vào từng dòng (`rate`) để đổi tỷ lệ sau không ảnh hưởng kỳ cũ |
| Hoa hồng | Mỗi dòng: `round(baseAmount × rate / 100)` tới đồng; kỳ = tổng các dòng |
| Chốt kỳ | Cuối tháng. BE có job chốt (ARCHITECTURE: `backend/src/jobs`, bảng kê hoa hồng tháng) chụp lại số liệu kỳ vừa hết |
| Hạn thanh toán | **Ngày 20 tháng sau** (prototype: kỳ 09/2026 hạn 20/10/2026) |
| Kỳ hiện tại | Luôn có, `status = OPEN` (tạm tính), số liệu đổi khi có đơn hoàn thành / khoản thu mới; chưa thanh toán được |

Lĩnh vực của dòng: lĩnh vực đã xác minh của NCC (`verifiedCategory`, chưa có thì `category`) vì đơn không gắn danh mục riêng. **Cần chốt** nếu sau này một NCC có nhiều lĩnh vực.

## Trạng thái bảng kê (`CommissionStatus`)

| Giá trị | Nhãn FE | Khi |
|---|---|---|
| `OPEN` | Đang tạm tính | Kỳ hiện tại, chưa chốt |
| `UNPAID` | Chưa thanh toán | Đã chốt, chưa có khoản nào được xác nhận, không có minh chứng chờ |
| `PARTIALLY_PAID` | Chưa thanh toán đủ | Đã xác nhận một phần, không có minh chứng chờ |
| `PENDING_CONFIRMATION` | Chờ xác nhận | Có minh chứng `PENDING` |
| `PAID` | Đã thanh toán | `paidAmount ≥ commissionAmount` |

`isOverdue`: đã chốt, chưa `PAID`, quá `dueDate` (giờ VN). FE hiện thêm nhãn "Quá hạn".

Minh chứng (`CommissionPaymentStatus`): `PENDING` (Chờ xác nhận), `CONFIRMED` (Đã xác nhận, cộng vào `paidAmount`), `REJECTED` (Bị từ chối, kèm `reviewNote`).

## Đối tượng

`CommissionStatementSummary`

```json
{
  "id": "DS092026",
  "code": "DS092026",
  "period": "2026-09",
  "status": "PARTIALLY_PAID",
  "orderCount": 2,
  "supplementCount": 0,
  "baseAmount": 150000000,
  "commissionAmount": 12000000,
  "paidAmount": 5000000,
  "pendingAmount": 0,
  "closingDate": "2026-09-30",
  "dueDate": "2026-10-20",
  "isOverdue": false
}
```

`CommissionStatement` = `CommissionStatementSummary` + `lines`, `payments`, `transfer`:

```json
{
  "lines": [
    {
      "id": "so-1015-2026-09",
      "kind": "ORDER",
      "orderId": "so-1015",
      "orderCode": "#WP1015",
      "customerName": "Bích Ngọc & Thành Công",
      "eventDate": "2026-09-12",
      "category": { "id": "cat-1", "slug": "nha-hang", "name": "Nhà hàng" },
      "rate": 8,
      "baseAmount": 90000000,
      "commissionAmount": 7200000,
      "payments": [
        { "paymentId": "p-1", "installmentName": "Đợt 1 – Đặt cọc", "paidAt": "2026-08-05T04:30:00.000Z", "method": "VNPAY", "amount": 20000000 },
        { "paymentId": "p-2", "installmentName": "Đợt 2 – Thanh toán còn lại", "paidAt": "2026-09-12T14:30:00.000Z", "method": "CASH", "amount": 70000000 }
      ],
      "originPeriod": null
    }
  ],
  "payments": [
    {
      "id": "cp-3",
      "amount": 5000000,
      "proofFile": { "url": "https://…", "publicId": "…", "fileName": "uy-nhiem-chi.jpg", "size": 180000, "mimeType": "image/jpeg" },
      "note": "Trả trước một phần",
      "submittedAt": "2026-10-07T09:00:00.000Z",
      "status": "CONFIRMED",
      "reviewedAt": "2026-10-08T03:40:00.000Z",
      "reviewNote": null
    }
  ],
  "transfer": { "accountName": "WEBPLAN", "bankName": "…", "accountNumber": "…", "content": "DS092026 — Công ty TNHH Mây Palace" }
}
```

| Trường | Ghi chú |
|---|---|
| `lines[].kind` | `ORDER`: đơn hoàn thành của kỳ; `SUPPLEMENT`: khoản thu sau chốt của đơn kỳ `originPeriod` |
| `lines[].payments` | Các khoản thu làm căn cứ (đợt, thời điểm, hình thức thanh toán, số tiền) |
| `transfer` | Tài khoản nhận của WebPlan (BE cấu hình); `content` là nội dung chuyển khoản để đối chiếu |
| `payments` | Các lần NCC gửi minh chứng, mới nhất trước |

---

### GET /vendors/me/commissions
Role: VENDOR

Bảng kê mọi kỳ có phát sinh của NCC, mới nhất trước; luôn có kỳ hiện tại (`OPEN`). Không phân trang (mỗi tháng một dòng).

Response 200: `{ "data": CommissionStatementSummary[] }`

### GET /vendors/me/commissions/:id
Role: VENDOR

`:id` là mã bảng kê (`DS092026`).

Response 200: `{ "data": CommissionStatement }`

Lỗi: 404 `COMMISSION_STATEMENT_NOT_FOUND`

### POST /vendors/me/commissions/:id/payments
Role: VENDOR

Gửi minh chứng đã chuyển tiền hoa hồng. Tệp upload trước bằng `POST /vendors/me/uploads/signature` với `purpose = PAYMENT_PROOF` ([vendors.md](vendors.md)).

Request

```json
{ "amount": 7000000, "proofFile": { "url": "…", "publicId": "…", "fileName": "…", "size": 180000, "mimeType": "image/jpeg" }, "note": "VCB, mã GD 1019-88213" }
```

- Chỉ kỳ đã chốt (không `OPEN`), còn phải trả, và không có minh chứng đang `PENDING`.
- `0 < amount ≤ commissionAmount − paidAmount`. `proofFile` bắt buộc, `note` tùy chọn.
- Tạo minh chứng `PENDING`; số còn trả **chỉ giảm khi Admin xác nhận**.

Response 200: `{ "data": CommissionStatement }`

Lỗi: 400 `VALIDATION_ERROR`, 404 `COMMISSION_STATEMENT_NOT_FOUND`, 409 `COMMISSION_PERIOD_OPEN`, 409 `COMMISSION_NOT_PAYABLE` (đã đủ hoặc đang có minh chứng chờ)

## Mã lỗi riêng

| HTTP | `code` | Khi nào |
|---|---|---|
| 404 | `COMMISSION_STATEMENT_NOT_FOUND` | Không có bảng kê hoặc của NCC khác |
| 409 | `COMMISSION_PERIOD_OPEN` | Thanh toán kỳ chưa chốt |
| 409 | `COMMISSION_NOT_PAYABLE` | Kỳ đã thanh toán đủ, hoặc đang có minh chứng chờ xác nhận |

## Ghi chú về dữ liệu giả

Mock không lưu bảng kê: mỗi lần gọi tính lại từ khoản thu của các đơn trong `mocks/vendorChat.ts` (Mây Palace có 5 đơn hoàn thành tháng 07–10/2026, một khoản thu sau chốt). Chỉ lưu các lần gửi minh chứng (`localStorage` khóa `weddy.mock.vendorCommissions`). Khi có minh chứng chờ, hộp chi tiết có nút **Giả lập Admin xác nhận / từ chối**, chỉ có trong mock.

## Khác biệt với prototype NCC

- Prototype ghi cứng số liệu 3 kỳ, không có tỷ lệ; ở đây tính từ khoản thu thật theo các quy tắc trên.
- Thêm cột "Đã thu (căn cứ)", chi tiết từng đơn / khoản thu, dòng bổ sung, trạng thái "Đang tạm tính", "Chưa thanh toán", nhãn "Quá hạn".
- Gửi minh chứng thêm ghi chú đối chiếu; lịch sử các lần gửi kèm trạng thái và ghi chú của Admin.
- Tài khoản WebPlan trong mock giữ như prototype ("WEBPLAN DEMO", không dùng chuyển tiền).

## Cần chốt

1. NCC có nhiều lĩnh vực thì lấy tỷ lệ theo đâu (gói của đơn, hay lĩnh vực chính).
2. Đơn có thu thừa / hoàn tiền sau khi chốt: có trừ lại hoa hồng ở kỳ sau không.
3. Quá hạn thanh toán hoa hồng: có hạn chế gì với NCC (ẩn dịch vụ, khóa gửi duyệt…) không.
