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
  "spendingTier": "AUTO",
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
| `spendingTier` | Mức chi tiêu: `AUTO` (mặc định, tự chọn mức cao nhất vừa ngân sách), `SAVING`, `BALANCED`, `PREMIUM`. Không bắt buộc; sửa đám cưới mà không gửi thì giữ nguyên |
| `tableCountOverride` | **Chỉ có ở response** của `GET/PUT`; đổi bằng `PATCH /weddings/me`. `null`: số bàn tự tính ⌈số khách / 10⌉ |
| `version` | **Chỉ có ở response**: `weddings.updated_date`, gửi kèm khi ghi để phát hiện ghi đồng thời (mục 7) |

Phong cách đã **bỏ** (30/10/2026): body có `styles` thì bị bỏ qua, response không còn trường này. Cột `weddings.style` vẫn giữ trong DB nhưng không dùng. Tag của gói do NCC nhập chỉ dùng cho tìm kiếm và bộ lọc ở trang dịch vụ.
| `categorySlugs` | Hạng mục muốn dùng, `slug` trong `GET /categories`, ít nhất 1 |

### GET /weddings/me
Response 200: `{ "data": Wedding }`, hoặc `{ "data": null }` khi chưa thiết lập (FE dựa vào đây để mở hộp thiết lập sau lần đăng nhập đầu).

### PUT /weddings/me
Tạo hoặc cập nhật. Body: `Wedding` không có `id` và `location`. Response 200: `{ "data": Wedding }`. Form tạo mới và form chỉnh sửa dùng chung thứ tự trường và quy tắc trên; `spendingTier` là trường duy nhất không bắt buộc. Gửi kèm `version` thì kiểm tra ghi đồng thời (không gửi thì không kiểm tra, để form cũ vẫn chạy).

- **Lần đầu tạo**: lưu ngày tạo làm mốc bắt đầu, tạo 4 việc mặc định (việc đầu đã xong): Xác định ngân sách và quy mô tiệc; Lập danh sách khách mời sơ bộ; Thiết kế và gửi thiệp mời; Xác nhận lần cuối với các nhà cung cấp.
- **Đổi `date`**: các hạn trên timeline **tự tính lại theo tỷ lệ** thời gian giữa mốc bắt đầu và ngày cưới (prototype lưu mỗi mốc dạng tỷ lệ 0..1).

Lỗi: 400 `VALIDATION_ERROR`, `details` theo từng trường (`groomName`, `brideName`, `date`, `ward`, `guestCount`, `budget`, `spendingTier`, `categorySlugs`)

### PATCH /weddings/me
Đổi nhanh ở tab Ngân sách. Body: một hoặc nhiều trường `{ "budget"?, "guestCount"?, "spendingTier"?, "tableCountOverride"? (null: về số tự tính, 1–500) }` kèm `"version"` (bắt buộc). Ô ngân sách sửa tay giữ nguyên. Response 200: `{ "data": Wedding }`.

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
Body `{ "categorySlug": "nha-hang" }`.

Response 200

