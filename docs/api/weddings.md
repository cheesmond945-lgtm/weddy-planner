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
| `budgetPreset` | Mức chia ngân sách (mục 7): `BALANCED` (mặc định), `SPACE`, `VISUAL`; `CUSTOM` chỉ đặt ở tab Ngân sách (`PATCH …/budget/settings`), form gửi `CUSTOM` thì lỗi. Không bắt buộc; sửa đám cưới mà không gửi thì giữ nguyên. Thay `spendingTier` (bỏ 02/11/2026) |
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

Thuật toán backend, **không gọi AI**: hàm thuần `backend/src/modules/weddings/allocation.ts` (test: `backend/test/allocation.test.cjs`, 19 tình huống của đặc tả), hằng số trong `allocation.config.ts`. FE không tự tính lại. Thay cho cách tính theo phân vị và mức Tiết kiệm / Cân đối / Cao cấp (bỏ 02/11/2026).

**Nguyên tắc**

1. Dữ liệu gốc chỉ gồm: tổng ngân sách, số khách, mức chia, các dịch vụ khách đã chọn (kèm gói hoặc đơn), giá gói trong DB. Phân bổ cho từng hạng mục là **giá trị dẫn xuất**, tính lại mỗi lần đọc; **không** có cột số tiền phân bổ (bảng `wedding_category_budgets` cũ không còn được đọc hay ghi).
2. Hạng mục đã chọn luôn được trừ trước, nên kết quả không phụ thuộc thứ tự khách chọn.
3. Ngân sách là ràng buộc **mềm**: gợi ý không bao giờ vượt (nhờ trần cứng); khách tự chọn thì được vượt, kèm cảnh báo hệ quả và trạng thái `OVER_BUDGET`. Không chặn theo ngân sách ở bất kỳ hạng mục nào. Chỉ chặn theo điều kiện kỹ thuật: gói tiệc vượt sức chứa.

**Chi phí**

- Số bàn = `tableCountOverride` nếu có, ngược lại ⌈số khách / `GUESTS_PER_TABLE` (10)⌉.
- Gói tiệc (Trung tâm tổ chức sự kiện): đơn giá/bàn × max(số bàn, `min_tables`); chỉ xét gói có sức chứa ≥ số khách. Ví dụ 5,8tr/bàn, tối thiểu 40 bàn, kế hoạch 30 bàn = **232tr** (không phải 174tr). Gói khác: giá trọn gói.
- Chỉ tính gói đang hiển thị: gói `Approved`, NCC `Approved` (không ẩn), tài khoản `Active`.
- Hạng mục đã chọn: có đơn còn hiệu lực thì giá đơn (`ORDER` "Theo đơn"; đơn `Deposited`/`Completed` là `DEPOSITED` "Đã cọc {x}"); chưa có đơn thì gói khách chọn, mặc định gói rẻ nhất (`PLANNED` "Dự kiến").
- NCC có đơn đã hủy và không còn đơn hiệu lực: hạng mục trở về **chưa chọn**. Cọc của đơn hủy theo yêu cầu của khách (`cancel_reason = CUSTOMER_REQUEST`, đã nộp cọc) là khoản mất, vẫn trừ vào tổng (`totals.lostDeposits`); NCC không thực hiện được (`VENDOR_UNABLE`) thì hoàn cọc ngoài hệ thống, không tính.
- Tiệc tự lo (`ownVenue`): bỏ trung tâm tiệc khỏi phép tính; `ownVenueCost` (tùy chọn) trừ vào tổng như khoản đã chọn. Chi phí khác ngoài WebPlan cũng trừ như khoản đã chọn.

**Mặt bằng giá**: giá rẻ nhất và trung vị (kiểu `PERCENTILE_CONT(0.5)`) của từng hạng mục, tính trong code từ các gói đang hiển thị đã tải. Tiệc tính theo từng kế hoạch (số bàn, sức chứa), **không** lọc theo khu vực. Hạng mục chưa có gói: `status = NO_VENDOR`, "Hiện chưa có NCC cho hạng mục X" (tiệc: "Chưa có trung tâm tiệc đủ sức chứa cho N khách").

