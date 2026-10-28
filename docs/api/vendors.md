# API: vendors (hồ sơ nhà cung cấp)

> **Bản nháp** (đã nối backend thật).
> Quy ước chung: [README.md](README.md).
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md`** (hai tài liệu này đang trống): tên thực thể, tên trường, enum và trạng thái hồ sơ đang suy từ prototype NCC (`docs/prototype/prototype_vendor`, màn Hồ sơ nhà cung cấp).

> **Cập nhật (Supabase):** backend lưu hồ sơ, giấy tờ, ảnh và gói vào Supabase (Postgres + Storage), không dùng Cloudinary.
> Upload bằng `POST /vendors/me/uploads` (multipart: `file`, `purpose` = `VENDOR_DOCUMENT` | `VENDOR_PHOTO` | `PACKAGE_PHOTO`), trả `VendorFile` có `publicId` là đường dẫn trong Storage.
> Giấy tờ và ảnh cơ sở ở bucket riêng tư (`url` là link ký 1 giờ); ảnh gói ở bucket công khai, tối đa 5MB. `POST /vendors/me/uploads/signature` không còn dùng.
> Gói dịch vụ chỉ có một `price` (giá "từ", bắt buộc kể cả bản nháp); không có `maxPrice` và `note`.

Phạm vi: NCC xem, lưu nháp và gửi xác minh hồ sơ của mình; xin chữ ký upload ảnh/giấy tờ. Lĩnh vực cung cấp chỉ đọc (Admin gán khi tạo tài khoản).
Chưa có: Admin duyệt hồ sơ, yêu cầu bổ sung (làm khi tới phần Admin, sẽ bổ sung vào file này).

## Enum

| Enum | Giá trị | Nhãn FE |
|---|---|---|
| `VendorProfileStatus` | `NOT_SUBMITTED` (DB `Draft`) | Bản nháp |
| | `PENDING` | Chờ duyệt |
| | `NEEDS_REVISION` | Cần chỉnh sửa / bổ sung (kèm lý do) |
| | `VERIFIED` (DB `Approved`) | Đã duyệt |
| `VendorDocumentType` | `BUSINESS_LICENSE` | Giấy tờ kinh doanh |
| | `FIRE_SAFETY` | Giấy tờ PCCC |
| | `FOOD_SAFETY` | Giấy an toàn vệ sinh thực phẩm |
| | `SKILL_CERTIFICATE` | Chứng chỉ tay nghề (tùy chọn) |
| `VendorPhotoType` | `FRONT` | Ảnh cơ sở (`StorefrontPhoto`) |

### Trạng thái hồ sơ

`VendorProfiles.Status` là trạng thái hiện tại của hồ sơ (có hợp lệ để hiển thị hay không). `VendorVerifications.Status` là kết quả của từng lần nộp (cùng nguyên tắc với `Orders` và `OrderRevisions`). Mỗi lần gửi xác minh hoặc gửi cập nhật tạo **một** dòng `VendorVerifications` `Pending`; mỗi hồ sơ tối đa một dòng `Pending` (kiểm tra bằng code).

**Trước khi duyệt lần đầu (tiền kiểm)**

| Trạng thái | Nhãn góc phải | Nút | Sửa |
|---|---|---|---|
| `NOT_SUBMITTED` | Bản nháp | Lưu nháp, Gửi xác minh | Có |
| `PENDING` | Chờ duyệt | Không có | Chỉ đọc |
| `NEEDS_REVISION` | Cần chỉnh sửa / bổ sung, kèm lý do | Lưu, Gửi lại xác minh | Có |
| `VERIFIED` | Đã duyệt | Xem bên dưới | Xem bên dưới |

Lý do chỉnh sửa lấy từ `AdminNote` của dòng xác minh gần nhất (`reviewNote`).

**Sau khi đã duyệt (hậu kiểm)**

- Nhóm **hiển thị** (giới thiệu, giờ làm việc): sửa và lưu ngay (`PATCH`), không cần duyệt.
- Nhóm **pháp lý** (tên doanh nghiệp, mã số thuế, người đại diện, địa chỉ, phường/xã, tỉnh/thành phố, link Google Maps, ảnh cơ sở, giấy tờ): NCC bấm "Cập nhật hồ sơ", sửa xong bấm "Gửi cập nhật" (`POST …/submit`). Hệ thống ghi **thẳng** dữ liệu mới vào `VendorProfiles` và `VendorDocuments`, giữ `Status = Approved` (NCC và các gói vẫn hiển thị), tạo một dòng xác minh `Pending` và gửi thông báo `VendorUpdated` cho mọi Admin.
- Trong lúc chờ (`pendingReview = true`): hồ sơ chỉ đọc, nút "Cập nhật hồ sơ" ẩn; `PATCH` và `submit` trả `409 VENDOR_PROFILE_LOCKED`.
- Admin xử lý ([admin.md](admin.md)): hợp lệ → dòng xác minh `Approved`, hồ sơ giữ `Approved`; không hợp lệ → dòng xác minh `NeedRevision` kèm lý do, **hồ sơ vẫn `Approved` (NCC, gói, đơn, yêu thích vẫn hiển thị)**; `revisionRequested = true` và `reviewNote` là lý do, NCC sửa rồi bấm "Gửi cập nhật" để tạo dòng xác minh `Pending` mới; nghiêm trọng → Admin khóa tài khoản (cách duy nhất để ẩn NCC đã duyệt).

## Luật theo lĩnh vực

Lĩnh vực cung cấp dùng chung danh mục với phía cặp đôi (`GET /categories`, [catalog.md](catalog.md)).

- Mỗi tài khoản NCC gắn **đúng 1** lĩnh vực. Admin chọn khi tạo tài khoản NCC từ yêu cầu tư vấn; NCC **không đổi được** (form hiển thị chỉ đọc, kèm "Liên hệ WebPlan nếu cần đổi lĩnh vực").
- API hồ sơ không nhận trường lĩnh vực: `UpdateVendorProfileRequest` không có `categoryId`; nếu client vẫn gửi thì BE bỏ qua.
- Luật giấy tờ, ảnh cơ sở bên dưới, tỷ lệ hoa hồng ([commissions.md](commissions.md)) và lĩnh vực của gói ([catalog.md](catalog.md)) đều đọc `category` / `verifiedCategory` của hồ sơ.

| Lĩnh vực | Giấy tờ bắt buộc | Ảnh cơ sở |
|---|---|---|
| Nhà hàng (`slug = nha-hang`) | `BUSINESS_LICENSE`, `FIRE_SAFETY`, `FOOD_SAFETY` | `FRONT`, ít nhất 1 ảnh (bắt buộc) |
| Lĩnh vực khác | `BUSINESS_LICENSE`, `FIRE_SAFETY` | `FRONT`, tùy chọn |

`SKILL_CERTIFICATE` (chứng chỉ tay nghề) tùy chọn với mọi lĩnh vực.

- Giấy tờ: mỗi loại một hoặc nhiều tệp (bộ ảnh), ảnh JPG/PNG/WEBP (BE vẫn nhận PDF cũ), tối đa 10MB mỗi tệp. Chỉ phục vụ xét duyệt, không công khai.
- Ảnh cơ sở: `FRONT`, tối đa 6 ảnh, mỗi ảnh một khung tải, JPG/PNG/WEBP, tối đa 10MB mỗi ảnh. Tách biệt với album ảnh của gói dịch vụ, không tự công khai.
- Tệp thuộc loại không có trong bộ của lĩnh vực: BE trả `400 VALIDATION_ERROR`.

## Đối tượng dùng chung

`VendorFile` (tệp đã upload lên Cloudinary)

```json
{
  "url": "https://res.cloudinary.com/…/gpkd.pdf",
  "publicId": "vendors/vp-1/documents/gpkd",
  "fileName": "GPKD-MayPalace.pdf",
  "size": 820000,
  "mimeType": "application/pdf"
}
```

`VendorDocument` = `VendorFile` + `"type": VendorDocumentType`. `VendorPhoto` = `VendorFile` + `"type": VendorPhotoType`.

`VendorProfile`

```json
{
  "id": "vp-1",
  "status": "NEEDS_REVISION",
  "businessName": "Công ty TNHH Mây Palace",
  "taxCode": "0312345678",
  "representativeName": "Trần Thu Mây",
  "category": { "id": "cat-1", "slug": "nha-hang", "name": "Nhà hàng" },
  "verifiedCategory": null,
  "province": "Hà Nội",
  "ward": "Bạch Mai",
  "address": "128 Bà Triệu",
  "googleMapsUrl": "https://maps.app.goo.gl/…",
  "openTime": "09:00",
  "closeTime": "21:00",
  "description": "Nhà hàng tiệc cưới sức chứa 500 khách…",
  "documents": [
    { "type": "BUSINESS_LICENSE", "url": "https://…", "publicId": "…", "fileName": "GPKD-MayPalace.pdf", "size": 820000, "mimeType": "application/pdf" }
  ],
  "photos": [
    { "type": "FRONT", "url": "https://…", "publicId": "…", "fileName": "mat-tien.jpg", "size": 412000, "mimeType": "image/jpeg" }
  ],
  "reviewNote": "Giấy PCCC đã hết hạn, vui lòng tải bản còn hiệu lực.",
  "pendingReview": false,
  "submittedAt": "2026-10-10T02:30:00.000Z",
  "updatedAt": "2026-10-12T08:15:00.000Z"
}
```

| Trường | Ghi chú |
|---|---|
| `businessName`, `taxCode`, `representativeName`, `address`, `province`, `ward` | `null` khi chưa nhập (hồ sơ mới, lưu nháp dở) |
| `category` | **Chỉ đọc.** Lĩnh vực Admin gán khi tạo tài khoản, luôn có. NCC không đổi qua API này |
| `verifiedCategory` | Lĩnh vực Admin đã xác minh; dùng để cho phép NCC gửi duyệt gói thuộc lĩnh vực đó. `null` khi chưa xác minh lần nào. Vì lĩnh vực không đổi được nên khi có thì trùng `category` |
| `province` | Tỉnh / thành phố (cột `city`), NCC tự nhập, không khóa |
| `ward` | Phường / xã (cột `ward`), chuỗi tự do |
| `openTime`, `closeTime` | Giờ mở và đóng cửa `HH:mm`, tùy chọn (phải có cả hai hoặc không có, `closeTime > openTime`). BE nối thành chuỗi `09:00–21:00` lưu ở cột `working_hours` và tách lại khi trả về; chuỗi cũ không đúng dạng giờ trả `null` |
| `description` | Giới thiệu hiển thị cho cặp đôi, tối đa 3000 ký tự, tùy chọn |
| `reviewNote` | Lý do Admin yêu cầu bổ sung, có khi `NEEDS_REVISION` |
| `revisionRequested` | `true` khi hồ sơ `VERIFIED` có bản cập nhật gần nhất bị Admin yêu cầu chỉnh sửa (hồ sơ vẫn hiển thị); lý do ở `reviewNote` |
| `pendingReview` | `true` khi hồ sơ `VERIFIED` đã gửi cập nhật và đang chờ Admin kiểm tra (chỉ đọc) |
| `submittedAt` | Lần gửi xác minh gần nhất |

`UpdateVendorProfileRequest` (body chung của lưu nháp và gửi xác minh)

```json
{
  "businessName": "Công ty TNHH Mây Palace",
  "taxCode": "0312345678",
  "representativeName": "Trần Thu Mây",
  "province": "Hà Nội",
  "ward": "Bạch Mai",
  "address": "128 Bà Triệu",
  "googleMapsUrl": null,
  "openTime": "09:00",
  "closeTime": "21:00",
  "description": null,
  "documents": [{ "type": "BUSINESS_LICENSE", "url": "…", "publicId": "…", "fileName": "…", "size": 820000, "mimeType": "application/pdf" }],
  "photos": []
}
```

Không có trường lĩnh vực (chỉ đọc, BE bỏ qua `categoryId` nếu client gửi). Hồ sơ đã duyệt: `PATCH` chỉ ghi `openTime`, `closeTime`, `description` (các trường còn lại bỏ qua); `submit` ghi tất cả. Gửi **toàn bộ** hồ sơ mỗi lần (không gửi từng phần). `documents`, `photos` là danh sách cuối cùng: tệp không còn trong danh sách là đã bị xóa.

---

### POST /vendors/me/profile/suggest-description
Role: VENDOR. Nút "Tạo với AI" ở ô Giới thiệu. Body `{ "businessName": "…", "ward": "…", "province": "…", "hint": null }` (mọi trường tùy chọn). Response 200: `{ "data": { "description": "…" } }`. Hiện dựng đoạn mẫu từ tên, lĩnh vực và địa chỉ (chưa gọi mô hình AI), NCC chỉnh lại trước khi lưu.

### GET /vendors/me/profile
Role: VENDOR

Hồ sơ của NCC đang đăng nhập. Tài khoản NCC mới (vừa đặt mật khẩu lần đầu) có sẵn hồ sơ trống, trạng thái `NOT_SUBMITTED`, đã có `category` do Admin gán.

Response 200: `{ "data": VendorProfile }`

Lỗi: 401, 403

### PATCH /vendors/me/profile
Role: VENDOR

Lưu nháp. Không đổi trạng thái.

Request: `UpdateVendorProfileRequest`. Các trường được để trống (`null`), chỉ kiểm tra định dạng của trường đã nhập:
- `googleMapsUrl`: link Google Maps (`https://maps.app.goo.gl/…`, `https://www.google.com/maps/…`, `https://goo.gl/maps/…`).
- `openTime`, `closeTime`: dạng `HH:mm`, có cả hai hoặc không có, `closeTime > openTime`.

