# API: weddings (thông tin đám cưới, timeline, kế hoạch, gợi ý AI)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/planning.ts`).
> Quy ước chung: [README.md](README.md). `ServiceSummary`, `CategoryRef`: xem [catalog.md](catalog.md). `Order`: xem [orders.md](orders.md).
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md`:** tên thực thể, trường, enum `PlanItemStatus` đang suy từ prototype (mục 4.1–4.4, 5.1).

Role cho mọi endpoint: **COUPLE**. Mỗi cặp đôi có **một** đám cưới; mọi endpoint làm việc trên đám cưới của người gọi (`/weddings/me`).

---

## 1. Thông tin đám cưới (4.1)

`Wedding`

```json
{
  "id": "wd-1",
  "date": "2027-02-15",
  "location": "Hà Nội",
  "guestCount": 300,
  "budget": 600000000,
  "styles": ["Sang trọng"],
  "categorySlugs": ["nha-hang", "decor", "trang-phuc", "makeup", "chup-anh", "co-cuoi", "hoa-cuoi"]
}
```

| Trường | Quy tắc |
|---|---|
| `date` | Ngày, bắt buộc, sau hôm nay |
| `location` | Bắt buộc, một giá trị trong `GET /services/locations` |
| `guestCount` | Số nguyên ≥ 1 hoặc `null` (không bắt buộc) |
| `budget` | Đồng, bắt buộc, > 0 |
| `styles` | Mảng, giá trị trong `GET /services/styles`, có thể rỗng |
| `categorySlugs` | Hạng mục muốn dùng, `slug` trong `GET /categories`, có thể rỗng |

### GET /weddings/me
Response 200: `{ "data": Wedding }`, hoặc `{ "data": null }` khi chưa thiết lập (FE dựa vào đây để mở hộp thiết lập sau lần đăng nhập đầu).

### PUT /weddings/me
Tạo hoặc cập nhật. Body: `Wedding` không có `id`. Response 200: `{ "data": Wedding }`.

- **Lần đầu tạo**: lưu ngày tạo làm mốc bắt đầu, tạo 4 việc mặc định (việc đầu đã xong): Xác định ngân sách và quy mô tiệc; Lập danh sách khách mời sơ bộ; Thiết kế và gửi thiệp mời; Xác nhận lần cuối với các nhà cung cấp.
- **Đổi `date`**: các hạn trên timeline **tự tính lại theo tỷ lệ** thời gian giữa mốc bắt đầu và ngày cưới (prototype lưu mỗi mốc dạng tỷ lệ 0..1).

Lỗi: 400 `VALIDATION_ERROR`

---

## 2. Timeline (4.2, 4.4)

`TimelineItem`

```json
{
  "id": "deadline-nha-hang",
  "kind": "CATEGORY_DEADLINE",
  "title": "Chốt nhà hàng",
  "dueDate": "2026-11-13",
  "isDone": false,
  "isCustom": false,
  "category": { "id": "cat-1", "slug": "nha-hang", "name": "Nhà hàng" },
  "serviceName": "Sen Vàng Convention",
  "planStatus": "PLANNED",
  "serviceId": "sv-2"
}
```

| `kind` | Ý nghĩa | Sửa được |
|---|---|---|
| `TASK` | Việc chung (mặc định hoặc tự thêm, `isCustom`) | `title`, `dueDate`, `isDone`; xóa nếu `isCustom` |
| `CATEGORY_DEADLINE` | "Chốt <hạng mục>" cho mỗi hạng mục trên timeline. `isDone` = đã đặt cọc dịch vụ của hạng mục. Kèm `serviceName`/`planStatus`/`serviceId` của dịch vụ trong kế hoạch (nếu có) | `dueDate` |
| `SERVICE_TASK` | Việc chi tiết của dịch vụ đã cọc; `serviceName` là tên dịch vụ | `dueDate`, `isDone` |
| `SERVICE_DATE` | Ngày thực hiện dịch vụ khi khác ngày cưới (lấy từ đơn đã cọc) | không |
| `LOCKED` | Chỗ giữ "Việc chi tiết của <hạng mục>" khi chưa cọc. `dueDate = null` | không |

- Hạng mục trên timeline = `categorySlugs` của đám cưới ∪ hạng mục đã có dịch vụ trong kế hoạch, theo thứ tự danh mục.
- Hạn mặc định của "Chốt …" theo hạng mục (tỷ lệ thời gian chuẩn bị): nhà hàng, cỗ cưới 0,22; trang phục 0,30; chụp ảnh 0,32; decor, hoa cưới 0,38; makeup 0,45.
- Việc chi tiết mở ra khi đặt cọc (tên và tỷ lệ theo prototype, ví dụ nhà hàng: Xác nhận số bàn và thực đơn 0,40; Chọn bàn tiệc và sơ đồ chỗ ngồi 0,70; Chạy thử thực đơn 0,80; Chốt số khách lần cuối 0,93). Hạn được giữ trong khoảng [hôm nay + 2 ngày, trước ngày cưới].
- Danh sách trả về **đã sắp xếp** theo hạn (`LOCKED` nằm ở vị trí 0,7). FE không sắp xếp lại.
- Tiến độ trên giao diện = số mục đã xong / số mục trừ `LOCKED` và `SERVICE_DATE`.

### GET /weddings/me/timeline
Response 200: `{ "data": { "items": TimelineItem[] } }`

Lỗi: 409 `WEDDING_NOT_SET`

### POST /weddings/me/timeline/tasks
Thêm việc. Body `{ "title": "Đặt xe hoa", "dueDate": "2027-01-10" }`. Response 200: timeline mới (như GET).

### PATCH /weddings/me/timeline/items/:itemId
Body: một hoặc nhiều trường `{ "title"?, "dueDate"?, "isDone"? }`, chỉ các trường "Sửa được" ở bảng trên. Response 200: timeline mới.

### DELETE /weddings/me/timeline/tasks/:itemId
Chỉ việc `isCustom`. Response 200: timeline mới.

Lỗi chung của 3 endpoint trên: 400 `VALIDATION_ERROR`, 400 `DUE_DATE_OUT_OF_RANGE` (hạn phải từ hôm nay đến trước ngày cưới), 400 `TIMELINE_ITEM_READONLY`, 404 `TIMELINE_ITEM_NOT_FOUND`, 409 `TASK_NOT_CUSTOM`, 409 `WEDDING_NOT_SET`

---

## 3. Kế hoạch (5.1)

Mỗi hạng mục chọn **một** dịch vụ.

`PlanItem`

```json
{
  "id": "pi-1",
  "service": { "id": "sv-11", "name": "Lumi Wedding Studio", "…": "ServiceSummary" },
  "status": "AWAITING_DEPOSIT",
  "packageName": "Gói ngoại cảnh 1 ngày",
  "price": 14000000,
  "order": { "id": "od-1", "code": "#001", "…": "Order mới nhất, hoặc null" }
}
```

`PlanItemStatus` (nhãn FE trong ngoặc): `PLANNED` (Dự kiến) → `DISCUSSING` (Đang trao đổi, khi bắt đầu nhắn tin hoặc khi cặp đôi yêu cầu sửa đơn) → `AWAITING_DEPOSIT` (Chờ thanh toán cọc, khi NCC gửi đơn) → `CONFIRMED` (Đã chốt, khi cọc xong).

`packageName`, `price`: theo đơn NCC gửi nếu có, không thì gói đầu tiên của dịch vụ.

### GET /weddings/me/plan-items
Response 200

```json
{ "data": { "categorySlugs": ["nha-hang", "decor", "chup-anh"], "items": [PlanItem] } }
```

`categorySlugs`: các hạng mục hiện trên trang kế hoạch (cùng quy tắc với timeline), đã sắp xếp. Không phân trang (tối đa số danh mục).

### POST /weddings/me/plan-items
Body `{ "serviceId": "sv-2", "replace": false }`. Response 200: `{ "data": PlanItem }` (trạng thái `PLANNED`).

- Hạng mục đã có dịch vụ khác ở `PLANNED`/`DISCUSSING` và `replace = false` → 409 `PLAN_CATEGORY_TAKEN`, `details: { "existingItemId", "existingServiceName" }`. FE hỏi "Thay dịch vụ trong hạng mục?" rồi gọi lại với `replace = true`.
- `replace = true`: bỏ dịch vụ cũ **cùng hội thoại và đơn chưa cọc** của nó, rồi thêm dịch vụ mới.

Lỗi: 404 `SERVICE_NOT_FOUND`, 409 `PLAN_ITEM_EXISTS`, 409 `PLAN_CATEGORY_TAKEN`, 409 `PLAN_CATEGORY_LOCKED` (hạng mục đang chờ cọc hoặc đã chốt)

### DELETE /weddings/me/plan-items/:id
Chỉ khi `PLANNED` hoặc `DISCUSSING`. Bỏ luôn hội thoại của dịch vụ. Response 200: `{ "data": null }`.

Lỗi: 404 `PLAN_ITEM_NOT_FOUND`, 409 `PLAN_ITEM_LOCKED`

---

## 4. Gợi ý AI (4.3)

### POST /weddings/me/ai-suggestions
Body `{ "categorySlug": "nha-hang" }`. Mất vài giây (FE hiện trạng thái đang chọn).

Response 200

```json
{
  "data": {
    "category": { "id": "cat-1", "slug": "nha-hang", "name": "Nhà hàng" },
    "budget": 132000000,
    "budgetSource": "ESTIMATED",
    "location": "Hà Nội",
    "styles": ["Sang trọng"],
    "guestCount": 300,
    "suggestions": [
      {
        "service": { "id": "sv-1", "name": "Grand Lotus Palace", "…": "ServiceSummary" },
        "reasons": ["Giá từ 128 triệu, nằm trong ngân sách hạng mục.", "Hợp phong cách sang trọng.", "Điểm 4.7 trên Google Maps.", "Chứa tối đa 600 khách."]
      }
    ],
    "cheapest": null
  }
}
```

Quy tắc (aiPick trong prototype; bản thật gọi LLM rồi **đối chiếu lại** với danh sách NCC trên WebPlan, không trả dịch vụ không có thật):

- Ngân sách hạng mục = tổng ngân sách × tỷ lệ gợi ý, làm tròn 100.000đ (`budgetSource: "ESTIMATED"`). Tỷ lệ: nhà hàng 22%; decor, cỗ cưới 14%; chụp ảnh, hoa cưới 12%; trang phục 10%; makeup 8%. `ALLOCATED` dành cho khi có phân bổ ngân sách theo hạng mục (prototype chưa có màn hình này).
- Lọc: cùng khu vực, `priceFrom` ≤ ngân sách; riêng nhà hàng cần `capacity` ≥ `guestCount`.
- Xếp: trùng nhiều phong cách hơn → điểm cao hơn → nhiều đánh giá hơn; lấy tối đa 3.
- Không có gợi ý: `suggestions = []`, `cheapest` = dịch vụ rẻ nhất của hạng mục (ưu tiên cùng khu vực).
- `guestCount` chỉ có giá trị với nhà hàng.

Lỗi: 400 `VALIDATION_ERROR`, 409 `WEDDING_NOT_SET`

---

## Cần chốt

1. Tên thực thể, trường, enum theo `docs/database.md` / `state-diagrams.md`.
2. Có làm màn hình phân bổ ngân sách theo hạng mục không (prototype có nút "Điều chỉnh ngân sách hạng mục" nhưng chưa có màn hình; FE đang dẫn về trang Kế hoạch).
3. Mô hình LLM dùng cho gợi ý, và có lưu lịch sử gợi ý không.
