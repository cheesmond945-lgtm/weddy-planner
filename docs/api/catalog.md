# API: catalog (phía cặp đôi)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/catalog.ts`).
> Quy ước chung: [README.md](README.md).
> **Chờ đối chiếu `docs/database.md`:** tên thực thể (danh mục, dịch vụ, gói, album) và tên trường đang suy từ prototype (mục 2.1, 2.2).

Phạm vi: xem danh mục, tìm và lọc dịch vụ, xem chi tiết dịch vụ. Tất cả **Public** (không cần đăng nhập).
Chưa có: NCC quản lý dịch vụ/gói, Admin duyệt (làm khi tới phần NCC/Admin).

## Đối tượng dùng chung

`CategoryRef`

```json
{ "id": "cat-1", "slug": "nha-hang", "name": "Nhà hàng" }
```

`slug`: mã danh mục cố định, dùng trên URL (`?category=nha-hang`) và để FE chọn icon. Không đổi sau khi tạo.

`ServiceSummary` (thẻ trong danh sách)

```json
{
  "id": "sv-1",
  "name": "Grand Lotus Palace",
  "category": { "id": "cat-1", "slug": "nha-hang", "name": "Nhà hàng" },
  "location": "Hà Nội",
  "priceFrom": 128000000,
  "coverImageUrl": "https://…"
}
```

| Trường | Ghi chú |
|---|---|
| `priceFrom` | Giá thấp nhất trong các gói đang bán, đồng |
| Điểm Google Maps | **Không** nằm trong catalog (CSDL không có cột điểm). FE lấy riêng qua `GET /vendors/{vendorId}/google-rating`, xem [vendors.md](vendors.md) |
| `location` | Tỉnh/thành, dùng cho bộ lọc khu vực |

---

### GET /categories
Role: Public

Danh mục cho băng chuyền đầu trang và chip lọc, theo thứ tự hiển thị.

Response 200

```json
{
  "data": [
    { "id": "cat-1", "slug": "nha-hang", "name": "Nhà hàng", "imageUrl": "https://…", "serviceCount": 3 }
  ]
}
```

`serviceCount`: số dịch vụ đang hiển thị của danh mục (không phụ thuộc bộ lọc khác). Không phân trang (danh sách ngắn).

### GET /services/locations
Role: Public

Các khu vực cho bộ lọc.

Response 200

```json
{ "data": ["Hà Nội", "Hải Phòng", "Thái Bình", "Hưng Yên", "Hà Nam"] }
```

### GET /services/areas
Khu vực để lọc: các phường/xã khác nhau trong dữ liệu NCC đang hiển thị (`vendor_profiles.ward`), đổi về tên chính thức có tiền tố ("Đống Đa" → "Phường Đống Đa"), xếp theo tên.
Dùng chung cho dropdown Khu vực trên thanh tìm kiếm trang Dịch vụ và ô "Nơi tổ chức" trong form thông tin đám cưới (giá trị lưu vào `weddings.ward`, khớp CHECK `ck_weddings_ward`).

Response 200: `{ "data": ["Phường Ba Đình", "Phường Cầu Giấy", "…", "Xã Thanh Trì"] }`

### GET /services/styles
Role: Public

Các phong cách (tag trên dịch vụ, ô "Phong cách mong muốn" của form thông tin đám cưới).

Response 200

```json
{ "data": ["Hiện đại", "Tối giản", "Cổ điển", "Sang trọng", "Sân vườn", "Truyền thống"] }
```

### GET /services
Role: Public

Tìm và lọc dịch vụ (2.1). Có phân trang.

