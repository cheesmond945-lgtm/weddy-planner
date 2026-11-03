# API: weddings (thông tin đám cưới, timeline, kế hoạch, gợi ý AI, tổng quan, ngân sách, khách mời, nhập/xuất)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/planning.ts`).
> Quy ước chung: [README.md](README.md). `ServiceSummary`, `CategoryRef`: xem [catalog.md](catalog.md). `Order`: xem [orders.md](orders.md).
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md`:** tên thực thể, trường, enum `PlanItemStatus` đang suy từ prototype (mục 4.1–4.4, 5.1).

Role cho mọi endpoint: **COUPLE**. Mỗi tài khoản cặp đôi có đúng **một** đám cưới (`weddings.user_id`); mọi endpoint làm việc trên đám cưới của chính người gọi (`/weddings/me`). Không có thành viên cùng lập kế hoạch, vai trò hay phân quyền theo tab (bỏ 02/11/2026). Muốn cho người khác xem thì dùng link xem công khai: [sharing.md](sharing.md).

Chưa thiết lập đám cưới: các endpoint (trừ `GET`/`PUT /weddings/me`) trả 409 `WEDDING_NOT_SET`.

---

## 1. Thông tin đám cưới (4.1)

`Wedding`

```json
{
  "id": "wd-1",
  "groomName": "Nguyễn Văn An",
  "brideName": "Trần Thị Bình",
  "date": "2027-02-15",
  "location": "Hà Nội",
  "ward": "Phường Cầu Giấy",
  "guestCount": 300,
  "budget": 600000000,
  "budgetPreset": "BALANCED",
  "tableCountOverride": null,
  "version": "2026-10-30T08:15:02.123Z",
  "categorySlugs": ["nha-hang", "decor", "trang-phuc", "makeup", "chup-anh", "co-cuoi", "hoa-cuoi"]
}
```

| Trường | Quy tắc |
|---|---|
| `date` | Ngày, bắt buộc, sau hôm nay |
| `groomName`, `brideName` | Bắt buộc, tối đa 100 ký tự. Lỗi: "Vui lòng nhập tên chú rể." / "Vui lòng nhập tên cô dâu." |
| `location` | **Chỉ có ở response**, BE luôn lưu `"Hà Nội"` (NCC chỉ có ở Hà Nội nên form không hỏi). Body có gửi thì bị bỏ qua. Vẫn trả về để gợi ý AI lọc theo khu vực |
| `ward` | "Nơi tổ chức": một phường/xã của Hà Nội từ 01/07/2025 (Nghị quyết 1656/NQ-UBTVQH15: 51 phường, 75 xã), **có tiền tố**: `"Phường Cầu Giấy"`, `"Xã Đông Anh"`. Danh sách: `backend/src/modules/weddings/wards.ts`. Form bắt buộc chọn; API nhận `null`/không gửi (không gửi thì giữ nguyên khi sửa). Giá trị khác danh sách: lỗi "Nơi tổ chức phải là một phường/xã của Hà Nội." `null` ở response là đám cưới cũ chưa chọn. Chưa chạy `prisma/manual/2026-11-01-01-wedding-ward.sql` thì trường bị bỏ qua khi lưu |
| `guestCount` | "Số khách dự kiến", bắt buộc, số nguyên ≥ 1 |
| `budget` | Đồng, bắt buộc, > 0 |
| `budgetPreset` | Mức chia ngân sách (mục 7): `BALANCED` (mặc định), `SPACE`, `VISUAL`; `CUSTOM` chỉ đặt ở tab Ngân sách (`PATCH …/budget/settings`, `PUT …/budget/split`), form gửi `CUSTOM` thì lỗi. Không bắt buộc; sửa đám cưới mà không gửi thì giữ nguyên. Thay `spendingTier` (bỏ 02/11/2026) |
| `tableCountOverride` | **Chỉ có ở response** của `GET/PUT`; đổi bằng `PATCH /weddings/me`. `null`: số bàn tự tính ⌈số khách / 10⌉ |
| `version` | **Chỉ có ở response**: `weddings.updated_date`, gửi kèm khi ghi để phát hiện ghi đồng thời (mục 7) |

Phong cách đã **bỏ** (30/10/2026): body có `styles` thì bị bỏ qua, response không còn trường này. Cột `weddings.style` vẫn giữ trong DB nhưng không dùng. Tag của gói do NCC nhập chỉ dùng cho tìm kiếm và bộ lọc ở trang dịch vụ.
| `categorySlugs` | Hạng mục muốn dùng, `slug` trong `GET /categories`, ít nhất 1 |

### GET /weddings/me
Response 200: `{ "data": Wedding }`, hoặc `{ "data": null }` khi chưa thiết lập (FE dựa vào đây để mở hộp thiết lập sau lần đăng nhập đầu).

### PUT /weddings/me
Tạo hoặc cập nhật. Body: `Wedding` không có `id` và `location`. Response 200: `{ "data": Wedding }`. Form tạo mới và form chỉnh sửa dùng chung thứ tự trường và quy tắc trên; `budgetPreset` là trường duy nhất không bắt buộc. Gửi kèm `version` thì kiểm tra ghi đồng thời (không gửi thì không kiểm tra, để form cũ vẫn chạy).

- **Lần đầu tạo**: lưu ngày tạo làm mốc bắt đầu, tạo 4 việc mặc định (việc đầu đã xong): Xác định ngân sách và quy mô tiệc; Lập danh sách khách mời sơ bộ; Thiết kế và gửi thiệp mời; Xác nhận lần cuối với các nhà cung cấp.
- **Đổi `date`**: các hạn trên timeline **tự tính lại theo tỷ lệ** thời gian giữa mốc bắt đầu và ngày cưới (prototype lưu mỗi mốc dạng tỷ lệ 0..1).

Lỗi: 400 `VALIDATION_ERROR`, `details` theo từng trường (`groomName`, `brideName`, `date`, `ward`, `guestCount`, `budget`, `budgetPreset`, `categorySlugs`)

### PATCH /weddings/me
Đổi nhanh ở tab Ngân sách. Body: một hoặc nhiều trường `{ "budget"?, "guestCount"?, "tableCountOverride"? (null: về số tự tính, 1–500) }` kèm `"version"` (bắt buộc). Phân bổ tính lại khi đọc. Mức chia, tiệc tự lo: `PATCH /weddings/me/budget/settings` (mục 7). Response 200: `{ "data": Wedding }`.

Lỗi: 400 `VALIDATION_ERROR`, 400 `VERSION_REQUIRED`, 409 `STALE_DATA`

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
  "serviceId": "sv-2",
  "note": "Gọi trước 2 ngày"
}
```