Response 200: `{ "data": VendorProfile }`

Lỗi: 400 VALIDATION_ERROR, 409 VENDOR_PROFILE_LOCKED

### POST /vendors/me/profile/submit
Role: VENDOR

Lưu và gửi xác minh trong một bước. Chỉ khi trạng thái là `NOT_SUBMITTED` hoặc `NEEDS_REVISION`. Thành công: `status = PENDING`, `submittedAt` = thời điểm gửi.

Request: `UpdateVendorProfileRequest`, kiểm tra như `PATCH` và thêm:
- Bắt buộc: `businessName`, `taxCode`, `representativeName`, `district`, `address`. Tài khoản chưa được gán lĩnh vực (dữ liệu lỗi) thì trả `400`, NCC liên hệ WebPlan.
- `taxCode`: 10 chữ số, hoặc 10 + 3 số chi nhánh (`0312345678`, `0312345678-001`).
- Đủ giấy tờ và ảnh cơ sở theo lĩnh vực (mục Luật theo lĩnh vực).

Response 200: `{ "data": VendorProfile }`

Lỗi: 400 VALIDATION_ERROR (`details` liệt kê trường thiếu/sai), 409 VENDOR_PROFILE_LOCKED

### POST /vendors/me/uploads/signature
Role: VENDOR