| Query | Kiểu | Ghi chú |
|---|---|---|
| `q` | string | Tìm kiếm tầng 1: chỉ khớp chữ trong **tên và mô tả** của NCC, không phân biệt dấu và hoa thường. **Không** khớp khu vực, địa chỉ hay danh mục (từ 02/11/2026) |
| `area` | string | Khu vực: một giá trị trong `/services/areas` (phường/xã chính thức có tiền tố, ví dụ `Phường Đống Đa`). Lọc cứng, kết hợp **AND** với `q` và các bộ lọc khác |
| `category` | string | `slug` danh mục |
| `location` | string | Tỉnh/thành, một giá trị trong `/services/locations` |
| `styles` | string | Phong cách, nối bằng dấu phẩy (FE gửi khi có bộ lọc AI đã hiểu) |
| `priceMin` | int | Chi phí ước tính `>= priceMin` (gói rẻ nhất; trung tâm sự kiện = giá/bàn × max(số bàn dự kiến, số bàn tối thiểu)) |
| `priceMax` | int | Chi phí ước tính `< priceMax` (không bao gồm) |
| `page`, `pageSize` | int | Mặc định 1, 20; FE đang gửi `pageSize=24` |

FE đổi các mức giá trên giao diện thành `priceMin`/`priceMax`: Dưới 10 triệu = `priceMax=10000000`; 10 đến 30 triệu = `priceMin=10000000&priceMax=30000000`; 30 đến 100 triệu; Trên 100 triệu = `priceMin=100000000`.

Thứ tự mặc định: theo thứ tự tạo (như prototype). Chưa có tham số `sort` vì giao diện chưa có chỗ chọn.

Response 200

```json
{
  "data": [ { "id": "sv-1", "name": "Grand Lotus Palace", "…": "ServiceSummary" } ],
  "meta": { "page": 1, "pageSize": 24, "total": 19, "totalPages": 1 }
}
```

Lỗi: 400 `VALIDATION_ERROR` (ví dụ `priceMin` không phải số)

### GET /services/search
Role: Public (có token couple thì tính chi phí theo số bàn dự kiến và hạn mức AI theo tài khoản)

Tìm kiếm 2 tầng theo câu gõ. FE chỉ gọi khi bấm Enter / Tìm kiếm; câu mới thì hủy yêu cầu cũ. Code: `backend/src/modules/catalog/search*.ts`, hằng số ở `search.config.ts`.

| Query | Kiểu | Ghi chú |
|---|---|---|
| `q` | string | Tối đa `QUERY_MAX_LENGTH` = 100 ký tự (quá thì 400 `VALIDATION_ERROR`) |
| `category` | string | Tab hạng mục đang chọn (slug) |
| `area`, `priceMin`, `priceMax` | | Dropdown Khu vực / Mức giá, lọc cứng AND. Giá so với **chi phí ước tính** (như `GET /services`) |
| `page`, `pageSize` | int | Mặc định 1, 24 |
| `ai` | `1` | Cho phép gọi AI (tầng 2). Lần đầu FE gọi không có cờ này |

Xử lý:
1. Chuẩn hóa: chữ thường, bỏ dấu, bỏ emoji / ký tự đặc biệt, bỏ `STOP_WORDS`, đổi từ đồng nghĩa hạng mục (`CATEGORY_SYNONYMS`, ví dụ "chụp hình", "makeup", "nhà hàng"). Rỗng → `mode: EMPTY` (FE giữ nguyên danh sách).
2. Bỏ `GENERIC_WORDS` ("đẹp", "uy tín"…; có thì xếp theo đánh giá). Không còn gì → `mode: GUIDE` kèm hướng dẫn và chip hạng mục / phong cách; không tìm, không gọi AI.
3. Tầng 1 (bỏ qua nếu câu có số / từ chỉ giá): khớp **mọi** từ trong tên hoặc mô tả, trên mọi hạng mục, trùng tên xếp trước; "rẻ", "giá mềm", "tiết kiệm" → xếp chi phí tăng dần. Có kết quả → `mode: TEXT`, không gọi AI. Tab đang chọn không có nhưng hạng mục khác có → `hint`.
4. Tầng 1 rỗng và câu có ≥ 2 từ hoặc có giá: chưa có `ai=1` → `mode: NEEDS_AI` (FE hiện "Đang hiểu yêu cầu của bạn…" rồi gọi lại kèm `ai=1`). Có `ai=1` → AI (Gemini, prompt "KHỐI 2" trong `search-ai.service.ts`) chỉ trả JSON bộ lọc; backend kiểm tra từng giá trị (hạng mục / khu vực / phong cách phải có trong danh sách, giá nguyên dương, min ≤ max; "tầm X" = X ± `PRICE_TOLERANCE` 20%), bỏ giá trị sai, rồi tự lọc. Khu vực / giá AI hiểu khác dropdown thì ưu tiên điều vừa gõ (`overridden`). Timeout `AI_TIMEOUT_MS` = 6 giây; cache theo câu đã chuẩn hóa 24 giờ; giới hạn mỗi giờ 10 lần (khách) / 30 lần (tài khoản).

