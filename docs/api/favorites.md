# API: favorites

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/favorites.ts`).
> Quy ước chung: [README.md](README.md). Đối tượng `ServiceSummary`: xem [catalog.md](catalog.md).
> File này chưa có trong danh sách `docs/api/` của ARCHITECTURE.md; thêm vì BE có module `favorites` riêng.

Phạm vi: cặp đôi lưu dịch vụ yêu thích (mục 3.1, 3.2 trong prototype).
So sánh dịch vụ (3.3, 3.4) **không cần API riêng**: FE giữ danh sách đang chọn trong tab trình duyệt, bảng so sánh dùng `GET /services/:id` của catalog.

Role cho mọi endpoint: **COUPLE**. Mỗi cặp đôi chỉ thấy và sửa yêu thích của mình.

### GET /favorites

Danh sách dịch vụ yêu thích, mới thêm nằm cuối (FE tự nhóm theo danh mục). Không phân trang (mỗi người thường chỉ vài chục mục).

Response 200

```json
{
  "data": [
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
  ]
}
```

Dịch vụ đã bị ẩn (NCC ngừng hoạt động) thì không trả về.

Lỗi: 401 `UNAUTHORIZED`, 403 `FORBIDDEN`

### PUT /favorites/:serviceId

Thêm vào yêu thích. Gọi lại khi đã có thì vẫn trả 200 (không lỗi).

Request: không có body.

Response 200: `{ "data": null }`

Lỗi: 401, 403, 404 `SERVICE_NOT_FOUND`

### DELETE /favorites/:serviceId

Bỏ khỏi yêu thích. Chưa có trong yêu thích thì vẫn trả 200.

Response 200: `{ "data": null }`

Lỗi: 401, 403

---

## Ghi chú

- FE cập nhật giao diện ngay khi bấm, lỗi thì trả lại như cũ, nên hai endpoint thêm/bỏ cần **idempotent** như trên.
- Số đếm trên menu "Dịch vụ yêu thích" và nút nổi trái tim lấy từ độ dài `GET /favorites`.