Xin chữ ký để FE upload thẳng lên Cloudinary (README mục 9). Sau khi upload, FE đưa `url`, `publicId`… vào `documents`/`photos` của request lưu hồ sơ.

Request

```json
{ "purpose": "VENDOR_DOCUMENT" }
```

`purpose`: `VENDOR_DOCUMENT` (giấy tờ, nhận PDF và ảnh) hoặc `VENDOR_PHOTO` (ảnh cơ sở, chỉ nhận ảnh). BE chọn thư mục theo mục đích.

Response 200

```json
{
  "data": {
    "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud-name>/auto/upload",
    "apiKey": "…",
    "timestamp": 1760760000,
    "signature": "…",
    "folder": "vendors/vp-1/documents"
  }
}
```

FE gửi `multipart/form-data` tới `uploadUrl` gồm `file`, `api_key`, `timestamp`, `signature`, `folder`; Cloudinary trả `secure_url`, `public_id`.

Lỗi: 400 VALIDATION_ERROR

### GET /vendors/{vendorId}/google-rating?fields=summary|reviews
Role: Public

Điểm và đánh giá Google Maps của nhà cung cấp, BE gọi Places API (New) lúc nhận request. FE không gọi thẳng Google và không giữ khóa API.

- CSDL chỉ có `google_maps_url`. BE lấy chuỗi tìm kiếm trong link (`?query=`, `/maps/search/…`, `/maps/place/…`); link rút gọn thì tìm bằng tên + địa chỉ, rồi Text Search ra `placeId`.
- `placeId` nhớ trong bộ nhớ BE; điểm và đánh giá cache 10 phút, **không lưu CSDL** (điều khoản Google Maps Platform).
- `fields=summary` (mặc định): điểm và số đánh giá. `fields=reviews`: kèm tối đa 5 đánh giá (giới hạn của Places API), `text` là bản gốc.
- Khóa: `GOOGLE_MAPS_API_KEY` trong `backend/.env`.

