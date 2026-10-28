# Quy ước API chung

> **Bản nháp, chờ duyệt.** Áp dụng cho mọi file `docs/api/<module>.md`.
> Tên thực thể, trường, enum và giá trị role lấy nguyên văn từ `docs/database.md` khi tài liệu đó được chốt. Ví dụ dưới đây chỉ minh họa định dạng, không phải tên thật.

## 1. Chung

| Mục | Quy ước |
|---|---|
| Base URL | `http://localhost:3000/api` (dev). Swagger: `/api/docs` |
| Định dạng | JSON, UTF-8. Header `Content-Type: application/json` |
| Tên trường | camelCase, khớp `schema.prisma` |
| Đường dẫn | Danh từ số nhiều, kebab-case: `/consultation-requests`, `/orders/:id` |
| Method | `GET` đọc, `POST` tạo hoặc hành động, `PATCH` sửa một phần, `DELETE` xóa. Hành động đổi trạng thái dùng `POST /<resource>/:id/<hành-động>` (ví dụ `POST /orders/:id/cancel`) |
| Giá trị rỗng | Trường luôn có trong response; không có giá trị thì trả `null`, không bỏ trường |
| Ngôn ngữ | `message` trong lỗi viết tiếng Việt, hiển thị được cho người dùng |

## 2. Response thành công

Một đối tượng:

```json
{ "data": { "id": "…", "name": "…" } }
```

Danh sách có phân trang (xem mục 6):

```json
{
  "data": [{ "id": "…" }],
  "meta": { "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 }
}
```

Không có nội dung trả về: `{ "data": null }`, mã 200.

BE: controller trả giá trị thuần, `TransformResponseInterceptor` bọc `{ data }`. Service trả `Paginated.of(items, total, query)` thì thành `{ data, meta }`.
Ngoại lệ: endpoint do bên ngoài quy định định dạng (ví dụ health check) dùng `@RawResponse()`.