**Mức chia** (`budgetPreset`, enum trong code): trọng số w_i = trung vị_i × h_i / Σ(trung vị_j × h_j), chỉ trên các dịch vụ chưa chọn (tiệc không nằm trong mức chia). h là tham số thiết kế, chỉnh ở `PRESET_H`:

| Mức | h |
|---|---|
| `BALANCED` Cân bằng (mặc định) | 1 cho mọi dịch vụ |
| `SPACE` Ưu tiên không gian | trang trí 1,3 |
| `VISUAL` Ưu tiên hình ảnh | chụp ảnh 1,5; trang phục 1,3; trang điểm 1,2 |
| `CUSTOM` Tùy chỉnh | tỷ lệ % khách kéo, lưu ở `weddings.custom_weights` |

**Thuật toán** (chạy lại từ đầu mỗi lần đọc)

- B0. Khả thi (chỉ cảnh báo): tối thiểu cần = các khoản đã chọn + giá rẻ nhất của mọi hạng mục chưa chọn (tiệc theo số bàn và sức chứa). Thiếu thì `feasibility.message` "Ngân sách chưa đủ cho số khách này, cần tối thiểu X" kèm 3 hướng: giảm số khách, tăng ngân sách, đổi gói rẻ hơn.
- B1. Còn lại = tổng − Σ chi phí hạng mục đã chọn − cọc mất − tiệc tự lo − chi phí khác.
- B2. Tiệc chưa chọn: Mục tiêu = còn lại − Σ trung vị dịch vụ chưa chọn; Trần cứng = còn lại − Σ giá rẻ nhất dịch vụ chưa chọn. Gợi ý gói tốt nhất ≤ Mục tiêu; không có thì gói rẻ nhất ≤ Trần cứng, nhãn `OVER_ALLOCATION` "Vượt phân bổ"; không có gói nào ≤ Trần cứng thì gói rẻ nhất, nhãn `OVER_BY` "Vượt X". Còn lại −= chi phí gói gợi ý.
- B3. Dịch vụ chưa chọn theo trọng số giảm dần: Phân bổ = còn lại × w / tổng w các hạng mục chưa xử lý; Trần cứng = còn lại − Σ giá rẻ nhất các hạng mục phía sau; Giới hạn = min(Phân bổ, Trần cứng). Chọn gói như B2. Tiền dư tự chuyển sang hạng mục sau.
- B4. Còn lại > 0: "Còn dư X: bạn có thể nâng gói hoặc thêm hạng mục".
- "Gói tốt nhất": cùng phường/xã với nơi tổ chức trước; rồi `BUDGET_FIT_DIRECTION` (`closest`: gần giới hạn nhất; `cheapest`); rồi điểm đánh giá, số lượt giảm dần; rồi số phong cách trùng.
- `limit` = Giới hạn ở bước B3 (dùng để chọn gói gợi ý). Hạng mục cuối của vòng duyệt nhận cả phần còn lại nên `limit` **không** dùng để hiển thị.
- **Tỷ lệ** (`share`, %) và **giới hạn riêng** (`shareLimit`) của từng dịch vụ **chưa cọc** (đã chọn hoặc chưa), để hiển thị "Gợi ý: X" / "Giới hạn gợi ý: X" và làm ngân sách hạng mục cho "Gợi ý cho bạn" (mục 4) và So sánh ([compare.md](compare.md)). `sliderPool` = tổng − tiệc (đã chọn hoặc gợi ý) − dịch vụ đã cọc − cọc mất − tiệc tự lo − chi phí khác; `shareLimit` = `sliderPool` × `share`. Cân bằng / Ưu tiên…: `share` = trung vị × h chuẩn hóa; Tùy chỉnh: tỷ lệ khách đặt (hạng mục chưa có tỷ lệ đã lưu nhận trung bình các tỷ lệ đã lưu), chuẩn hóa. Dịch vụ đã cọc: `share`, `shareLimit` = null (khóa). Tiệc: null, hiển thị Mục tiêu (`limit`). Gói đã chọn và gói gợi ý của hạng mục chưa chọn (B3) không đổi theo các số này.
- `presetWeights`: tỷ lệ % (8 chữ số thập phân) của các dịch vụ chưa cọc, tổng 100, để khởi tạo thanh kéo Tùy chỉnh; FE cho kéo thanh, gõ % hoặc gõ số tiền (= `sliderPool` × %). Dịch vụ đã cọc hiện khóa.
- Khách tự chọn gói (dropdown, chỉ khi chưa có đơn): mỗi gói kèm `consequence`, ví dụ "Chọn gói này, 5 dịch vụ còn lại còn tối đa X so với gói rẻ nhất cần Y, thiếu Z."; gói tiệc vượt sức chứa có `fits = false` (FE vô hiệu). Tiệc đã chọn mà số khách tăng vượt sức chứa: `overCapacity = true`, "Không còn phù hợp: vượt sức chứa".
- Vượt ngân sách (`overBudget`, cảnh báo mềm): "Vượt ngân sách X"; `level = strong` khi giá đơn thật (cộng cọc mất, chi phí khác, tiệc tự lo) đã vượt, `soft` khi vượt do số dự kiến.
- Đổi số khách khi tiệc đã cọc: yêu cầu điều chỉnh đơn (NCC xác nhận, cọc bổ sung 10% phần tăng, hạn 7 ngày trước ngày tổ chức), xem [orders.md](orders.md). Tab Ngân sách nhắc khách dùng nút "Đổi số khách" ở thẻ đơn.
- **Đã chốt (02/11/2026):**
  - Thanh kéo Tùy chỉnh gồm mọi dịch vụ **chưa cọc** (đã chọn hoặc chưa); dịch vụ đã cọc hiện khóa. Với dịch vụ đã chọn, số đặt ở thanh kéo là "Giới hạn gợi ý" (không đổi gói đã chọn).
  - Chỉ còn 1 dịch vụ chưa cọc: được đặt số tiền tuyệt đối (tỷ lệ < 100%), phần còn lại không giao cho hạng mục nào. Từ 2 dịch vụ trở lên: tổng 100%.
  - Giới hạn riêng (`shareLimit`) và số tiền ở thanh kéo làm tròn tới 1.000đ.
  - Giữ ô sửa số bàn (`tableCountOverride`) và khoản chi ngoài nền tảng (trừ như khoản đã chọn).

