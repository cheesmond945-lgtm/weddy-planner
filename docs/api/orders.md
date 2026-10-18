# API: orders (phía cặp đôi)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/chat.ts`).
> Quy ước chung: [README.md](README.md).
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md` (trạng thái đơn).**

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
