# API: compare (kết quả so sánh và đề xuất)

> **Bản nháp để nhóm duyệt** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/compare.ts`).
> Quy ước chung: [README.md](README.md). `ServiceDetail`: xem [catalog.md](catalog.md).
> **Chờ đối chiếu `docs/database.md`** (đang trống). Theo quyết định của nhóm, đơn vị so sánh là **nhà cung cấp**; ở FE và tài liệu catalog đang gọi là "service" (`serviceId`). Khi database.md được chốt, đổi tên tham số theo (ví dụ `vendorIds`).
> Điểm Google (`rating`, `reviewCount`) **không** nằm trong `items`: BE lấy lúc gọi qua `PlaceId` (xem [vendors.md](vendors.md)); FE ở chế độ dữ liệu giả lấy qua `GET /vendors/{id}/google-rating?fields=summary` rồi tự tính đề xuất (`recommendation = null` trong response giả).

Role: **COUPLE**.

Danh sách đang chọn để so sánh chỉ nằm ở FE (sessionStorage của tab), không lưu lên BE.

### GET /compare?serviceIds=sv-1,sv-2,sv-3

Quy tắc: 2 đến 3 id, không trùng, **cùng hạng mục**.

Response 200

```json
{
  "data": {
    "items": [ { "id": "sv-1", "name": "Grand Lotus Palace", "…": "ServiceDetail" } ],
    "recommendation": {
      "serviceId": "sv-2",
      "reasons": ["giá thấp nhất"],
      "isTie": false
    }
  }
}
```

- `items`: theo đúng thứ tự id gửi lên.
- `recommendation.serviceId`: `null` khi `isTie = true`.
- `reasons`: chữ thường, FE tự viết hoa chữ đầu và nối bằng dấu phẩy. Tối đa 3.

Lỗi: 400 `COMPARE_INVALID_COUNT`, 400 `COMPARE_MIXED_CATEGORIES`, 404 `SERVICE_NOT_FOUND`, 401, 403

---

## Công thức đề xuất

BE phải tính **giống hệt** `frontend/src/features/compare/recommend.ts`; hằng số trong `recommend.config.ts`.

**Trung lập:** chỉ dùng điểm Google Maps, giá và độ phù hợp với thông tin đám cưới. Không có yếu tố ưu tiên NCC trả phí, quảng cáo hay hoa hồng.

Đầu vào cho mỗi phương án: `price` (= `priceFrom`), `rating`, `reviewCount` (từ Google, **có thể thiếu**: chưa có điểm, chưa có PlaceId hoặc Google lỗi), `styles`, `city` (= `location`), `capacity`.

**Thiếu điểm:** nếu có ít nhất một phương án thiếu `rating`, bỏ yếu tố điểm cho **cả nhóm**: `điểm = P` khi không có `F`, `điểm = 0.5 × P + 0.5 × F` khi có `F`. Không nêu lý do về điểm Google; lý do dự phòng là `cân bằng tốt giữa giá và nhu cầu của bạn`.
Thông tin đám cưới của người gọi (có thể chưa có): `budget`, `guestCount`, `city`, `styles`.

Với mỗi phương án:

1. `bayes = (rating × reviewCount + 4.3 × 100) / (reviewCount + 100)`; `R = bayes / 5`
2. `P = giá thấp nhất trong nhóm / price`
3. Nếu có thông tin đám cưới, `F` = trung bình các thành phần **có dữ liệu**:
   - `inBudget = min(1, ngânSáchHạngMục / price)`, `ngânSáchHạngMục = budget × tỷLệHạngMục` (chỉ khi có `budget`),
   - `styleOverlap = số phong cách trùng / số phong cách khách chọn` (chỉ khi khách có chọn),
   - `cityMatch = 1` nếu cùng khu vực, ngược lại `0` (chỉ khi có `city`).
   Không có thành phần nào thì coi như không có thông tin đám cưới.
4. `điểm = 0.55 × R + 0.45 × P` khi không có `F`; ngược lại `0.40 × R + 0.30 × P + 0.30 × F`.
5. Hạng mục có sức chứa (hiện chỉ **nhà hàng**), khách đã nhập `guestCount` và `capacity < guestCount` → `điểm × 0.7`.
6. Sắp xếp giảm dần. Nếu `điểm[0] − điểm[1] < 0.03` → `isTie = true`, không đề xuất.

Tỷ lệ ngân sách theo hạng mục (**TẠM**, chưa có trong database.md): nhà hàng 0.22, decor 0.14, trang phục 0.10, makeup 0.08, chụp ảnh 0.12, quay phóng sự 0.08, cỗ cưới 0.14, hoa cưới 0.12.

**Lý do** (chỉ nêu khi phương án đề xuất thật sự hơn các phương án còn lại; lấy tối đa 3 theo thứ tự):

1. `đủ chỗ cho N khách`: đề xuất đủ chỗ và có phương án khác thiếu chỗ.
2. `nằm trong ngân sách hạng mục`: đề xuất có `inBudget = 1` và có phương án khác `< 1`.
3. `hợp phong cách X, Y`: `styleOverlap` của đề xuất lớn hơn mọi phương án khác (X, Y là phong cách trùng).
4. `giá thấp nhất`: giá của đề xuất thấp nhất và không bị trùng.
5. `điểm Google Maps cao nhất`: điểm của đề xuất cao nhất và không bị trùng.
6. Không có lý do nào: `nhiều đánh giá nhất` nếu có nhiều đánh giá nhất, ngược lại `cân bằng tốt giữa giá và đánh giá`.

### Ví dụ để BE kiểm tra (FE đã chạy thử khớp)

| Trường hợp | Kết quả |
|---|---|
| A: 128.000.000đ, 4.7, 1824 đánh giá, sức chứa 600. B: 96.000.000đ, 4.5, 932 đánh giá, sức chứa 400. Không có thông tin đám cưới | Đề xuất B, lý do `giá thấp nhất` |
| Như trên, đám cưới 500 khách, ngân sách 300.000.000đ, phong cách "Sang trọng" (A có, B không) | Đề xuất A, lý do `đủ chỗ cho 500 khách`, `hợp phong cách sang trọng`, `điểm Google Maps cao nhất` |
| Hai phương án gần như giống nhau về giá và đánh giá (ví dụ Sen Vàng Convention và Riverside Palace trong dữ liệu giả) | `isTie = true` |

## Cần chốt

1. Tên tham số và trường theo database.md (`serviceIds` hay `vendorIds`, `location` hay `city`, `styles` hay `style`).
2. Tỷ lệ ngân sách theo hạng mục lưu ở đâu (hằng số hay bảng cấu hình).
3. (Đã chốt) Điểm Google lấy lúc gọi qua `PlaceId`, không lưu database: xem vendors.md.