Response 200

```json
{
  "data": {
    "placeId": "ChIJ…",
    "rating": 4.7,
    "userRatingCount": 186,
    "googleMapsUri": "https://maps.google.com/?cid=…",
    "reviews": [
      { "authorName": "…", "authorUri": "…", "authorPhotoUri": "…", "rating": 5, "text": "…", "publishTime": "2026-05-01T08:00:00Z", "relativeTime": "5 tháng trước", "languageCode": "vi" }
    ],
    "reviewsSortedBy": "relevance"
  }
}
```

`rating` là `null` khi địa điểm chưa có điểm.

Lỗi: 404 `VENDOR_NOT_FOUND`, 404 `GOOGLE_PLACE_NOT_FOUND` (không tìm thấy địa điểm), 429 `GOOGLE_QUOTA_EXCEEDED`, 502 `GOOGLE_UNAVAILABLE`, 503 `GOOGLE_NOT_CONFIGURED` (chưa có khóa). FE hiện "Chưa có điểm Google" với mọi lỗi.

## Mã lỗi riêng

| HTTP | `code` | Khi nào |
|---|---|---|
| 409 | `VENDOR_PROFILE_LOCKED` | Sửa hoặc gửi hồ sơ đang `PENDING` / `VERIFIED` |

## Khác biệt với prototype

