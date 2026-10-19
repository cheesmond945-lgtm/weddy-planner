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
  "rating": 4.7,
  "reviewCount": 1824,
  "coverImageUrl": "https://…"
}
```

| Trường | Ghi chú |
|---|---|
| `priceFrom` | Giá thấp nhất trong các gói đang bán, đồng |
| `rating`, `reviewCount` | Điểm và số đánh giá lấy từ Google Maps (prototype ghi rõ "không phải đánh giá trên WebPlan"). `rating` một chữ số thập phân |
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
| `q` | string | Tìm trong tên dịch vụ và tên danh mục, không phân biệt hoa thường |
| `category` | string | `slug` danh mục |
| `location` | string | Một giá trị trong `/services/locations` |
| `priceMin` | int | `priceFrom >= priceMin` |
| `priceMax` | int | `priceFrom < priceMax` (không bao gồm) |
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
    "rating": 4.7,
    "reviewCount": 1824,
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
2. Điểm đánh giá lấy từ Google Maps: nhập tay hay đồng bộ tự động?
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
| `PUBLISHED` | Đã đăng | Chỉ xem, ẩn |
| `HIDDEN` | Ẩn | Chỉ xem, đăng lại |

```
DRAFT ──submit──▶ PENDING ──Admin duyệt──▶ PUBLISHED ◀──republish── HIDDEN
                                                  └──────hide──────▶
```

- Chỉ `DRAFT` sửa / xóa được; trạng thái khác trả `409 PACKAGE_NOT_EDITABLE`.
- Gửi duyệt cần hồ sơ NCC `VERIFIED` và `verifiedCategory` trùng `category` của gói, ngược lại `409 VENDOR_NOT_VERIFIED` (chưa xác minh vẫn tạo và lưu nháp được).
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

`HIDDEN` → `PUBLISHED`.

Response 200: `{ "data": VendorPackage }`

Lỗi: 404 PACKAGE_NOT_FOUND, 409 CONFLICT (không ở `HIDDEN`)

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
