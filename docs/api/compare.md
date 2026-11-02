# API: compare (so sánh dịch vụ)

> Quy ước chung: [README.md](README.md). `ServiceDetail`: xem [catalog.md](catalog.md).
> Đơn vị so sánh là **nhà cung cấp**; ở FE và tài liệu catalog đang gọi là "service" (`serviceId`).

Role: **COUPLE**.

So sánh bằng **thuật toán**, không gọi AI và **không đề xuất** chọn bên nào (bỏ banner "Forever đề xuất", nhãn "Đề xuất", icon lấp lánh, dòng "Khoảng giá", khoảng cách km từ 02/11/2026). Mọi phép tính nằm trong hàm thuần `backend/src/modules/compare/compare-rules.ts` (test: `backend/test/compare-rules.test.cjs`), hằng số trong `compare.config.ts`. FE chỉ hiển thị.

Danh sách đang chọn để so sánh chỉ nằm ở FE (sessionStorage của tab), không lưu lên BE.

### GET /compare?serviceIds=a,b,c&packageIds=a:p1,b:p2

- `serviceIds`: 2 đến 3 id, không trùng, **cùng hạng mục**. Khác hạng mục: 400 `COMPARE_MIXED_CATEGORIES` "Chỉ so sánh được dịch vụ cùng hạng mục.". Dịch vụ ẩn / chưa duyệt: 404 `SERVICE_NOT_FOUND`.
- `packageIds` (không bắt buộc): gói khách chọn ở dropdown, dạng `serviceId:packageId`. Gói không thuộc dịch vụ thì bỏ qua (dùng gói mặc định). FE gọi lại mỗi lần đổi gói để BE tính lại các dòng và dòng tóm tắt.

Response 200

```json
{
  "data": {
    "category": { "id": "…", "slug": "nha-hang", "name": "Trung tâm tổ chức sự kiện" },
    "items": [ "ServiceDetail (đầu cột, nút)" ],
    "budget": 234000000,
    "guestCount": 300,
    "tables": 30,
    "comparison": {
      "summary": ["Mipec Place rẻ hơn Hanoi Tower 53.000.000đ.", "Hanoi Tower có sức chứa lớn hơn Mipec Place 200 khách."],
      "rows": { "budget": true, "tables": true, "location": false, "capacity": true },
      "columns": [{
        "id": "…", "name": "Hanoi Tower",
        "package": { "id": "…", "name": "Sảnh Hoa Dạ Quang", "price": 5800000 },
        "packages": [{ "id": "…", "name": "Sảnh Hoa Dạ Quang", "total": 203000000 }],
        "total": 203000000, "formula": "35 × 5.800.000đ", "assumption": null,
        "budget": { "kind": "LEFT", "amount": 31000000, "text": "Còn dư 31.000.000đ" },
        "tables": { "count": 35, "byMinimum": true, "text": "35 bàn, tối thiểu của gói", "warning": "Gói này yêu cầu tối thiểu 35 bàn, nhiều hơn 5 bàn so với dự kiến của bạn" },
        "location": null,
        "capacity": { "max": 500, "fits": true, "text": "Tối đa 500 khách, đủ cho 300 khách của bạn" },
        "rating": { "value": null, "count": 0, "text": "Chưa có đánh giá" },
        "includes": ["Phong cách lãng mạn", "Thích hợp cho tiệc cưới gia đình và bạn bè"],
        "canAdd": true, "blockReason": null,
        "labels": { "cheapest": false, "largestCapacity": true, "topRated": false }
      }]
    }
  }
}
```

Lỗi: 400 `COMPARE_INVALID_COUNT`, 400 `COMPARE_MIXED_CATEGORIES`, 404 `SERVICE_NOT_FOUND`, 401, 403

## Cách tính