`Budget`

```json
{
  "version": "2026-11-02T08:15:02.123Z",
  "preset": "BALANCED",
  "presetLabel": "Cân bằng",
  "presetWeights": { "decor": 38, "chup-anh": 32, "trang-phuc": 16, "trang-diem": 6, "hoa-cuoi": 8 },
  "ownVenue": false,
  "ownVenueCost": null,
  "guestCount": 300,
  "tables": { "count": 30, "auto": 30, "override": null },
  "categories": [{
    "categoryId": "…", "slug": "nha-hang", "name": "Trung tâm tổ chức sự kiện", "kind": "VENUE",
    "status": "SUGGESTED", "cost": 150000000, "weight": null,
    "allocation": 150000000, "cap": 173000000, "limit": 150000000, "minPrice": 90000000, "medianPrice": 135000000, "message": null,
    "suggestion": { "packageId": "…", "packageName": "Sảnh Ngọc", "vendorId": "…", "vendorName": "Mipec Place", "cost": 150000000, "chargedTables": 30, "unit": "TABLE", "label": null },
    "vendors": []
  }, {
    "categoryId": "…", "slug": "decor", "name": "Trang trí", "kind": "SERVICE", "status": "CHOSEN", "cost": 23000000,
    "weight": null, "allocation": null, "cap": null, "limit": null, "minPrice": 10000000, "medianPrice": 19000000, "message": null, "suggestion": null,
    "vendors": [{
      "id": "…", "name": "Lala Wedding House", "status": "PLANNED", "cost": 23000000, "hasOrder": false, "costSource": "PLANNED", "deposited": 0, "overCapacity": false,
      "package": { "id": "…", "name": "Chandelier", "source": "SELECTED", "unavailable": false, "unit": "PACKAGE", "minTables": null, "chargedTables": null },
      "options": [{ "id": "…", "name": "Chandelier", "price": 23000000, "unit": "PACKAGE", "minTables": null, "capacity": null, "cost": 23000000, "chargedTables": null, "fits": true, "consequence": null }]
    }]
  }],
  "totals": { "total": 200000000, "ordersTotal": 0, "deposited": 0, "owed": 0, "plannedTotal": 23000000, "lostDeposits": 0, "extraCosts": 0, "ownVenueCost": 0, "remaining": 177000000, "suggestedTotal": 172000000, "leftover": 5000000 },
  "status": "OK",
  "overBudget": null,
  "feasibility": { "ok": true, "minNeed": 117000000, "shortfall": 0, "message": null, "options": [] },
  "leftoverMessage": "Còn dư 5.000.000đ: bạn có thể nâng gói hoặc thêm hạng mục.",
  "extraCosts": [{ "id": "…", "name": "Thiệp cưới", "amount": 3000000, "createdDate": "…" }],
  "warnings": []
}
```

