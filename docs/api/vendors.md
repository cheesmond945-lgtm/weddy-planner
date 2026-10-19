# API: vendors (hồ sơ nhà cung cấp)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/vendors.ts`).
> Quy ước chung: [README.md](README.md).
> **Chờ đối chiếu `docs/database.md` và `docs/state-diagrams.md`** (hai tài liệu này đang trống): tên thực thể, tên trường, enum và trạng thái hồ sơ đang suy từ prototype NCC (`docs/prototype/prototype_vendor`, màn Hồ sơ nhà cung cấp).

Phạm vi: NCC xem, lưu nháp và gửi xác minh hồ sơ của mình; xin chữ ký upload ảnh/giấy tờ.
Chưa có: Admin duyệt hồ sơ, yêu cầu bổ sung (làm khi tới phần Admin, sẽ bổ sung vào file này).

## Enum

| Enum | Giá trị | Nhãn FE |
|---|---|---|
| `VendorProfileStatus` | `NOT_SUBMITTED` | Chưa gửi xác minh |
| | `PENDING` | Chờ duyệt |
| | `NEEDS_REVISION` | Cần bổ sung |
| | `VERIFIED` | Đã xác minh |
| `VendorDocumentType` | `BUSINESS_LICENSE` | Giấy tờ kinh doanh |
| | `FIRE_SAFETY` | Giấy tờ PCCC |
| | `FOOD_SAFETY` | Giấy tờ ATTP |
| `VendorPhotoType` | `FRONT` | Ảnh mặt tiền / cơ sở hoạt động |
| | `HALL` | Ảnh sảnh |
| `Weekday` | `MONDAY` … `SUNDAY` | Thứ 2 … Chủ nhật |

### Trạng thái hồ sơ

```
NOT_SUBMITTED ──submit──▶ PENDING ──Admin duyệt──▶ VERIFIED
                             │
                             └──Admin yêu cầu bổ sung──▶ NEEDS_REVISION ──submit──▶ PENDING
```

- Lưu nháp (`PATCH`) **không đổi** trạng thái: `NOT_SUBMITTED` giữ `NOT_SUBMITTED`, `NEEDS_REVISION` giữ `NEEDS_REVISION`.
- `PENDING` và `VERIFIED`: hồ sơ chỉ đọc, `PATCH` và `submit` trả `409 VENDOR_PROFILE_LOCKED`. Muốn đổi thông tin đã xác minh thì liên hệ Admin (chưa có luồng).
- Hai bước của Admin chờ chốt ở `state-diagrams.md`.

## Luật theo lĩnh vực

Lĩnh vực cung cấp dùng chung danh mục với phía cặp đôi (`GET /categories`, [catalog.md](catalog.md)), lưu bằng `categoryId`.

| Lĩnh vực | Giấy tờ bắt buộc | Ảnh cơ sở |
|---|---|---|
| Nhà hàng (`slug = nha-hang`) | `BUSINESS_LICENSE`, `FIRE_SAFETY`, `FOOD_SAFETY` | `FRONT` và `HALL`, mỗi loại ít nhất 1 ảnh (bắt buộc) |
| Lĩnh vực khác | `BUSINESS_LICENSE`, `FIRE_SAFETY` | `FRONT`, tùy chọn |

