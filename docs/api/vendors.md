# API: vendors

> **Bản nháp để nhóm duyệt.** Quy ước chung: [README.md](README.md).
> **Chờ đối chiếu `docs/database.md`.** Ở FE, id nhà cung cấp hiện trùng với id "service" của catalog (ví dụ `sv-1`).

## GET /vendors/{vendorId}/google-rating

Điểm và đánh giá Google Maps của nhà cung cấp, lấy **lúc gọi** qua `PlaceId` của VendorProfiles. CSDL không có cột điểm hay đánh giá và **không lưu** các dữ liệu này.

FE đã làm theo bằng dữ liệu giả (`frontend/src/mocks/googleRating.ts`, `src/api/googleRating.ts`, hook `useGoogleRating`).

**Role:** Couple. **Cần nhóm quyết định:** trang Dịch vụ cưới và trang chi tiết đang cho khách chưa đăng nhập xem, nên endpoint có lẽ cần **Public**. Nếu để Public thì bắt buộc giới hạn tần suất theo IP (xem ghi chú hạn mức).

### Query

| Tham số | Giá trị | Ghi chú |
|---|---|---|
| `fields` | `summary` (mặc định) \| `reviews` | `summary`: điểm + số đánh giá (thẻ dịch vụ, bảng so sánh). `reviews`: thêm tối đa 5 đánh giá (tab "Đánh giá và phản hồi") |

### Response 200, `fields=reviews`

```json
{
  "data": {
    "placeId": "ChIJ…",
    "rating": 4.7,
    "userRatingCount": 1824,
    "googleMapsUri": "https://maps.google.com/?cid=…",
    "reviews": [
      {
        "authorName": "Nguyễn Thị Hồng Nhung",
        "authorUri": "https://www.google.com/maps/contrib/…",
        "authorPhotoUri": "https://lh3.googleusercontent.com/…",
        "rating": 5,
        "text": "Tụi mình tổ chức tiệc 450 khách ở đây…",
        "publishTime": "2026-10-12T08:30:00Z",
        "relativeTime": "6 ngày trước",
        "languageCode": "vi"
      }
    ],
    "reviewsSortedBy": "relevance"
  }
}
```

### Response 200, `fields=summary`

```json
{ "data": { "placeId": "ChIJ…", "rating": 4.7, "userRatingCount": 1824, "googleMapsUri": "https://maps.google.com/?cid=…" } }
```

Không có `reviews`, `reviewsSortedBy`.

| Trường | Ghi chú |
|---|---|
| `rating` | 1.0–5.0, hoặc `null` khi địa điểm chưa có điểm |
| `userRatingCount` | Tổng số lượt đánh giá trên Google (không phải số phần tử của `reviews`) |
| `googleMapsUri` | Liên kết "Xem tất cả đánh giá trên Google Maps" |
| `reviews` | **Tối đa 5**, sắp theo mức liên quan (giới hạn của Places API; không lấy được "tất cả đánh giá") |
| `reviews[].authorName`, `authorUri` | Bắt buộc hiển thị tên tác giả, có liên kết nếu có `authorUri` |
| `reviews[].publishTime` | ISO 8601; FE tự tính "x ngày trước" bằng tiếng Việt |
| `reviews[].relativeTime` | Chuỗi Google trả sẵn (`relativePublishTimeDescription`), dự phòng |
| `reviews[].text` | Có thể rỗng; FE chỉ hiện đánh giá có nội dung |

### Lỗi (`{ "error": { "code", "message" } }`)

| HTTP | `code` | Khi nào | FE hiển thị |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | `fields` sai | |
| 404 | `VENDOR_NOT_FOUND` | Không có nhà cung cấp | |
| 404 | `VENDOR_PLACE_NOT_FOUND` | Nhà cung cấp chưa có `PlaceId` | "Chưa có điểm Google", không có nút thử lại |
| 429 | `GOOGLE_QUOTA_EXCEEDED` | Vượt hạn mức (của WebPlan hoặc của Google) | "Chưa có điểm Google" |
| 502 | `GOOGLE_UPSTREAM_ERROR` | Google lỗi hoặc quá thời gian | Thẻ: "Chưa có điểm Google"; tab đánh giá: nút "Thử lại" |

FE thử lại **1 lần** với lỗi 502 và lỗi mạng, không thử lại 404/429.

### Ghi chú cho BE

- Khóa `GOOGLE_PLACES_API_KEY` **chỉ ở backend** (biến môi trường, không commit). FE không chứa khóa và không gọi thẳng Google.
- Dùng Places API (New) **Place Details** với **field mask** chỉ chứa trường cần thiết, vì giá tính theo trường yêu cầu:
  - `summary`: `rating,userRatingCount,googleMapsUri`
  - `reviews`: thêm `reviews`
  - Gửi `languageCode=vi` để `relativePublishTimeDescription` là tiếng Việt.
- **Không lưu** nội dung Places (điểm, số đánh giá, đánh giá) vào database. Chỉ `placeId` được lưu lâu dài. Nếu cần cache để giảm chi phí thì chỉ cache ngắn trong bộ nhớ, theo đúng điều khoản Google Maps Platform.
- Đặt **giới hạn ngân sách và cảnh báo** trong Google Cloud Console, giới hạn khóa theo API (chỉ Places API) và theo IP máy chủ.
- Giới hạn tần suất gọi endpoint này phía WebPlan (đặc biệt nếu để Public), trả 429 khi vượt.
- Hàm đề xuất so sánh (BE tính, [compare.md](compare.md)) dùng `rating`, `userRatingCount` từ endpoint này; thiếu điểm thì bỏ yếu tố điểm.

### Ghi chú về FE

- Thẻ dịch vụ chỉ gọi `summary` khi thẻ vào vùng nhìn thấy (IntersectionObserver).
- Kết quả chỉ giữ trong cache bộ nhớ của React Query (`staleTime` 5 phút), **không** ghi vào localStorage, sessionStorage hay IndexedDB.
- Hiển thị dữ liệu Google không kèm bản đồ thì có ghi nguồn Google (`GoogleAttribution`). Hiện đang dùng chữ "Google Maps" tạm; **TODO:** thay bằng logo chính thức theo hướng dẫn ghi nguồn của Google Maps Platform.