- `categories`: hạng mục khách chọn ở "Dịch vụ muốn sử dụng" và hạng mục của mọi NCC đã có trong kế hoạch. `status`: `CHOSEN`, `SUGGESTED`, `NO_VENDOR`, `OWN_VENUE`. `weight` (%) chỉ có ở dịch vụ chưa chọn.
- `totals.remaining` = tổng − giá đơn đã chốt − dự kiến chưa chốt (− cọc mất, tiệc tự lo, chi phí khác); **không** trừ thêm số đã cọc vì đã nằm trong giá đơn. `owed` = `ordersTotal − deposited`. `leftover` = còn dư sau khi trừ cả các gói gợi ý.
- `warnings[].code`: `PACKAGE_UNAVAILABLE` (gói khách chọn đã ngừng bán, kèm `vendorId`).

**Ghi đồng thời.** Mọi thao tác ghi ở mục này, `PATCH /weddings/me` và `PATCH …/plan-vendors/:vendorId` phải gửi `version` (lấy từ `Budget.version` hoặc `Wedding.version`, cùng là `weddings.updated_date`). Bản trong DB đã đổi thì 409 `STALE_DATA` ("Đã có thay đổi, hãy tải lại."), không ghi đè. Thiếu `version`: 400 `VERSION_REQUIRED`. Ghi thành công thì `version` mới nằm trong response.

### GET /weddings/me/budget
Response 200: `{ "data": Budget }`

### PATCH /weddings/me/budget/settings
Mức chia, tỷ lệ Tùy chỉnh, tiệc tự lo. Body: một hoặc nhiều trường `budgetPreset` (`BALANCED` | `SPACE` | `VISUAL` | `CUSTOM`), `customWeights` (`{ "<slug>": 0..100 }`, tổng 100, sai số 0,5), `ownVenue` (boolean), `ownVenueCost` (số nguyên ≥ 0 hoặc null), kèm `version`. Chọn `CUSTOM` lần đầu phải gửi kèm `customWeights`. Response 200: `Budget`. Lỗi: 400 `VALIDATION_ERROR` (`details` theo trường), 409 `STALE_DATA`, 503 `DB_MIGRATION_PENDING` (chưa chạy `prisma/manual/2026-11-02-01-budget-allocation.sql`).

Các đường dẫn ô sửa tay cũ (`PUT/DELETE …/budget/categories/:id`, `POST …/budget/reset`, `POST …/budget/rebalance`) đã bỏ (404).

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