```json
{
  "data": {
    "category": { "id": "cat-1", "slug": "nha-hang", "name": "Trung tâm tổ chức sự kiện" },
    "budget": 127000000,
    "budgetSource": "ESTIMATED",
    "budgetReason": "Theo giá gói mức Cân đối",
    "location": "Hà Nội",
    "guestCount": 250,
    "tables": 25,
    "suggestions": [
      {
        "service": { "id": "sv-1", "name": "Mipec Place", "…": "ServiceSummary" },
        "package": { "id": "pk-2", "name": "Sảnh Ngọc", "cost": 125000000, "calculation": "Sảnh Ngọc: 25 bàn × 5.000.000đ = 125.000.000đ" },
        "reasons": ["Sảnh Ngọc: 25 bàn × 5.000.000đ = 125.000.000đ, trong ngân sách hạng mục 127.000.000đ.", "Sảnh chứa tối đa 600 khách, đủ cho 250 khách."]
      }
    ],
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

Quy tắc (theo luật, không gọi mô hình ngôn ngữ; chỉ trả dịch vụ có thật trên WebPlan):

- Ngân sách hạng mục là **ngân sách hiển thị** ở tab Ngân sách (mục 7): `budgetSource` là `ALLOCATED` khi khách đã sửa tay, `ESTIMATED` khi là số gợi ý.
- Lọc: cùng khu vực; nhà hàng phải có sảnh đủ chỗ cho số khách; gói rẻ nhất (đủ chỗ) có chi phí ≤ ngân sách hạng mục.
- Xếp: điểm đánh giá, rồi số lượt đánh giá (cuối cùng chi phí thấp hơn, chỉ để thứ tự ổn định); lấy tối đa 3. **Không xét phong cách.**
- Lý do là lý do thật: phép tính chi phí gói so với ngân sách hạng mục (`số bàn × giá bàn`), điểm đánh giá nếu có, sức chứa với nhà hàng.
- Không có gợi ý: `cheapest` và `cheapestPackage` là lựa chọn rẻ nhất đủ chỗ, `raiseBudgetTo` = đúng chi phí của gói đó (FE có nút một chạm "Tăng ngân sách … lên X", gọi `PUT …/budget/categories/:categoryId`, chỉ khi `isChosenCategory`). Không nhà hàng nào đủ chỗ: `noVenueFits = true` (FE gợi ý sửa số khách).
- `guestCount`, `tables` chỉ có giá trị với nhà hàng.

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

## 7. Ngân sách, mức chi và chi phí khác

Mọi phép tính nằm trong một hàm thuần `backend/src/modules/weddings/budget-engine.ts` (test: `backend/test/budget-engine.test.cjs`). Hằng số trong `budget.config.ts`. FE không tự tính lại.

**Cách tính**

1. Chỉ tính các hạng mục khách chọn (`categorySlugs`). Thêm hoặc bỏ hạng mục thì tính lại; bỏ hạng mục thì xóa luôn số sửa tay của hạng mục đó.
2. **Chi phí một gói**: gói tính theo bàn (`service_packages.unit = 'mâm'`) = giá bàn × max(số bàn, `min_tables`, 1); số bàn = `tableCountOverride` nếu có, ngược lại ⌈số khách / 10⌉. Gói khác = giá trọn gói.
3. **Ngân sách gợi ý** của hạng mục theo một mức: lấy các gói đã duyệt của nhà cung cấp đang hiện; nhà hàng loại gói có sức chứa nhỏ hơn số khách; tính chi phí từng gói, sắp tăng dần; lấy phân vị nearest-rank tại vị trí max(⌈p × n⌉, 1) với p = 0,20 (Tiết kiệm), 0,45 (Cân đối), 0,75 (Cao cấp); làm tròn 100.000đ. Không có gói nào thì dùng tỷ lệ cố định chuẩn hóa: tổng ngân sách × tỷ lệ / tổng tỷ lệ các hạng mục khách chọn (tỷ lệ: nhà hàng 40%, decor 12%, chụp ảnh 10%, trang phục 8%, hoa cưới 8%, trang điểm 6%).
4. **Mức áp dụng** (`effectiveTier`): khách chọn tay thì dùng mức đó. `AUTO`: thử Cao cấp, Cân đối, Tiết kiệm, lấy mức cao nhất mà tổng gợi ý ≤ tổng ngân sách − chi phí khác. Không mức nào vừa thì dùng Tiết kiệm và cảnh báo `BELOW_SAVING`. Phần dư chỉ ghi "còn dư", không tự chia lại.
5. **Ngân sách hiển thị** = số sửa tay nếu có, ngược lại số gợi ý; kèm `manual` và `reason` ("Bạn đã sửa", "Theo giá gói mức Cân đối", "Theo tỷ lệ gợi ý (chưa có gói phù hợp)"). Đổi mức chi, tổng ngân sách, số khách hay số bàn thì ô sửa tay giữ nguyên.
6. **Chi phí của nhà cung cấp trong kế hoạch**: có đơn còn hiệu lực thì tổng đơn (`ORDER`, khóa); khách đã chọn gói thì gói đó (`SELECTED`); chưa chọn thì **gói dự kiến** (`PLANNED`): gói có chi phí lớn nhất không vượt ngân sách hạng mục (nhà hàng chỉ xét sảnh đủ chỗ, hòa thì gói giá thấp hơn; không gói nào vừa thì gói rẻ nhất). Gói đã chọn bị ẩn, ngừng hoặc xóa: quay về gói dự kiến, `unavailable = true`.
7. **Cân đối** (`POST …/budget/rebalance`): chỉ co các ô chưa sửa tay với k = (tổng ngân sách − tổng ô sửa tay − chi phí khác) / tổng ô chưa sửa, làm tròn 100.000đ, rồi lưu thành số sửa tay. Không còn ô nào chưa sửa: 409 `REBALANCE_NOTHING_TO_SCALE`; k ≤ 0: 409 `REBALANCE_MANUAL_OVER_BUDGET` ("Các ô bạn sửa đã vượt tổng ngân sách.").
8. Hai con số tách bạch, **không** dùng chung tên: **Ngân sách đã chia** (`totals.allocated`, tổng ngân sách hiển thị của các hạng mục) và **Chi phí theo gói đã chọn** (`totals.packagesCost`, tổng chi phí ở mục 6).

`Budget`

```json
{
  "version": "2026-10-30T08:15:02.123Z",
  "tier": "AUTO",
  "effectiveTier": "BALANCED",
  "tierLabel": "Tự động, đang áp dụng mức Cân đối",
  "tierTotals": { "SAVING": 95000000, "BALANCED": 145000000, "PREMIUM": 180000000 },
  "guestCount": 250,
  "tables": { "count": 25, "auto": 25, "override": null },
  "categories": [{
    "categoryId": "…", "slug": "nha-hang", "name": "Trung tâm tổ chức sự kiện",
    "budget": 127000000, "suggested": 127000000, "manual": false, "reason": "Theo giá gói mức Cân đối",
    "source": "PACKAGES", "packageCount": 5,
    "vendors": [{
      "id": "…", "name": "Mipec Place", "status": "PLANNED", "cost": 125000000, "hasOrder": false,
      "package": { "id": "…", "name": "Sảnh Ngọc", "source": "PLANNED", "unavailable": false, "unit": "TABLE" }
    }],
    "cost": 125000000,
    "diff": 2000000
  }],
  "totals": { "total": 150000000, "extraCosts": 0, "allocated": 145000000, "unallocated": 5000000, "packagesCost": 125000000, "remaining": 25000000 },
  "extraCosts": [{ "id": "…", "name": "Thiệp cưới", "amount": 3000000, "createdDate": "…" }],
  "warnings": []
}
```

- `diff` = `budget` − `cost` của hạng mục (dương: còn lại, âm: vượt); `null` khi chưa có nhà cung cấp.
- `totals.unallocated` = tổng − chi phí khác − ngân sách đã chia (dương: còn dư, âm: vượt). `totals.remaining` = tổng − chi phí theo gói − chi phí khác.
- `categories` gồm hạng mục khách chọn ở "Dịch vụ muốn sử dụng" và hạng mục của mọi nhà cung cấp đã có trong kế hoạch, nên hạng mục nào có dịch vụ đã chọn cũng có ô ngân sách (số gợi ý theo mức chi). `totals.packagesCost` chỉ cộng nhà cung cấp thuộc các hạng mục này, cùng phạm vi với `totals.allocated`.
- `warnings[].code`: `BELOW_SAVING` ("Ngân sách của bạn thấp hơn mức Tiết kiệm khoảng X"), `TIER_OVER_BUDGET` ("Mức Cao cấp cần khoảng X, ngân sách của bạn là Y"), `ALLOCATED_OVER_BUDGET` (số sửa tay làm ngân sách đã chia vượt), `PACKAGE_UNAVAILABLE` (kèm `vendorId`).
- Gợi ý AI (mục 4) và So sánh ([compare.md](compare.md)) dùng đúng ngân sách hiển thị này.

**Ghi đồng thời.** Mọi thao tác ghi ở mục này, `PATCH /weddings/me` và `PATCH …/plan-vendors/:vendorId` phải gửi `version` (lấy từ `Budget.version` hoặc `Wedding.version`, cùng là `weddings.updated_date`). Bản trong DB đã đổi thì 409 `STALE_DATA` ("Đã có thay đổi, hãy tải lại."), không ghi đè. Thiếu `version`: 400 `VERSION_REQUIRED`. Ghi thành công thì `version` mới nằm trong response.

### GET /weddings/me/budget
Response 200: `{ "data": Budget }`

### PUT /weddings/me/budget/categories/:categoryId
Đặt ngân sách sửa tay. Body `{ "amount": 150000000, "version": "…" }` (số nguyên ≥ 0). Response 200: `Budget`. Lỗi: 400 `VALIDATION_ERROR`, 404 `CATEGORY_NOT_CHOSEN` (hạng mục không nằm trong dịch vụ muốn dùng), 409 `STALE_DATA`.

### DELETE /weddings/me/budget/categories/:categoryId?version=…
Bỏ số sửa tay, quay về số gợi ý. Response 200: `Budget`.

### POST /weddings/me/budget/reset
"Đặt lại tất cả": xóa mọi số sửa tay. Body `{ "version": "…" }`. Response 201: `Budget`.

### POST /weddings/me/budget/rebalance
"Cân đối theo ngân sách tổng" (cách tính ở trên). Body `{ "version": "…" }`. Response 201: `Budget`. Lỗi: 409 `REBALANCE_NOTHING_TO_SCALE`, 409 `REBALANCE_MANUAL_OVER_BUDGET`.

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