- `note`: ghi chú, chuỗi tối đa 200 ký tự hoặc `null`. Không lưu người viết, thời điểm sửa, hay người đánh dấu xong (bỏ 02/11/2026). Link xem công khai không trả ghi chú.

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
Thêm việc. Body `{ "title": "Đặt xe hoa", "dueDate": "2027-01-10", "note"?: "…" }`. Response 200: timeline mới (như GET).

### PATCH /weddings/me/timeline/items/:itemId
Body: một hoặc nhiều trường `{ "title"?, "dueDate"?, "isDone"?, "note"? }`. `title`, `dueDate`, `isDone` theo cột "Sửa được" ở bảng trên; `note` sửa được ở mọi việc trừ `LOCKED`, `SERVICE_DATE`. `note: null` hoặc `""` là xóa ghi chú. Response 200: timeline mới.

Lỗi thêm: 400 `VALIDATION_ERROR` (ghi chú quá 200 ký tự).

### DELETE /weddings/me/timeline/tasks/:itemId
Chỉ việc `isCustom`. Response 200: timeline mới.

Lỗi chung của 3 endpoint trên: 400 `VALIDATION_ERROR`, 400 `DUE_DATE_OUT_OF_RANGE` (hạn nằm ngoài khoảng của loại việc, xem [TIMELINE.md](../TIMELINE.md) mục 7: việc tự thêm, khung, chi tiết trước sự kiện từ hôm nay đến **ngày cưới (gồm ngày cưới)**; việc neo ngày thực hiện đến ngày thực hiện của đơn; việc sau sự kiện từ mốc của nó, tối đa +365 ngày), 400 `DUE_DATE_ORDER` (việc Chọn NCC phải trước hoặc cùng ngày mốc Chốt của hạng mục), 400 `TIMELINE_ITEM_READONLY` (kể cả đổi hạn việc "Ngày thực hiện", do đơn quyết định), 403 `TIMELINE_ITEM_READONLY` (việc do NCC thực hiện, `owner` = `VENDOR`: khách chỉ xem, xem [TIMELINE.md](../TIMELINE.md) mục 8), 404 `TIMELINE_ITEM_NOT_FOUND`, 409 `TASK_NOT_CUSTOM`, 409 `WEDDING_NOT_SET`

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
  "package": { "id": "pk-3", "name": "Gói ngoại cảnh 1 ngày", "source": "PLANNED", "unavailable": false },
  "packages": [{ "id": "pk-3", "name": "Gói ngoại cảnh 1 ngày", "price": 14000000, "unit": "PACKAGE", "cost": 14000000, "capacity": null, "minTables": null, "fits": true }],
  "tables": 25,
  "order": { "id": "od-1", "code": "#001", "…": "Order mới nhất, hoặc null" }
}
```

`PlanItemStatus` (nhãn FE trong ngoặc): `PLANNED` (Dự kiến) → `DISCUSSING` (Đang trao đổi, khi bắt đầu nhắn tin hoặc khi cặp đôi yêu cầu sửa đơn) → `AWAITING_DEPOSIT` (Chờ thanh toán cọc, khi NCC gửi đơn) → `CONFIRMED` (Đã chốt, khi cọc xong).

`price` và `package` theo mục 7 (cách tính số 6): có đơn thì tổng đơn (`source: ORDER`, khóa đổi gói), khách đã chọn gói thì gói đó (`SELECTED`), chưa chọn thì gói dự kiến (`PLANNED`). `packages`: các gói đổi được, `cost` theo số bàn hiện tại, `fits = false` là không đủ chỗ cho số khách. `packageName`: tên dòng đầu của đơn nếu có, không thì tên gói đang tính.

### GET /weddings/me/plan-items
Response 200

```json
{ "data": { "categorySlugs": ["nha-hang", "decor", "chup-anh"], "items": [PlanItem] } }
```

`categorySlugs`: các hạng mục hiện trên trang kế hoạch (cùng quy tắc với timeline), đã sắp xếp. Không phân trang (tối đa số danh mục).

### POST /weddings/me/plan-items
Body `{ "serviceId": "sv-2", "replace": false, "packageId"?: "pk-1" }`. Response 200: `{ "data": PlanItem }` (trạng thái `PLANNED`). Có `packageId` ("Chọn gói này cho kế hoạch" ở trang chi tiết): gói phải thuộc nhà cung cấp đó, đã duyệt và đang hiện; nhà cung cấp đã có trong kế hoạch thì đổi sang gói này.

- Hạng mục đã có dịch vụ khác ở `PLANNED`/`DISCUSSING` và `replace = false` → 409 `PLAN_CATEGORY_TAKEN`, `details: { "existingItemId", "existingServiceName" }`. FE hỏi "Thay dịch vụ trong hạng mục?" rồi gọi lại với `replace = true`.
- `replace = true`: bỏ dịch vụ cũ **cùng hội thoại và đơn chưa cọc** của nó, rồi thêm dịch vụ mới.

Lỗi: 404 `SERVICE_NOT_FOUND`, 400 `PACKAGE_NOT_AVAILABLE`, 409 `PLAN_ITEM_EXISTS`, 409 `PLAN_CATEGORY_TAKEN`, 409 `PLAN_CATEGORY_LOCKED` (hạng mục đang chờ cọc hoặc đã chốt), 409 `PLAN_VENDOR_LOCKED`

### PATCH /weddings/me/plan-vendors/:vendorId
Chọn gói cho nhà cung cấp trong kế hoạch. Body `{ "packageId": "pk-1" | null, "version": "…" }` (`null`: về gói dự kiến). Response 200: `{ "data": PlanItem }`.

Lỗi: 404 `PLAN_ITEM_NOT_FOUND`, 400 `PACKAGE_NOT_AVAILABLE` (gói không thuộc nhà cung cấp, chưa duyệt hoặc đã ẩn), 409 `PLAN_VENDOR_LOCKED` (đã có đơn, giá theo đơn), 400 `VERSION_REQUIRED`, 409 `STALE_DATA`

### DELETE /weddings/me/plan-items/:id
Chỉ khi `PLANNED` hoặc `DISCUSSING`. Bỏ luôn hội thoại của dịch vụ. Response 200: `{ "data": null }`.

Lỗi: 404 `PLAN_ITEM_NOT_FOUND`, 409 `PLAN_ITEM_LOCKED`

---

## 4. Gợi ý AI (4.3)

### POST /weddings/me/ai-suggestions
"Gợi ý cho bạn" theo hạng mục: thuật toán theo luật ở backend, **không gọi AI/LLM**. Body `{ "categorySlug": "nha-hang" }`.
Hàm thuần: `backend/src/modules/weddings/suggest-rules.ts` (unit test `backend/test/suggest-rules.test.cjs`); hằng số: `suggest.config.ts`.

Response 200

```json
{
  "data": {
    "category": { "id": "cat-1", "slug": "nha-hang", "name": "Trung tâm tổ chức sự kiện" },
    "budget": 104000000,
    "budgetSource": "ESTIMATED",
    "budgetReason": "Theo giá gói mức Cân đối",
    "location": "Hà Nội",
    "ward": "Phường Cầu Giấy",
    "guestCount": 150,
    "tables": 15,
    "suggestions": [
      {
        "service": { "id": "sv-1", "name": "Mipec Place", "…": "ServiceSummary" },
        "package": { "id": "pk-2", "name": "Sảnh Cánh Bướm Hồng", "cost": 100000000, "chargedTables": 20, "calculation": "Sảnh Cánh Bướm Hồng: 20 bàn × 5.000.000đ = 100.000.000đ (tối thiểu 20 bàn)" },
        "reasons": ["Khoảng 100.000.000đ cho 20 bàn", "Cùng phường Cầu Giấy với địa điểm tổ chức", "Ít đánh giá"],
        "warning": "Gói này tối thiểu 20 bàn, nhiều hơn dự kiến 5 bàn",
        "fewReviews": true
      }
    ],
    "totalInCategory": 8,
    "outOfBudgetCount": 2,
    "cheapest": null,
    "cheapestPackage": null,
    "raiseBudgetTo": null,
    "noVenueFits": false,
    "categoryId": "cat-1",
    "isChosenCategory": true,
    "version": "…"
  }
}
```

Lọc cứng (không đạt thì loại):

- Cùng hạng mục, nhà cung cấp đã duyệt và đang hiển thị, cùng tỉnh/thành với đám cưới, **chưa có trong kế hoạch**.
- Nhà hàng: có sảnh sức chứa ≥ số khách.
- Chi phí ước tính thấp nhất ≤ ngân sách hạng mục (ngân sách hiển thị ở tab Ngân sách; `budgetSource` `ALLOCATED` khi khách sửa tay, `ESTIMATED` khi là số gợi ý). Dịch vụ thường: giá gói thấp nhất. Nhà hàng: min theo gói đủ chỗ của đơn giá/bàn × max(số bàn dự kiến, số bàn tối thiểu); số bàn dự kiến = số khách / 10 hoặc số khách tự nhập. Không so đơn giá với ngân sách.

Xếp hạng (lấy tối đa `SUGGESTION_COUNT` = 3):

1. Địa điểm: đám cưới có phường/xã (`weddings.ward`) thì cùng phường/xã xếp trước. Chưa có dữ liệu (hoặc DB chưa chạy SQL `wedding-ward`) thì bỏ bước này. Chưa có tọa độ nên chưa xếp theo khoảng cách.
2. Mức khớp ngân sách: `BUDGET_FIT_DIRECTION` = `CLOSEST` (mặc định) chi phí gần ngân sách hơn trước, `CHEAPEST` chi phí thấp hơn trước.
3. Điểm đánh giá trung bình trên web (bảng `reviews`) giảm dần, chưa có đánh giá xếp sau; rồi số lượt đánh giá giảm dần.
4. Số phong cách trùng với phong cách khách chọn (nếu có dữ liệu).

Không loại theo điểm: dưới `MIN_REVIEWS` = 3 lượt chỉ gắn `fewReviews` và lý do "Ít đánh giá".

Lý do (`reasons`, 3 ý, chỉ từ điều kiện đã khớp thật): "Giá từ X, nằm trong ngân sách {hạng mục}" (nhà hàng: "Khoảng X cho N bàn"); "Cùng phường … với địa điểm tổ chức" hoặc "Cùng khu vực tổ chức"; "Đánh giá 4.5/5 từ 12 lượt" hoặc "Ít đánh giá". `warning`: nhà hàng có số bàn tối thiểu cao hơn dự kiến.

Không có gợi ý: `cheapest`, `cheapestPackage` là dịch vụ có chi phí ước tính thấp nhất ngoài ngân sách, `raiseBudgetTo` = đúng chi phí đó; `noVenueFits` khi không nhà hàng nào có sảnh đủ chỗ. `totalInCategory`, `outOfBudgetCount` để FE ghi "Xem thêm n dịch vụ" / "Xem tất cả dịch vụ". `guestCount`, `tables` chỉ có giá trị với nhà hàng.

Lỗi: 400 `VALIDATION_ERROR`, 409 `WEDDING_NOT_SET`

---

## 5. Thành viên (đã bỏ 02/11/2026)

Không còn `GET/PATCH/DELETE /weddings/me/members…`. Giữ số mục để không lệch các liên kết "mục 6–9".

---

## 6. Tổng quan

### GET /weddings/me/overview
Một endpoint cho toàn bộ subtab Tổng quan. Cặp đôi luôn nhận đủ mọi phần; phần là `null` chỉ khi xem qua link công khai mà tab đó không được chia sẻ ([sharing.md](sharing.md)).

```json
{
  "tasks": {
    "done": 5, "total": 18, "overdue": 1,
    "upcoming": [{ "id": "…", "title": "Chốt nhà hàng", "dueDate": "2026-11-05", "daysLeft": 7, "category": { "slug": "nha-hang", "…": "CategoryRef" } }],
    "byCategory": [{ "slug": "nha-hang", "name": "Trung tâm tổ chức sự kiện", "done": 1, "total": 3 }, { "slug": null, "name": "Việc chung", "done": 2, "total": 4 }]
  },
  "budget": {
    "total": 500000000, "planned": 260000000, "deposited": 30000000, "remaining": 240000000,
    "slices": [{ "slug": "nha-hang", "name": "…", "amount": 200000000, "budget": 200000000, "isOver": false }, { "slug": "other", "name": "Chi phí khác", "amount": 8000000, "budget": 0, "isOver": false }]
  },
  "guests": "GuestStats (mục 8) hoặc null"
}
```

- `tasks` không tính việc `LOCKED`. `upcoming`: 5 việc chưa xong có hạn sớm nhất (gồm cả việc quá hạn, `daysLeft` âm).
- `budget.slices`: các hạng mục có giá > 0, cộng lát "Chi phí khác" (`slug: "other"`) nếu có.

---

## 7. Ngân sách, gợi ý phân bổ và chi phí khác

Thuật toán, **không gọi AI**. Đặc tả gốc của luồng Tùy chỉnh: tài liệu triển khai "Luồng Tùy chỉnh ngân sách" v1.2 (03/11/2026).

- Quỹ dịch vụ, tiệc, gói gợi ý: hàm thuần `backend/src/modules/weddings/allocation.ts` (test `backend/test/allocation.test.cjs`).
- Tỷ lệ số nguyên, tự cân bằng, khóa, nhóm chia thay đổi, giới hạn gợi ý: `budget-split.ts`. Bản sao giống hệt ở `frontend/src/features/weddings/budgetSplit.ts` để kéo thanh là tính ngay; `budgetSplit.test.ts` chạy bộ test mục 8 (T01–T63) trên **cả hai** bản.
- Thay cách chia theo B3 (dồn phần dư, trần cứng) và tỷ lệ % số thực (bỏ 03/11/2026).

**Nguyên tắc**

1. Dữ liệu gốc: tổng ngân sách, số khách, mức chia, dịch vụ đã chọn (kèm gói hoặc đơn), giá gói trong DB, cấu hình Tùy chỉnh. Số tiền phân bổ là **giá trị dẫn xuất**, tính lại mỗi lần đọc, không lưu. Chỉ lưu tỷ lệ, trạng thái khóa, danh sách dịch vụ bỏ khỏi phần chia và giá trần.
2. Hạng mục đã chọn luôn được trừ trước, nên kết quả không phụ thuộc thứ tự khách chọn.
3. Ngân sách là ràng buộc **mềm**: không có gói trong giới hạn thì gợi ý gói rẻ nhất kèm nhãn "Vượt Y"; khách tự chọn thì được vượt, kèm cảnh báo. Chỉ chặn gói tiệc vượt sức chứa.

**Chi phí**

- Số bàn = `tableCountOverride` nếu có, ngược lại ⌈số khách / `GUESTS_PER_TABLE` (10)⌉.
- Gói tiệc: đơn giá/bàn × max(số bàn, `min_tables`); chỉ xét gói có sức chứa ≥ số khách. Ví dụ 5,8tr/bàn, tối thiểu 40 bàn, kế hoạch 30 bàn = **232tr**. Gói khác: giá trọn gói.
- Chỉ tính gói đang hiển thị: gói `Approved`, NCC `Approved` (không ẩn), tài khoản `Active`.
- Hạng mục đã chọn: có đơn còn hiệu lực thì giá đơn (`ORDER` "Theo đơn"; `Deposited`/`Completed` là `DEPOSITED` "Đã cọc {x}"); chưa có đơn thì gói khách chọn, mặc định gói rẻ nhất (`PLANNED` "Dự kiến").
- NCC có đơn đã hủy, không còn đơn hiệu lực: hạng mục trở về **chưa chọn**. Cọc của đơn hủy theo yêu cầu khách (`CUSTOMER_REQUEST`, đã nộp) là tiền cọc đã mất, vẫn trừ vào tổng.
- Tiệc tự lo (`ownVenue`): bỏ trung tâm tiệc khỏi phép tính; `ownVenueCost` trừ vào tổng. Chi phí ngoài nền tảng cũng trừ vào tổng.

**Mặt bằng giá**: giá rẻ nhất, trung vị (kiểu `PERCENTILE_CONT(0.5)`), đắt nhất (`maxPackagePrice`) của từng hạng mục, từ các gói hợp lệ. Tiệc tính theo số bàn và sức chứa, không lọc khu vực. Hạng mục không có gói hợp lệ: `NO_VENDOR` ("Chưa có gói dịch vụ phù hợp"; tiệc: "Chưa có gói tiệc phù hợp").

**Quỹ dịch vụ** (`fund`)

- Còn lại = tổng − mọi hạng mục đã chọn (kể cả tiệc, đơn đã cọc) − cọc mất − tiệc tự lo − chi phí ngoài nền tảng.
- Tiệc chưa chọn, không tự lo, có gói hợp lệ: trừ gói tiệc tốt nhất trong giới hạn (giới hạn = còn lại − Σ trung vị các dịch vụ trong nhóm chia); đều vượt thì gói rẻ nhất, `venue.overBy` = "Vượt Y". Không có gói hợp lệ: chưa trừ tiệc, `venue.status = NO_PACKAGE`, cảnh báo "Chưa có gói tiệc phù hợp, tiền tiệc chưa được trừ".
- Kế hoạch không có hạng mục trung tâm tiệc: `venue.status = NONE`, quỹ không trừ tiệc; tab Ngân sách nhắc "Kế hoạch chưa có trung tâm tiệc nên quỹ dịch vụ đang gồm cả phần thường dành cho tiệc" kèm hai lối tắt "Thêm trung tâm tiệc" (thêm vào Dịch vụ muốn sử dụng) và "Tự lo tiệc". Tự lo tiệc tính cả khi không có hạng mục tiệc (`venue.status = OWN`).
- Gói tiệc đề xuất chỉ lấy sảnh **còn trống ngày cưới** (từ 03/11/2026): bỏ sảnh có đơn đã cọc / hoàn thành của khách khác hoặc NCC đánh dấu bận ngày đó ([LICH_BAN_SANH.md](../LICH_BAN_SANH.md)); đơn của chính đám cưới không tính. Chưa có ngày cưới thì không lọc.
- `serviceBudgetRaw` = còn lại − gói tiệc đề xuất (có thể âm); `serviceBudget` = max(raw, 0). ≤ 0: "Ngân sách hiện tại chưa đủ cho phần dịch vụ còn lại", tắt ô nhập số tiền, tỷ lệ vẫn chỉnh được.

**Nhóm chia**: các dịch vụ (không phải tiệc) **chưa chọn**, có gói hợp lệ, chưa bị bỏ khỏi phần chia. Hạng mục đã chọn, có đơn, đã cọc, bị bỏ và tiệc nằm ngoài nhóm.

- Tỷ lệ (`ratio`) là số nguyên theo 0,01%, tổng nhóm đúng 10000. Mọi phép chia qua `distribute` (BigInt, làm tròn xuống rồi cộng phần thiếu cho phần lẻ lớn nhất, hòa theo thứ tự Trang trí, Chụp ảnh, Trang phục, Trang điểm, Hoa cưới).
- Phương án có sẵn: tỷ lệ = trung vị × h (h nhân 10: `H10`), khởi tạo lại mỗi lần đọc.

| Mức | h |
|---|---|
| `BALANCED` Cân bằng (mặc định) | 1 cho mọi dịch vụ |
| `SPACE` Ưu tiên không gian | trang trí 1,3 |
| `VISUAL` Ưu tiên hình ảnh | chụp ảnh 1,5; trang phục 1,3; trang điểm 1,2 |
| `CUSTOM` Tùy chỉnh | cấu hình đã lưu (bên dưới) |

- Tiền hạng mục = quỹ × tỷ lệ / 10000 (`limit`, chính xác tới đồng). Nhóm một hạng mục: min(giá trần, quỹ), phần chênh là "Còn dư". Nhóm rỗng: cả quỹ là "Còn dư" (`totals.leftover`).
- Gói gợi ý: gói tốt nhất có chi phí ≤ tiền hạng mục (cùng phường/xã trước, gần giới hạn, đánh giá, số lượt, phong cách trùng); không có thì gói rẻ nhất kèm `label = { code: 'OVER_BY', amount }`.
- Cảnh báo giá gói cao nhất (chỉ ở client, không chặn, không lưu): vạch ở `floor(maxPackagePrice × 10000 / quỹ)`; tiền > giá gói cao nhất thì "Gói cao nhất của {dịch vụ} là X, phần còn lại khoảng Y sẽ không dùng hết", nút "Về mức gói cao nhất".

**Giới hạn gợi ý** của hạng mục đã chọn / có đơn **chưa cọc** (dịch vụ): tỷ lệ ảo = w_i / (Σ w nhóm + w_i), w = trung vị × h của phương án nền; giới hạn = max(0, `serviceBudgetRaw` + giá đang chọn của i) × tỷ lệ ảo. Không phụ thuộc gói đang chọn của chính i. Hạng mục đã cọc không có. Một số duy nhất (`limit`) dùng chung cho tab Ngân sách, "Gợi ý cho bạn" (mục 4) và So sánh ([compare.md](compare.md)); `shareLimit` ở `allocation.ts` là tên cũ của cùng số.

**Tùy chỉnh** (`CUSTOM`)

- Cấu hình lưu ở `weddings.custom_weights` (jsonb, không cần SQL mới): `{ format: 2, version, baseMode, excluded: [categoryId], capAmount, items: [{ categoryId, slug, ratio, locked, updatedAt }], updatedAt }`. Dạng cũ (slug → %) coi như chưa có cấu hình. `version` là số phiên bản riêng của cấu hình (không đổi `weddings.updated_date`).
- Vào Tùy chỉnh lần đầu: khởi tạo từ phương án đang dùng (`baseMode`), mọi hạng mục mở khóa. Đổi sang phương án có sẵn không xóa cấu hình; quay lại Tùy chỉnh thì dùng lại.
- Tự cân bằng: hạng mục k (mở khóa) đặt p, kẹp về [0, 10000 − L] (L = tổng các mục khóa), các mục mở khóa khác chia 10000 − L − p theo tương quan hiện tại (đều 0 thì chia đều). Mục mở khóa duy nhất luôn bằng 10000 − L. Nhập %: tối đa 2 chữ số thập phân. Nhập số tiền: floor(số tiền × 10000 / quỹ).
- Khóa: không khóa được mục mở khóa cuối cùng; khóa mục 0% thì nhắc kèm lối tắt "Bỏ khỏi phần chia".
- Nhóm chia đổi (đọc lại khi khách chọn gói, có đơn, hủy đơn, bỏ / thêm lại): mục rời nhóm thì phần của nó chia cho các mục mở khóa; nếu mọi mục còn lại đều khóa thì mở khóa đúng mục lớn nhất và báo. Mục quay lại nhận tỷ lệ khởi đầu theo trọng số phương án nền. Sau mỗi thay đổi nhóm, giá trần bị xóa. Backend áp các thay đổi này khi đọc `GET /budget` và lưu lại (`split.notices` chứa thông báo mở khóa).
- "Đặt lại theo phương án nền": khởi tạo lại tỷ lệ, mở khóa tất cả, xóa giá trần, giữ danh sách đã bỏ.
- Tự lưu (FE `useBudgetSplit.ts`): kéo / nhập chỉ tính ở client; lưu khi nhả thanh, rời ô, khóa, bỏ / thêm lại, đổi giá trần, đặt lại; debounce 800ms; lỗi mạng thử lại 2 lần (1 giây, 2 giây); 422 hoặc vẫn lỗi thì trả về cấu hình đã lưu; 409 nhận bản mới nhất ("Tỷ lệ đã được cập nhật ở nơi khác."); rời trang thì gửi ngay (keepalive).

**Hiển thị**: mọi số tiền phân bổ làm tròn gần nhất tới 10.000đ (`DISPLAY_ROUND_UNIT`, 5.000đ làm tròn lên); backend giữ số chính xác; dòng tổng ghi "≈". Mỗi thanh ghi "% quỹ" kèm số tiền. "Quỹ dịch vụ: X" kèm ⓘ chi tiết; dòng "Tiệc" chỉ đọc kèm % tổng ngân sách; quỹ đổi mà khách không chạm thanh thì "Quỹ dịch vụ vừa thay đổi vì {lý do}" (8 giây). Dưới quỹ luôn có "Dự kiến chi tối đa: X · Còn dư: Y" (mỗi hạng mục tiêu tối đa tới giá gói đắt nhất). Khóa ba mức có sẵn (chỉ hiển thị, không đổi cấu hình đã lưu) khi ở **cả 3 mức**, **mọi** dịch vụ trong nhóm đều được chia ≥ giá gói đắt nhất (quỹ × ratio_i(mức) ≥ maxPackagePrice_i); bật cần dư 5% (`PRESET_LOCK_MARGIN`), tắt khi không còn đủ, để quỹ dao động quanh ngưỡng không làm giao diện nhảy. Khi khóa: thẻ đang chọn giữ nguyên, hai thẻ còn lại nhạt; ẩn thanh xem trước, thay bằng mức chi tối đa từng dịch vụ; hộp thông báo "Các mức chia có sẵn không ảnh hưởng gợi ý. Muốn giới hạn chi cho từng dịch vụ, dùng Tùy chỉnh."; Tùy chỉnh vẫn dùng được với thanh kéo và vạch giá gói như thường. Tùy chỉnh mà mọi dịch vụ đều vượt gói đắt nhất: một dòng chung thay cho cảnh báo từng dòng. Cột "Gợi ý" của hạng mục có phân bổ lớn hơn gói đắt nhất hiện giá gói đắt nhất, phân bổ ghi nhỏ bên dưới.

**Khác**

- B0 khả thi (chỉ cảnh báo): tối thiểu cần = các khoản đã chọn + giá rẻ nhất của mọi hạng mục chưa chọn trong nhóm và tiệc. Thiếu thì "Ngân sách chưa đủ cho số khách này, cần tối thiểu X" kèm 3 hướng.
- Khách tự chọn gói (dropdown, chỉ khi chưa có đơn): mỗi gói kèm `consequence`; gói tiệc vượt sức chứa `fits = false`. Tiệc đã chọn mà số khách vượt sức chứa: `overCapacity = true`.
- Vượt ngân sách (`overBudget`, cảnh báo mềm): `strong` khi giá đơn thật đã vượt, `soft` khi do số dự kiến.
- Đổi số khách khi tiệc đã cọc: yêu cầu điều chỉnh đơn, xem [orders.md](orders.md).

`Budget`

```json
{
  "version": "2026-11-03T08:15:02.123Z",
  "preset": "CUSTOM",
  "presetLabel": "Tùy chỉnh",
  "ownVenue": false,
  "ownVenueCost": null,
  "guestCount": 300,
  "tables": { "count": 30, "auto": 30, "override": null },
  "fund": {
    "totalBudget": 350000000, "selectedCost": 40000000, "venueSelectedCost": 0, "lostDeposit": 0, "selfVenueCost": 0, "externalCost": 2000000,
    "remaining": 308000000, "venue": { "status": "SUGGESTED", "amount": 150000000, "overBy": null },
    "serviceBudgetRaw": 158000000, "serviceBudget": 158000000
  },
  "split": {
    "mode": "CUSTOM",
    "baseMode": "BALANCED",
    "config": { "version": 4, "baseMode": "BALANCED", "excluded": ["…"], "capAmount": null, "items": [{ "categoryId": "…", "ratio": 6400, "locked": false }, { "categoryId": "…", "ratio": 3600, "locked": true }] },
    "eligible": [{ "categoryId": "…", "slug": "chup-anh", "median": 16000000 }],
    "notices": []
  },
  "categories": [{
    "categoryId": "…", "slug": "chup-anh", "name": "Chụp ảnh", "kind": "SERVICE", "status": "SUGGESTED", "cost": 30000000,
    "ratio": 6400, "limit": 101120000, "minPrice": 8000000, "medianPrice": 16000000, "maxPackagePrice": 30000000, "message": null,
    "suggestion": { "packageId": "…", "packageName": "Trọn ngày", "vendorId": "…", "vendorName": "Mộc Studio", "cost": 30000000, "chargedTables": null, "unit": "PACKAGE", "label": null },
    "packages": [{ "id": "…", "cost": 30000000, "place": 0, "rating": 4.8, "reviewCount": 12, "overlap": 1, "vendorId": "…", "vendorName": "Mộc Studio", "name": "Trọn ngày", "chargedTables": null, "unit": "PACKAGE" }],
    "vendors": []
  }, {
    "categoryId": "…", "slug": "decor", "name": "Trang trí", "kind": "SERVICE", "status": "CHOSEN", "cost": 35000000,
    "ratio": null, "limit": 41800000, "minPrice": 10000000, "medianPrice": 19000000, "maxPackagePrice": 35000000, "message": null, "suggestion": null, "packages": [],
    "vendors": [{ "id": "…", "name": "Lala Wedding House", "status": "PLANNED", "cost": 35000000, "hasOrder": false, "costSource": "PLANNED", "deposited": 0, "overCapacity": false,
      "package": { "id": "…", "name": "Chandelier", "source": "SELECTED", "unavailable": false, "unit": "PACKAGE", "minTables": null, "chargedTables": null }, "options": [] }]
  }],
  "totals": { "total": 350000000, "ordersTotal": 0, "deposited": 0, "owed": 0, "plannedTotal": 40000000, "lostDeposits": 0, "extraCosts": 2000000, "ownVenueCost": 0, "remaining": 308000000, "suggestedTotal": 180000000, "leftover": 0 },
  "status": "OK",
  "overBudget": null,
  "feasibility": { "ok": true, "minNeed": 167000000, "shortfall": 0, "message": null, "options": [] },
  "extraCosts": [{ "id": "…", "name": "Thiệp cưới", "amount": 2000000, "createdDate": "…" }],
  "warnings": []
}
```

- `categories[].status`: `CHOSEN`, `SUGGESTED` (trong nhóm chia, hoặc tiệc được đề xuất), `NO_VENDOR`, `OWN_VENUE`, `EXCLUDED` (bỏ khỏi phần chia: không tỷ lệ, không ngân sách, không gợi ý gói). `packages` chỉ có ở hạng mục trong nhóm chia và hạng mục đã bỏ.
- `totals.remaining` = tổng − giá đơn đã chốt − dự kiến chưa chốt (− cọc mất, tiệc tự lo, chi phí khác); không trừ thêm số đã cọc. `owed` = `ordersTotal − deposited`.
- `warnings[].code`: `PACKAGE_UNAVAILABLE`.

**Ghi đồng thời.** Các thao tác ghi đám cưới (`PATCH /weddings/me`, `…/budget/settings`, chi phí khác, `…/plan-vendors/:vendorId`) gửi `version` (`weddings.updated_date`); lệch thì 409 `STALE_DATA`, thiếu thì 400 `VERSION_REQUIRED`. Cấu hình Tùy chỉnh dùng `split.config.version` riêng (xem `PUT …/budget/split`).

### GET /weddings/me/budget
Response 200: `{ "data": Budget }`. Đang Tùy chỉnh mà nhóm chia đã đổi từ lần lưu trước: backend áp onGroupChange, lưu lại (version + 1) rồi trả về.

### PATCH /weddings/me/budget/settings
Mức chia, tiệc tự lo. Body: một hoặc nhiều trường `budgetPreset` (`BALANCED` | `SPACE` | `VISUAL` | `CUSTOM`), `ownVenue` (boolean), `ownVenueCost` (số nguyên ≥ 0 hoặc null), kèm `version`. Chọn `CUSTOM` lần đầu thì khởi tạo cấu hình từ phương án đang dùng. Response 200: `Budget`. Lỗi: 400 `VALIDATION_ERROR`, 409 `STALE_DATA`, 503 `DB_MIGRATION_PENDING`.

### PUT /weddings/me/budget/split
Tự lưu toàn bộ cấu hình Tùy chỉnh. Body `{ "version": 4, "baseMode": "BALANCED", "excluded": ["<categoryId>"], "capAmount": null, "items": [{ "categoryId": "…", "ratio": 6400, "locked": false }] }`.

Backend kiểm tra rồi mới ghi; sai bất kỳ điều kiện nào thì 422 `BUDGET_SPLIT_INVALID` và giữ cấu hình cũ:
- tổng `ratio` đúng 10000, mỗi `ratio` nguyên 0..10000;
- `items` đúng các hạng mục trong nhóm chia hiện tại;
- nhóm từ 2 hạng mục còn ít nhất một mục mở khóa;
- `capAmount` null hoặc nguyên ≥ 0, chỉ khác null khi nhóm có đúng một hạng mục;
- `excluded` chỉ gồm dịch vụ chưa chọn.

`version` lệch thì 409 `BUDGET_SPLIT_CONFLICT`, `details.budget` là ngân sách mới nhất. Response 200: `Budget` (`split.config.version` + 1). Lưu cũng đặt `budgetPreset = CUSTOM`.

Các đường dẫn cũ (`PUT/DELETE …/budget/categories/:id`, `POST …/budget/reset`, `POST …/budget/rebalance`) đã bỏ (404). `customWeights` ở `…/budget/settings` đã bỏ (03/11/2026).

### POST /weddings/me/extra-costs
Chi phí khác ngoài WebPlan. Body `{ "name": "Thiệp cưới", "amount": 3000000, "version": "…" }` (tên tối đa 100 ký tự, số tiền nguyên dương). Response 201: `Budget`. Lỗi: 400 `VALIDATION_ERROR` (`details.name`, `details.amount`), 409 `EXTRA_COST_LIMIT` (tối đa 200 khoản).

### PATCH /weddings/me/extra-costs/:id
Body: `name` và/hoặc `amount`, kèm `version`. Response 200: `Budget`. Lỗi: 404 `EXTRA_COST_NOT_FOUND`.

### DELETE /weddings/me/extra-costs/:id?version=…
Response 200: `Budget`. Lỗi: 404 `EXTRA_COST_NOT_FOUND`.

---

## 8. Khách mời

`Guest`

```json
{ "id": "…", "fullName": "Nguyễn Văn An", "side": "GROOM", "group": "Bạn bè", "partySize": 2, "isInvited": true, "rsvp": "ATTENDING", "createdDate": "…" }
```

| Trường | Quy tắc |
|---|---|
| `fullName` | Bắt buộc, tối đa 100 ký tự. Trùng **tên (bỏ dấu, không phân biệt hoa thường) + bên** với khách đã có thì 409 `GUEST_DUPLICATE` |
| `side` | `GROOM` (nhà trai) hoặc `BRIDE` (nhà gái) |
| `group` | Gia đình, Họ hàng, Bạn bè, Đồng nghiệp, Khác (mặc định) hoặc tự nhập tối đa 30 ký tự |
| `partySize` | Số người tính cả khách, 1–50, mặc định 1 |
| `isInvited` | Mặc định `false` |
| `rsvp` | `PENDING` (chưa phản hồi), `ATTENDING` (sẽ đến), `DECLINED` (từ chối). Chỉ khác `PENDING` khi đã mời; bỏ `isInvited` thì tự về `PENDING` |

`GuestStats` (tính theo số người, `rows` là số dòng):

```json
{ "total": 320, "expected": 300, "invited": 250, "attending": 180, "declined": 20, "pending": 50, "notInvited": 70, "bride": 150, "groom": 170, "rows": 140 }
```

### GET /weddings/me/guests
Response 200: `{ "data": { "items": Guest[], "stats": GuestStats } }`

### POST /weddings/me/guests
Body: `Guest` không có `id`, `createdDate`. Response 201: danh sách mới (như GET).

### POST /weddings/me/guests/bulk
Thêm nhiều khách, mỗi dòng một tên: `{ "names": ["Trần Bình", "Lê Cường"], "side": "BRIDE", "group": "Gia đình" }` (tối đa 500 tên). Có tên trùng thì không thêm gì, trả 409 `GUEST_DUPLICATE` với `details.duplicates`. Response 201: danh sách mới.

### PATCH /weddings/me/guests/:id
Body: một hoặc nhiều trường của `Guest`. Chọn `rsvp` khác `PENDING` khi chưa mời: 400 `VALIDATION_ERROR`. Response 200: danh sách mới.

### DELETE /weddings/me/guests/:id
Response 200: danh sách mới.

Lỗi chung: 400 `VALIDATION_ERROR` (`details` theo trường), 404 `GUEST_NOT_FOUND`, 409 `GUEST_DUPLICATE`, 409 `GUEST_LIMIT` (tối đa 2000 khách).

---

## 9. Nhập và xuất Excel/CSV

FE đọc file (.xlsx, .xls, .csv; tối đa 500 dòng, 2 MB) bằng SheetJS, tự ghép cột theo từ đồng nghĩa (bỏ dấu, có ô chọn tay), rồi gửi các dòng đã ghép cho BE. **BE kiểm tra lại từng dòng** (hàm thuần `backend/src/modules/weddings/import-rows.ts`); FE gọi `dryRun` để xem trước lỗi, nên hai bên luôn ra cùng một kết quả.

### POST /weddings/me/import/{guests|tasks|expenses}

```json
{ "rows": [{ "name": "Nguyễn An", "side": "Nhà trai", "partySize": "2" }], "mode": "APPEND", "dryRun": true, "dateOrder": "DMY" }
```

| Loại | Trường của mỗi dòng | Ghi chú |
|---|---|---|
| `guests` | `name`*, `side`*, `group`, `partySize`, `invited`, `rsvp` | Bên nhận "Nhà trai/Nhà gái", "Trai/Gái", "CR/CD". Đã mời nhận "x", "có", "rồi"… Có phản hồi thì tính là đã mời (cảnh báo). Trùng tên + bên trong file hoặc với danh sách hiện có là lỗi |
| `tasks` | `title`*, `dueDate`*, `note` | Chỉ thêm vào. Hạn: `YYYY-MM-DD`, `ngày/tháng/năm`, số ngày của Excel; `dateOrder: "MDY"` chỉ được khi cột có ngày mà số thứ hai > 12 và không ngày nào số đầu > 12. |
| `expenses` | `title`*, `amount`* | Chi phí khác ngoài WebPlan (bảng `wedding_extra_costs`, cột `name`). Số tiền nhận "5tr", "5 triệu", "1,5tr", "500k", "5.000.000đ". Khi ghi (không `dryRun`) phải gửi `version` như mục 7 |

- `mode`: `APPEND` (mặc định) hoặc `REPLACE` (xóa hết rồi thêm; chỉ `guests`, `expenses`).
- Không `dryRun`: chỉ ghi các dòng hợp lệ, bỏ qua dòng lỗi.

Response 200:

```json
{ "total": 3, "valid": 2, "invalid": 1, "created": 2, "issues": [{ "row": 3, "errors": ["Không hiểu bên \"hàng xóm\" (dùng Nhà trai hoặc Nhà gái)."], "warnings": [] }] }
```

`issues` chỉ gồm dòng có lỗi hoặc cảnh báo; `row` đếm từ 1, không tính dòng tiêu đề. Lỗi: 400 `IMPORT_EMPTY`, 400 `IMPORT_TOO_MANY_ROWS`, 400 `VALIDATION_ERROR`, 409 `GUEST_LIMIT`/`EXPENSE_LIMIT`.

### Tải về và file mẫu
File CSV UTF-8 có BOM (Excel mở đúng tiếng Việt), không bọc `{ data }`. Ô bắt đầu bằng `=`, `+`, `-`, `@` được thêm dấu `'` để Excel không chạy công thức.

| Endpoint | File | Cột |
|---|---|---|
| `GET /weddings/me/export/guests.csv` | `khach-moi.csv` | Tên khách, Bên, Nhóm, Số người, Đã mời, Phản hồi |
| `GET /weddings/me/export/tasks.csv` | `cong-viec.csv` | Việc, Hạn, Ghi chú, Hạng mục, Trạng thái (không gồm việc `LOCKED`) |
| `GET /weddings/me/export/budget.csv` | `ngan-sach.csv` | Loại, Tên, Ngân sách, Dịch vụ đã chọn, Trạng thái, Giá, Giá cao nhất, Chênh lệch |
| `GET /weddings/me/import/{guests\|tasks\|expenses}/template.csv` | `mau-….csv` | Tiêu đề + 2 dòng ví dụ, nhập lại được ngay |

---

## Cần chốt

1. Tên thực thể, trường, enum theo `docs/database.md` / `state-diagrams.md`.
2. Có làm màn hình phân bổ ngân sách theo hạng mục không (prototype có nút "Điều chỉnh ngân sách hạng mục" nhưng chưa có màn hình; FE đang dẫn về trang Kế hoạch).
3. Mô hình LLM dùng cho gợi ý, và có lưu lịch sử gợi ý không.