## 3. Lỗi

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu gửi lên không hợp lệ.",
    "details": [{ "field": "email", "messages": ["email must be an email"] }]
  }
}
```

- `code`: UPPER_SNAKE_CASE, ổn định, FE dựa vào để xử lý. `message`: để hiển thị. `details`: chỉ có khi cần (lỗi validate).
- Mã lỗi riêng của module ghi trong `docs/api/<module>.md`, đặt theo dạng `<ĐỐI_TƯỢNG>_<LÝ_DO>` (ví dụ `ORDER_ALREADY_PAID`).

| HTTP | `code` mặc định | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query sai kiểu, thiếu trường, thừa trường |
| 400 | `BAD_REQUEST` | Yêu cầu sai nghiệp vụ chung |
| 401 | `UNAUTHORIZED` | Không gửi token |
| 401 | `TOKEN_INVALID` | Token sai hoặc hết hạn. FE xóa phiên, về trang đăng nhập |
| 403 | `FORBIDDEN` | Đã đăng nhập nhưng sai role |
| 404 | `NOT_FOUND` | Không có bản ghi, hoặc bản ghi thuộc người khác (xem mục 8) |
| 409 | `CONFLICT` | Trùng dữ liệu, hoặc chuyển trạng thái không hợp lệ theo `docs/state-diagrams.md` |
| 422 | `UNPROCESSABLE_ENTITY` | Dữ liệu đúng kiểu nhưng không xử lý được (ví dụ ngày cưới đã qua) |
| 429 | `TOO_MANY_REQUESTS` | Gọi quá nhiều (đăng nhập, gửi email) |
| 500 | `INTERNAL_ERROR` | Lỗi máy chủ. Không lộ chi tiết; chi tiết chỉ ghi log |

## 4. Tiền

- Số nguyên, đơn vị **đồng**, kiểu `number` trong JSON. Không số thập phân, không chuỗi, không ký hiệu.
  `"price": 15000000` nghĩa là 15.000.000 ₫.
- Chỉ FE định dạng khi hiển thị: `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`.
- DB: `Int` (tới khoảng 2,1 tỷ) hoặc `BigInt` nếu cần lớn hơn. Nếu dùng `BigInt`, BE vẫn trả `number` (an toàn tới 9 triệu tỷ).
- Tỷ lệ (hoa hồng, % cọc): **cần chốt**, đề xuất số nguyên phần trăm (`10` = 10%). Nếu cần lẻ thì dùng phần nghìn hoặc basis point, ghi rõ trong module.
- Số tiền tính ra (cọc, hoa hồng) do BE tính và làm tròn tới đồng; FE không tự tính để gửi lên.

## 5. Ngày giờ

| Loại | Định dạng | Ví dụ |
|---|---|---|
| Thời điểm (tạo, cập nhật, thanh toán, hết hạn) | ISO 8601 UTC, có `Z` | `"2026-10-18T03:15:00.000Z"` |
| Chỉ ngày (ngày cưới, ngày thực hiện dịch vụ) | `YYYY-MM-DD`, không giờ, không múi giờ | `"2026-12-20"` |
| Chỉ giờ trong ngày (mốc timeline) | `HH:mm` 24h | `"09:30"` |

- FE gửi thời điểm bằng `Date.toISOString()`; hiển thị theo múi giờ `Asia/Ho_Chi_Minh`, dạng `dd/MM/yyyy` và `HH:mm`.
- Thời hạn tính theo ngày (hết hạn cọc, bảng kê tháng) tính theo múi giờ Việt Nam.
- Lọc theo khoảng: `?from=2026-10-01&to=2026-10-31` (bao gồm cả hai đầu).

## 6. Phân trang, sắp xếp, lọc

| Query | Mặc định | Ghi chú |
|---|---|---|
| `page` | `1` | Bắt đầu từ 1 |
| `pageSize` | `20` | Tối đa `100` |
| `sort` | tùy endpoint | `sort=createdAt` tăng dần, `sort=-createdAt` giảm dần. Nhiều trường: `sort=-rating,price` |
| `q` | | Tìm theo từ khóa |
| Lọc | | Tên query trùng tên trường: `?status=PENDING`. Nhiều giá trị: `?status=PENDING,CONFIRMED` |

- Mọi endpoint danh sách có thể dài đều phân trang và trả `meta`.
- Danh sách ngắn, cố định (ví dụ danh mục) có thể trả mảng không phân trang, ghi rõ trong module.
- Trường được phép `sort`/lọc liệt kê trong từng module; trường khác trả `400 VALIDATION_ERROR`.

## 7. Enum

- Giá trị là chuỗi UPPER_SNAKE_CASE, **giống hệt** enum trong `schema.prisma` / `docs/database.md`. Không dùng số.
- Nhãn tiếng Việt chỉ nằm ở FE (bảng ánh xạ trong `features/<module>`), BE không trả nhãn.
- Trạng thái chỉ đổi qua endpoint hành động (mục 1), theo đúng `docs/state-diagrams.md`. Chuyển không hợp lệ trả `409`.
- Thêm giá trị enum mới: sửa `docs/database.md` trước, báo cả FE và BE.

## 8. Xác thực và phân quyền

- Header: `Authorization: Bearer <accessToken>`. Token là JWT, payload tối thiểu `sub` (id người dùng) và `role`.
- Role: Couple, Vendor, Admin. Giá trị enum chính xác **chờ `docs/database.md`** (code đang để tạm `COUPLE`, `VENDOR`, `ADMIN`).
- Mỗi endpoint trong tài liệu module ghi cột **Role**: `Public`, `Đã đăng nhập`, hoặc danh sách role.
- BE: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)`. Lấy người gọi bằng `@CurrentUser()`.
- **Quyền sở hữu**: Couple chỉ xem/sửa dữ liệu của mình, Vendor chỉ dữ liệu của NCC mình. Truy cập dữ liệu của người khác trả `404` (không tiết lộ là có tồn tại). Admin xem được tất cả.
- NCC không tự đăng ký: Admin duyệt yêu cầu tư vấn, hệ thống gửi email link đặt mật khẩu lần đầu. Link dùng token riêng, một lần, có hạn (chi tiết trong `auth.md`).
- Thời hạn token và cơ chế làm mới (refresh token hay đăng nhập lại): **cần chốt** trong `auth.md`.

## 9. Upload ảnh

- FE xin chữ ký từ BE (endpoint trong module tương ứng), upload thẳng lên Cloudinary, rồi gửi lại BE `url`/`publicId` để lưu.
- BE không nhận file ảnh trực tiếp. Không để lộ `CLOUDINARY_API_SECRET` ở FE.

## 10. Mẫu tài liệu cho mỗi endpoint

Mỗi `docs/api/<module>.md` viết từng endpoint theo mẫu:

````markdown
### POST /example-resources
Role: COUPLE

Request
```json
{ "fieldA": "…" }
```

Response 200
```json
{ "data": { "id": "…", "fieldA": "…" } }
```

Lỗi: 400 VALIDATION_ERROR, 409 EXAMPLE_ALREADY_EXISTS
````

## 11. Cần chốt

1. Giá trị enum role (theo `docs/database.md`).
2. Kiểu id: UUID hay cuid (đề xuất UUID, chuỗi).
3. Cách biểu diễn tỷ lệ phần trăm (mục 4).
4. Thời hạn JWT và có dùng refresh token không.
5. Có cần phiên bản API (`/api/v1`) không; đề xuất chưa cần cho đồ án.