- Giấy tờ: mỗi loại **một** tệp, PDF hoặc ảnh JPG/PNG/WEBP, tối đa 10MB. Chỉ phục vụ xét duyệt, không công khai.
- Ảnh cơ sở: mỗi loại nhiều ảnh, JPG/PNG/WEBP, tối đa 10MB mỗi ảnh. Tách biệt với album ảnh của gói dịch vụ, không tự công khai.
- Tệp thuộc loại không có trong bộ của lĩnh vực đang chọn: BE trả `400 VALIDATION_ERROR` (FE đã tự bỏ khi người dùng đổi lĩnh vực).

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
  "district": "Hai Bà Trưng",
  "address": "128 Bà Triệu",
  "googleMapsUrl": "https://maps.app.goo.gl/…",
  "businessHours": { "fromDay": "MONDAY", "toDay": "SUNDAY", "openTime": "09:00", "closeTime": "21:00" },
  "documents": [
    { "type": "BUSINESS_LICENSE", "url": "https://…", "publicId": "…", "fileName": "GPKD-MayPalace.pdf", "size": 820000, "mimeType": "application/pdf" }
  ],
  "photos": [
    { "type": "FRONT", "url": "https://…", "publicId": "…", "fileName": "mat-tien.jpg", "size": 412000, "mimeType": "image/jpeg" }
  ],
  "reviewNote": "Giấy PCCC đã hết hạn, vui lòng tải bản còn hiệu lực.",
  "submittedAt": "2026-10-10T02:30:00.000Z",
  "updatedAt": "2026-10-12T08:15:00.000Z"
}
```

| Trường | Ghi chú |
|---|---|
| `businessName`, `taxCode`, `representativeName`, `address`, `district`, `category` | `null` khi chưa nhập (hồ sơ mới, lưu nháp dở) |
| `verifiedCategory` | Lĩnh vực Admin đã xác minh; dùng để cho phép NCC gửi duyệt gói thuộc lĩnh vực đó. `null` khi chưa xác minh lần nào |
| `province` | Hiện chỉ phục vụ Hà Nội, BE luôn trả `"Hà Nội"`, FE không gửi lên |
| `district` | Một trong 12 quận nội thành Hà Nội (danh sách ở `frontend/src/features/vendors/constants.ts`, BE kiểm tra cùng danh sách) |
| `businessHours` | Một khung giờ chung, tùy chọn. `openTime`, `closeTime` dạng `HH:mm`, bước 30 phút, `closeTime > openTime`. `null` khi không khai |
| `reviewNote` | Lý do Admin yêu cầu bổ sung, có khi `NEEDS_REVISION` |
| `submittedAt` | Lần gửi xác minh gần nhất |

`UpdateVendorProfileRequest` (body chung của lưu nháp và gửi xác minh)

```json
{
  "businessName": "Công ty TNHH Mây Palace",
  "taxCode": "0312345678",
  "representativeName": "Trần Thu Mây",
  "categoryId": "cat-1",
  "district": "Hai Bà Trưng",
  "address": "128 Bà Triệu",
  "googleMapsUrl": null,
  "businessHours": null,
  "documents": [{ "type": "BUSINESS_LICENSE", "url": "…", "publicId": "…", "fileName": "…", "size": 820000, "mimeType": "application/pdf" }],
  "photos": []
}
```

Gửi **toàn bộ** hồ sơ mỗi lần (không gửi từng phần). `documents`, `photos` là danh sách cuối cùng: tệp không còn trong danh sách là đã bị xóa.

---

### GET /vendors/me/profile
Role: VENDOR

Hồ sơ của NCC đang đăng nhập. Tài khoản NCC mới (vừa đặt mật khẩu lần đầu) có sẵn hồ sơ trống, trạng thái `NOT_SUBMITTED`.

Response 200: `{ "data": VendorProfile }`

Lỗi: 401, 403

### PATCH /vendors/me/profile
Role: VENDOR

Lưu nháp. Không đổi trạng thái.

Request: `UpdateVendorProfileRequest`. Các trường được để trống (`null`), chỉ kiểm tra định dạng của trường đã nhập:
- `googleMapsUrl`: link Google Maps (`https://maps.app.goo.gl/…`, `https://www.google.com/maps/…`, `https://goo.gl/maps/…`).
- `businessHours`: đủ 4 trường và `closeTime > openTime`.
- `categoryId` nếu có: phải là danh mục đang có.

Response 200: `{ "data": VendorProfile }`

Lỗi: 400 VALIDATION_ERROR, 409 VENDOR_PROFILE_LOCKED

### POST /vendors/me/profile/submit
Role: VENDOR

Lưu và gửi xác minh trong một bước. Chỉ khi trạng thái là `NOT_SUBMITTED` hoặc `NEEDS_REVISION`. Thành công: `status = PENDING`, `submittedAt` = thời điểm gửi.

Request: `UpdateVendorProfileRequest`, kiểm tra như `PATCH` và thêm:
- Bắt buộc: `businessName`, `taxCode`, `representativeName`, `categoryId`, `district`, `address`.
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

## Mã lỗi riêng

| HTTP | `code` | Khi nào |
|---|---|---|
| 409 | `VENDOR_PROFILE_LOCKED` | Sửa hoặc gửi hồ sơ đang `PENDING` / `VERIFIED` |

## Khác biệt với prototype

- Lĩnh vực: prototype có danh sách riêng 6 mục ("Nhà hàng / Trung tâm tiệc cưới", "Media — Quay phim, chụp ảnh"…). Ở đây dùng chung danh mục `GET /categories` theo quyết định của nhóm.
- README prototype ghi 3 trạng thái; code prototype có thêm "Chưa gửi xác minh" (sau Lưu nháp). Dùng 4 trạng thái.
- Prototype lưu nháp chỉ kiểm tra link Google Maps. Ở đây kiểm tra thêm giờ hoạt động (thiếu một phần thì không lưu được thành `businessHours`).
- Bỏ phần chuyển đổi "giờ hoạt động kiểu cũ theo từng ngày" của prototype (dữ liệu cũ của prototype, không có ở hệ thống mới).