Response 200

```json
{
  "data": {
    "mode": "AI",
    "query": "trang tri duoi 20tr",
    "items": [ { "id": "…", "name": "…", "estimatedCost": 14000000, "…": "ServiceSummary" } ],
    "total": 8, "page": 1, "pageSize": 24,
    "sort": null,
    "ai": {
      "filters": { "category": "decor", "area": null, "styles": [], "priceMin": null, "priceMax": 20000000 },
      "overridden": { "area": false, "price": false },
      "priceRejected": false,
      "cached": false
    }
  }
}
```

Trường thêm tùy trường hợp: `hint { tab, categorySlug, categoryName, count }`; `guide { message, categories[], styles[] }`; `ai.error` = `UNAVAILABLE` | `TIMEOUT` | `LIMIT` | `FAILED` (trả danh sách rỗng, không treo); `empty.noServicesInArea` (khu vực chưa có dịch vụ) hoặc `empty.cheapestFrom` (giá rẻ nhất hiện có).

FE: bộ lọc AI hiện thành chip kèm nhãn "Hiểu theo ngôn ngữ tự nhiên". Bỏ chip thì FE ghi phần còn lại lên URL (`nlCategory`, `nlArea`, `nlStyles`, `nlMin`, `nlMax`) và lọc bằng `GET /services`, không gọi AI nữa.

### GET /services/:id
Role: Public

Chi tiết dịch vụ (2.2).

Response 200

```json
{
  "data": {
    "id": "sv-1",
    "name": "Grand Lotus Palace",
    "category": { "id": "cat-1", "slug": "nha-hang", "name": "Nhà hàng" },
    "location": "Hà Nội",
    "priceFrom": 128000000,
    "priceTo": 185500000,
    "coverImageUrl": "https://…",
    "address": "Số 18 Đại lộ Thăng Long, P. Mễ Trì, Q. Nam Từ Liêm, Hà Nội",
    "description": "Grand Lotus Palace là không gian tiệc được thiết kế cho…",
    "highlights": ["Sảnh chính 600 khách", "Có sảnh ngoài trời", "Bãi đỗ xe 120 chỗ"],
    "capacity": 600,
    "styles": ["Sang trọng", "Truyền thống"],
    "workingHours": "08:00 - 22:00 (Hàng ngày)",
    "isVerified": true,
    "isGuaranteed": true,
    "images": ["https://…", "https://…"],
    "packages": [
      { "id": "pkg-1", "name": "Gói tiêu chuẩn", "description": "Khoảng 25 bàn, thực đơn 10 món", "price": 128000000 },
      { "id": "pkg-2", "name": "Gói cao cấp", "description": "Khoảng 35 bàn, thực đơn 12 món, trang trí sảnh", "price": 185500000 }
    ],
    "albums": [
      { "id": "alb-1", "title": "Grand Lotus Palace, bộ ảnh 01", "imageCount": 14, "previewImageUrls": ["https://…", "https://…", "https://…"] }
    ]
  }
}
```