- Lĩnh vực: prototype có danh sách riêng 6 mục ("Nhà hàng / Trung tâm tiệc cưới", "Media — Quay phim, chụp ảnh"…) và cho NCC tự chọn. Ở đây dùng chung danh mục `GET /categories` theo quyết định của nhóm, và lĩnh vực cố định theo tài khoản (Admin gán), NCC không chọn.
- README prototype ghi 3 trạng thái; code prototype có thêm "Chưa gửi xác minh" (sau Lưu nháp). Dùng 4 trạng thái.
- Prototype lưu nháp chỉ kiểm tra link Google Maps. Ở đây kiểm tra thêm giờ hoạt động (thiếu một phần thì không lưu được thành `businessHours`).
- Bỏ phần chuyển đổi "giờ hoạt động kiểu cũ theo từng ngày" của prototype (dữ liệu cũ của prototype, không có ở hệ thống mới).

## Cần chốt

- **Phần Admin (làm sau):** màn tạo tài khoản NCC (từ yêu cầu tư vấn) phải **bắt buộc chọn lĩnh vực** (1 danh mục trong `GET /categories`). API tạo tài khoản NCC của Admin cần nhận `categoryId` và tạo sẵn hồ sơ trống với `category` đó.
- Luồng đổi lĩnh vực khi NCC liên hệ WebPlan: Admin sửa ở đâu, giấy tờ/ảnh không còn thuộc bộ của lĩnh vực mới xử lý thế nào, gói đang đăng thuộc lĩnh vực cũ ra sao, và hồ sơ có phải xác minh lại không.
- Khi lĩnh vực đã cố định, `verifiedCategory` có thể gộp vào `category` + `status = VERIFIED`. Tạm giữ vì gói dịch vụ và hoa hồng đang đọc trường này.
