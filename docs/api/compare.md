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
    "items": [ { "id": "sv-1", "name": "Grand Lotus Palace", "cost": 125000000, "…": "ServiceDetail" } ],
    "categoryBudget": 127000000,
    "tables": 25,
    "recommendation": {
      "serviceId": "sv-2",
      "reasons": ["giá thấp nhất"],
      "isTie": false,
      "usedRating": true
    }
  }
}
```

- `items`: theo đúng thứ tự id gửi lên. `cost` là **chi phí gói** dùng để so: gói rẻ nhất đang bán của nhà cung cấp (nhà hàng: trong các sảnh đủ chỗ, `giá bàn × max(số bàn, số bàn tối thiểu)`), cùng cách tính với tab Ngân sách ([weddings.md](weddings.md) mục 7).
- `categoryBudget`: ngân sách hạng mục **đang hiển thị trong kế hoạch** (số khách sửa tay nếu có, ngược lại số gợi ý theo mức chi). `null` khi chưa có đám cưới hoặc hạng mục không nằm trong dịch vụ muốn dùng.
- `tables`: số bàn đang dùng; `null` khi chưa có đám cưới.
- `recommendation`: BE **luôn** tính (thiếu điểm Google thì bỏ yếu tố điểm). Chỉ `null` ở chế độ dữ liệu giả của FE. `serviceId` là `null` khi `isTie = true`.
- `reasons`: chữ thường, FE tự viết hoa chữ đầu và nối bằng dấu phẩy. Tối đa 3.

Lỗi: 400 `COMPARE_INVALID_COUNT`, 400 `COMPARE_MIXED_CATEGORIES`, 404 `SERVICE_NOT_FOUND`, 401, 403

---

## Công thức đề xuất

BE và FE dùng **cùng một hàm**: `backend/src/modules/compare/recommend.ts` là bản sao **giống hệt** `frontend/src/features/compare/recommend.ts` (hằng số trong `recommend.config.ts` hai bên). Test `backend/test/recommend-same.test.cjs` báo lỗi khi hai bản lệch nhau.

**Trung lập:** chỉ dùng điểm Google Maps, chi phí gói và độ phù hợp với ngân sách hạng mục. Không có yếu tố ưu tiên NCC trả phí, quảng cáo hay hoa hồng. **Không xét phong cách** (bỏ ngày 30/10/2026): tag của gói do NCC nhập chỉ dùng cho tìm kiếm và bộ lọc.

Đầu vào cho mỗi phương án: `price` (= `cost` ở trên), `rating`, `reviewCount` (từ Google, **có thể thiếu**), `capacity`.
Thông tin đám cưới (có thể chưa có): `categoryBudget`, `guestCount`.

Với mỗi phương án:

1. `bayes = (rating × reviewCount + 4.3 × 100) / (reviewCount + 100)`; `R = bayes / 5`
2. `P = chi phí thấp nhất trong nhóm / price`
3. **Phù hợp** `F = min(1, categoryBudget / price)`; không có `categoryBudget` thì không có `F`.
4. `điểm = 0.55 × R + 0.45 × P` khi không có `F`; ngược lại `0.40 × R + 0.30 × P + 0.30 × F`.
5. **Thiếu điểm:** có ít nhất một phương án thiếu `rating` thì bỏ yếu tố điểm cho **cả nhóm**: `điểm = P` khi không có `F`, `0.5 × P + 0.5 × F` khi có `F`.
6. Hạng mục có sức chứa (hiện chỉ **nhà hàng**), có `guestCount` và `capacity < guestCount` thì `điểm × 0.7`.
7. Sắp xếp giảm dần. Nếu `điểm[0] − điểm[1] < 0.03` thì `isTie = true`, không đề xuất.

**Lý do** (chỉ nêu khi phương án đề xuất thật sự hơn các phương án còn lại; lấy tối đa 3 theo thứ tự):

1. `đủ chỗ cho N khách`: đề xuất đủ chỗ và có phương án khác thiếu chỗ.
2. `nằm trong ngân sách hạng mục`: đề xuất có `F = 1` và có phương án khác `F < 1`.
3. `giá thấp nhất`: chi phí của đề xuất thấp nhất và không bị trùng.
4. `điểm Google Maps cao nhất`: chỉ khi dùng điểm; điểm của đề xuất cao nhất và không bị trùng.
5. Không có lý do nào: `nhiều đánh giá nhất` hoặc `cân bằng tốt giữa giá và đánh giá` (thiếu điểm: `cân bằng tốt giữa giá và nhu cầu của bạn`).

### Ví dụ (đã có trong `recommend.test.ts`)

| Trường hợp | Kết quả |
|---|---|
| A: 128.000.000đ, 4.7, 1824 đánh giá, sức chứa 600. B: 96.000.000đ, 4.5, 932 đánh giá, sức chứa 400. Không có đám cưới | Đề xuất B, lý do `giá thấp nhất` |
| Như trên, 500 khách, ngân sách hạng mục 120.000.000đ | Đề xuất A, lý do `đủ chỗ cho 500 khách` |
| C: 95.000.000đ, D: 140.000.000đ, cùng điểm, ngân sách hạng mục 100.000.000đ | Đề xuất C, có lý do `nằm trong ngân sách hạng mục` |
| Hai phương án gần như giống nhau về giá và đánh giá | `isTie = true` |

## Cần chốt

1. Tên tham số theo database.md (`serviceIds` hay `vendorIds`).
2. (Đã chốt 30/10/2026) Ngân sách hạng mục lấy từ tab Ngân sách, không còn tỷ lệ riêng ở đây.
3. (Đã chốt) Điểm Google lấy lúc gọi qua `PlaceId`, không lưu database: xem vendors.md.