| Trường | Ghi chú |
|---|---|
| `priceTo` | Giá cao nhất trong các gói |
| `capacity` | Sức chứa (khách), `null` nếu không áp dụng |
| `styles` | Phong cách, hiện thành tag cạnh tên danh mục |
| `workingHours` | Chuỗi hiển thị nguyên văn. **Cần chốt** có tách thành giờ mở/đóng không |
| `isVerified`, `isGuaranteed` | Huy hiệu "Đã xác minh", "Weddy đảm bảo" |
| `images` | Ảnh thư viện theo thứ tự, ảnh đầu là ảnh lớn. FE hiện 5 ảnh đầu, nút "Xem tất cả N ảnh" |
| `albums[].previewImageUrls` | 3 ảnh đại diện của album |

Lỗi: 404 `SERVICE_NOT_FOUND` (không có, hoặc NCC chưa được duyệt / đã ẩn)

---

## Cần chốt

1. Tên thực thể và trường theo `docs/database.md`.
2. (Đã chốt) Điểm Google Maps lấy lúc gọi qua PlaceId, không lưu database: xem vendors.md.
3. Album: có cần endpoint xem toàn bộ ảnh của từng album không? Hiện prototype bấm album nào cũng mở chung thư viện ảnh của dịch vụ.
4. `workingHours` dạng chuỗi hay dạng có cấu trúc.

---

# Phía Nhà cung cấp: quản lý gói dịch vụ

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/vendorPackages.ts`). Phần này bổ sung, không đổi các endpoint phía cặp đôi ở trên.
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md`**: trường mở rộng và trạng thái gói đang suy từ prototype NCC (`docs/prototype/prototype_vendor`, màn Quản lý dịch vụ).

Phạm vi: NCC tạo, sửa, xóa bản nháp, gửi duyệt, ẩn và đăng lại gói dịch vụ của mình.
Chưa có: Admin duyệt / từ chối gói (làm khi tới phần Admin, bổ sung vào đây).

## Gói NCC và `ServicePackage`

Gói NCC là **cùng thực thể** với `ServicePackage` mà phía cặp đôi đang hiển thị trong `GET /services/:id`. NCC thấy đủ trường; phía cặp đôi chỉ nhận 4 trường gốc `id`, `name`, `description`, `price` của các gói `PUBLISHED`.

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id`, `name`, `description` | string | Như `ServicePackage`. Bản nháp có thể có `description` rỗng |
| `price` | int \| null | **Giá tối thiểu** (= "giá từ" bên cặp đôi), đồng. Bản nháp có thể `null`; gói đã đăng luôn có |
| `maxPrice` | int \| null | Giá tối đa, đồng, `maxPrice >= price` |
| `category` | `CategoryRef` | Lĩnh vực của gói. BE gán lúc tạo theo hồ sơ NCC ([vendors.md](vendors.md)): `verifiedCategory` nếu hồ sơ `VERIFIED`, ngược lại `category`. Không đổi sau đó |
| `status` | `PackageStatus` | Xem dưới |
| `tags` | string[] | Hiển thị công khai khi gói được đăng |
| `capacity` | int \| null | Sức chứa tối đa (khách), chỉ nhận khi lĩnh vực là nhà hàng (`slug = nha-hang`), lĩnh vực khác BE bỏ qua |
| `note` | string \| null | Ghi chú |
| `photos` | `VendorFile[]` | Bộ ảnh của gói theo thứ tự hiển thị. `VendorFile` như [vendors.md](vendors.md); upload bằng `POST /vendors/me/uploads/signature` với `purpose = PACKAGE_PHOTO` (chỉ nhận ảnh JPG/PNG/WEBP, tối đa 10MB) |
| `coverPublicId` | string \| null | `publicId` của ảnh bìa; `null` thì dùng ảnh đầu |
| `updatedAt` | ISO 8601 | |

Khi dựng `ServiceDetail` cho cặp đôi (đề xuất, **cần chốt** cùng phần couple):
- `packages`: các gói `PUBLISHED`, chỉ 4 trường gốc.
- `priceFrom` / `priceTo`: nhỏ nhất của `price` / lớn nhất của `maxPrice` trong các gói đã đăng.
- `albums`: mỗi gói đã đăng là một `ServiceAlbum` (`title` = tên gói, `imageCount` = số ảnh, `previewImageUrls` = 3 ảnh đầu, ảnh bìa trước).
- `images`: ảnh bìa các gói rồi tới các ảnh còn lại.
- `capacity`: lớn nhất trong các gói đã đăng.
- `description`, `highlights`, `styles`, `address`, `workingHours` của `ServiceDetail` chưa có nguồn phía NCC (địa chỉ, giờ hoạt động có trong hồ sơ NCC; còn lại **cần chốt**).

### Trạng thái gói (`PackageStatus`)

| Giá trị | Nhãn FE | NCC được làm |
|---|---|---|
| `DRAFT` | Bản nháp | Sửa, xóa, gửi duyệt |
| `PENDING` | Chờ duyệt | Chỉ xem |
| `NEEDS_REVISION` | Cần chỉnh sửa | Sửa, xóa, gửi lại duyệt (kèm `reviewNote`: lý do Admin) |
| `PUBLISHED` | Đã đăng | Chỉ xem, ẩn |
| `HIDDEN` | Ẩn | Chỉ xem, đăng lại |

```
DRAFT ──submit──▶ PENDING ──Admin duyệt──▶ PUBLISHED ◀──republish── HIDDEN
                                                  └──────hide──────▶
