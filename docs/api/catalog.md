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