- **Tổng chi phí ước tính** (mọi so sánh và nhãn dùng số này, **không** dùng đơn giá): trung tâm tiệc = đơn giá/bàn × max(số bàn của kế hoạch, `min_tables` của gói), số bàn của kế hoạch = ⌈số khách / `GUESTS_PER_TABLE`⌉ (hoặc số bàn khách tự nhập); hạng mục khác = giá gói. Kế hoạch chưa có số khách: tiệc tạm tính theo `min_tables` và ghi rõ giả định (`assumption`); gói không ghi tối thiểu thì `total = null`.
- **Ngân sách hạng mục** (`budget`): giới hạn của hàm phân bổ ([weddings.md](weddings.md) mục 7): `shareLimit` của dịch vụ, Mục tiêu (`limit`) của tiệc chưa chọn, hoặc chi phí đang chọn nếu hạng mục đã chọn. Hạng mục chưa nằm trong kế hoạch vẫn được tính thêm. Kế hoạch chưa có tổng ngân sách: `null`, bỏ dòng "So với ngân sách".
- **Gói mặc định**: gói rẻ nhất có tổng chi phí ≤ ngân sách hạng mục; không có thì gói rẻ nhất (theo tổng chi phí). Dropdown xếp theo tổng chi phí tăng dần.
- **Thứ tự dòng** (FE): Chọn gói; Tổng chi phí ước tính (kèm `formula`); So với ngân sách hạng mục ("Còn dư X" / "Vừa đủ (còn 0đ)" / "Vượt X"); Số bàn tính phí (chỉ tiệc; cảnh báo khi tối thiểu > dự kiến, ghi chênh lệch); Vị trí; Sức chứa (chỉ tiệc); Đánh giá; Bao gồm (kèm "Xem chi tiết"); Nút.
- **Vị trí**: "Cùng {phường/xã} với địa điểm tổ chức" hoặc "Khác khu vực ({phường/xã})", chỉ so khi cả nơi tổ chức và NCC đều xác định được phường/xã chính thức. Khách chưa chọn nơi tổ chức: ẩn dòng (`rows.location = false`).
- **Bao gồm**: 3–4 ý: thẻ của gói trước ("Phong cách …", dữ liệu có cấu trúc), rồi cụm ngắn từ mô tả; bỏ cụm dài hơn 60 ký tự, cụm nhắc tên NCC / tên gói, giá, sức chứa, điều chỉnh, lịch.
- **Nhãn theo dòng**, chỉ khi các bên khác nhau (hòa thì không gắn): `cheapest` "Chi phí thấp nhất" (theo tổng chi phí); `largestCapacity` "Sức chứa lớn nhất" (chỉ tiệc); `topRated` "Điểm cao nhất" (chỉ khi mọi bên có ít nhất `MIN_REVIEWS` = 3 lượt).
- **Dòng tóm tắt** (`summary`, BE ghép, không khuyên chọn): "{A} rẻ hơn {B} Xđ." (A rẻ nhất duy nhất); "{B} có sức chứa lớn hơn {C} Y khách." (chỉ tiệc, mọi bên đủ chỗ, chênh ≥ `CAPACITY_NOTABLE_GAP` = 50); "{A} cùng khu vực với địa điểm tổ chức." (chỉ khi có bên cùng, có bên khác); "{B} vượt ngân sách hạng mục Zđ." (chỉ khi có bên vượt, có bên không). Không có khác biệt: mảng rỗng, FE ẩn dòng.
- **Gói tiệc không đủ chỗ** (sức chứa < số khách): cảnh báo ở dòng Sức chứa, `canAdd = false` kèm `blockReason`; FE khóa nút "Thêm vào kế hoạch". Nút "Thêm vào kế hoạch" thêm NCC ở trạng thái "Dự kiến", không bắt chọn gói.
- Tiền định dạng đầy đủ dấu chấm (232.000.000đ), không dùng "tr"/"triệu"; dùng thống nhất từ "bàn".

## Cần chốt

1. Tên tham số theo database.md (`serviceIds` hay `vendorIds`).