```

- Chỉ `DRAFT` và `NEEDS_REVISION` sửa / xóa được; trạng thái khác trả `409 PACKAGE_NOT_EDITABLE`.
- Gửi duyệt cần hồ sơ NCC `VERIFIED` và `verifiedCategory` trùng `category` của gói, ngược lại `409 VENDOR_NOT_VERIFIED`. **Thêm gói mới (`POST`) cũng chỉ NCC có hồ sơ `VERIFIED` mới làm được**, ngược lại `409 VENDOR_NOT_VERIFIED`.
- Đăng lại hiển thị đúng phiên bản đã duyệt (gói không sửa được khi đã đăng nên nội dung không đổi).
- Bước Admin duyệt / từ chối và gói bị từ chối quay về đâu: chờ chốt ở `state-diagrams.md`.

`SavePackageRequest` (body chung của tạo và sửa)

```json
{
  "name": "Tiệc cưới – Menu A",
  "description": "Tiệc cưới tại sảnh Mây với thực đơn 8 món…",
  "price": 3500000,
  "maxPrice": 4500000,
  "tags": ["Tiệc cưới", "Menu A"],
  "capacity": 500,
  "note": "Giá tính theo bàn 10 khách, chưa gồm đồ uống.",
  "photos": [{ "url": "https://…", "publicId": "…", "fileName": "sanh.jpg", "size": 480000, "mimeType": "image/jpeg" }],
  "coverPublicId": "…"
}
```

Gửi toàn bộ gói mỗi lần; `photos` là danh sách cuối cùng theo thứ tự hiển thị.

---

### GET /vendors/me/packages
Role: VENDOR

Tất cả gói của NCC đang đăng nhập. Không phân trang (danh sách ngắn); tìm, lọc tag, lọc trạng thái và sắp xếp làm ở FE. Nếu sau này cần phân trang thì thêm `page`, `pageSize`, `status`, `q`, `sort=-updatedAt|price|-price` theo README.

Response 200: `{ "data": [VendorPackage] }`

### GET /vendors/me/packages/:id
Role: VENDOR

Response 200: `{ "data": VendorPackage }`

Lỗi: 404 PACKAGE_NOT_FOUND (không có hoặc của NCC khác)

### POST /vendors/me/packages/suggest-description
Role: VENDOR. Nút "Tạo với AI" ở ô Mô tả. Body `{ "name", "tags", "price", "capacity" }` (tùy chọn). Response 200: `{ "data": { "description": "…" } }`. Hiện dựng đoạn mẫu (chưa gọi mô hình AI).

### POST /vendors/me/packages
Role: VENDOR

Tạo gói ở trạng thái `DRAFT`. Kiểm tra như lưu nháp:
- `name` bắt buộc.
- `price`, `maxPrice` nếu có: số nguyên dương, `maxPrice >= price`.
- `capacity` nếu có: số nguyên dương.

Request: `SavePackageRequest`. Response 201: `{ "data": VendorPackage }`

Lỗi: 400 VALIDATION_ERROR, 422 VENDOR_CATEGORY_REQUIRED (hồ sơ chưa chọn lĩnh vực)

### PATCH /vendors/me/packages/:id
Role: VENDOR

Lưu nháp. Kiểm tra như `POST`.

Request: `SavePackageRequest`. Response 200: `{ "data": VendorPackage }`

Lỗi: 400 VALIDATION_ERROR, 404 PACKAGE_NOT_FOUND, 409 PACKAGE_NOT_EDITABLE

### DELETE /vendors/me/packages/:id
Role: VENDOR

Xóa bản nháp cùng ảnh của nó (BE xóa ảnh trên Cloudinary). Không hoàn tác.

Response 200: `{ "data": null }`

Lỗi: 404 PACKAGE_NOT_FOUND, 409 PACKAGE_NOT_EDITABLE

### POST /vendors/me/packages/:id/submit
Role: VENDOR

`DRAFT` → `PENDING`. FE lưu (`POST`/`PATCH`) trước rồi mới gọi endpoint này. Cần đủ: `description`, `price`, `maxPrice`, ít nhất 1 ảnh.

Response 200: `{ "data": VendorPackage }`

Lỗi: 400 VALIDATION_ERROR, 404 PACKAGE_NOT_FOUND, 409 VENDOR_NOT_VERIFIED, 409 CONFLICT (không ở `DRAFT`)

### POST /vendors/me/packages/:id/hide
Role: VENDOR

`PUBLISHED` → `HIDDEN`: gói không còn trong danh sách, tìm kiếm và trang chi tiết dịch vụ phía cặp đôi.

Response 200: `{ "data": VendorPackage }`

Lỗi: 404 PACKAGE_NOT_FOUND, 409 CONFLICT (không ở `PUBLISHED`)

### POST /vendors/me/packages/:id/republish
Role: VENDOR

`HIDDEN` → `PUBLISHED`. Gói do Admin ẩn thì NCC không tự khôi phục được.

Response 200: `{ "data": VendorPackage }`. `VendorPackage` có thêm `hiddenBy` (`VENDOR` | `ADMIN` | null) và `hiddenReason` (lý do Admin ẩn).

Lỗi: 404 PACKAGE_NOT_FOUND, 409 CONFLICT (không ở `HIDDEN`), 409 PACKAGE_HIDDEN_BY_ADMIN

## Mã lỗi riêng (phía NCC)

| HTTP | `code` | Khi nào |
|---|---|---|
| 404 | `PACKAGE_NOT_FOUND` | Gói không có hoặc của NCC khác |
| 409 | `PACKAGE_NOT_EDITABLE` | Sửa / xóa gói không ở `DRAFT` |
| 409 | `VENDOR_NOT_VERIFIED` | Gửi duyệt khi hồ sơ chưa xác minh đúng lĩnh vực của gói |
| 422 | `VENDOR_CATEGORY_REQUIRED` | Tạo gói khi hồ sơ chưa chọn lĩnh vực |

## Khác biệt với prototype NCC

- Prototype đặt tên `minPrice` / `maxPrice`. Ở đây giữ `price` của `ServicePackage` làm giá tối thiểu, thêm `maxPrice`, theo quyết định của nhóm.
- Prototype bản cũ có nhiều album mỗi gói; bản cuối gộp thành một bộ ảnh có ảnh bìa. Dùng bản cuối (`photos` + `coverPublicId`).
- Bỏ nút "Viết mô tả bằng AI" (prototype ghi "chưa kết nối AI thật"), làm khi có `integrations/ai`.
- Ô giá FE dùng 0 cho ô trống, nên giá phải > 0 (prototype cho phép giá 0).
