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
        "tables": { "count": 35, "byMinimum": true, "text": "35 bàn, tối thiểu của gói", "warning": "Gói này yêu cầu đặt tối thiểu 35 bàn: chọn gói này bạn phải đặt ít nhất 35 bàn (nhiều hơn 5 bàn so với 30 bàn dự kiến). Không cần thêm bàn thì chọn gói khác" },
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
- **Mức gợi ý của hạng mục** (`budget`, từ 03/11/2026): giới hạn của hàm phân bổ tab Ngân sách ([weddings.md](weddings.md) mục 7) **tính như khi hạng mục chưa chọn NCC nào** (bỏ các NCC của hạng mục khỏi kế hoạch rồi phân bổ lại): tiền phân bổ (dịch vụ) hoặc giới hạn gói tiệc. Không dùng giá đơn đang có (trước đây tiệc đã cọc lấy giá đơn làm mốc nên mọi bên đều "Vượt"). Hạng mục chưa nằm trong kế hoạch vẫn được tính thêm. Kế hoạch chưa có tổng ngân sách: `null`, bỏ dòng "So với mức gợi ý".
- **Hệ quả** (`columns[].consequence`): `consequenceOf` của tab Ngân sách với chi phí của gói: "Chọn gói này thì còn X cho N dịch vụ chưa chọn" / "Chọn gói này thì ngân sách còn X" / "Chọn gói này thì vượt tổng ngân sách X" (`over: true`).
- **Lịch ngày cưới** (`columns[].availability`, chỉ khi kế hoạch có ngày cưới; hiện ngay dưới tên NCC): `FREE` "Còn trống ngày dd/mm", `FULL` "Đã kín ngày dd/mm", `UNCONFIRMED` "Chưa xác nhận ngày dd/mm". Tiệc: sảnh (gói) có đơn đã cọc / hoàn thành của khách khác hoặc NCC đánh dấu bận ([LICH_BAN_SANH.md](../LICH_BAN_SANH.md)) là `FULL`, lịch khả dụng NCC khai `BOOKED` cũng `FULL`, `HELD` là `UNCONFIRMED`, còn lại `FREE`; đơn của chính khách không làm sảnh kín. Hạng mục khác: theo lịch khả dụng ([availability.md](availability.md)): `AVAILABLE` → `FREE`, `BOOKED` → `FULL`, chưa khai / `HELD` → `UNCONFIRMED`. Bên `FULL`: FE làm mờ cột, không gắn nhãn / không đưa vào câu so giá, tóm tắt mở đầu "{NCC} đã kín ngày dd/mm.", khóa nút. Gói mặc định bỏ qua gói đã kín nếu NCC còn gói khác.
- **Đã có đơn với NCC**: tổng chi phí lấy theo giá đơn (cùng số với tab Ngân sách), `formula` = "Theo đơn đã cọc của bạn" / "Theo đơn nhà cung cấp gửi". Có bên là giá đơn thật thì **không so giá** (không câu "rẻ hơn", không nhãn "Chi phí thấp nhất"), vì giá đơn và giá niêm yết không so được.
- **NCC khách đã cọc**: gói trong đơn có lịch `MINE` "Đã giữ ngày dd/mm cho bạn"; cột `locked = true` (FE khóa ô chọn gói ở gói trong đơn, ghi cách đổi: nhắn NCC hoặc hủy đơn ở tab Dịch vụ). `comparison.lockNote` (một cảnh báo chung FE hiện ở đầu trang, kèm link tab Dịch vụ): "Bạn đã cọc {NCC} ngày dd/mm, nên chưa thêm được nhà cung cấp khác ở đây. Muốn đổi, hãy nhắn {NCC} hoặc hủy đơn ở tab Dịch vụ. Bảng dưới để tham khảo."; các cột bị khóa vì lý do này có `blockKind = LOCKED` và FE không lặp lý do dưới từng cột (`FULL` / `CAPACITY` vẫn ghi dưới nút của cột đó). Dòng hệ quả đổi tên `consequenceLabel` = "Nếu đổi nhà cung cấp": NCC đã cọc ghi "Hiện tại còn X …"; NCC khác chỉ ghi kết quả "Còn X cho N dịch vụ chưa chọn" / "Vượt tổng ngân sách X" (tiền cọc D tính vào khoản trừ, câu "có thể mất tiền cọc D, tùy chính sách nhà cung cấp" ghi một lần trong lockNote). Lý do khóa nút: "Bạn đã cọc {NCC}. Muốn đổi, hãy nhắn {NCC} hoặc hủy đơn ở tab Dịch vụ." (màu trung tính).
- **Làm tròn**: mọi số tiền hiển thị (tổng, mức gợi ý, chênh lệch, hệ quả, `budget`) làm tròn 10.000đ như tab Ngân sách; chênh lệch và số dư tính từ số đã làm tròn. `consequence.detail` ghi đủ phép tính, ví dụ "Tổng ngân sách 50.000.000đ − đã chọn ở hạng mục khác 6.500.000đ − hạng mục này 150.000.000đ − cọc có thể mất 2.000.000đ − chi phí khác 330.000đ = −108.830.000đ" (phần lẻ kiểu 29.166.667đ trước đây đến từ khoản chi phí khác 333.333đ khách tự nhập).
- **Khóa nút** (`canAdd = false`, `blockReason`): đã kín ngày cưới; khách đã cọc NCC khác cùng hạng mục ("Bạn đã cọc {NCC}, không đổi được ở đây."); gói tiệc không đủ chỗ.
- **Dòng gộp**: `budgetNote` khi mọi bên đều cao hơn mức gợi ý ("Cả 2 bên đều cao hơn mức gợi ý X: A cao hơn Y, B cao hơn Z."), FE hiện một dòng thay cho chữ từng cột; `sameNote` khi số bàn tính phí / sức chứa giống nhau ở mọi bên ("Giống nhau: 30 bàn, đủ cho 300 khách"), các dòng đó ẩn (`rows.tables` / `rows.capacity` = false).
- **Gói mặc định**: gói rẻ nhất có tổng chi phí ≤ ngân sách hạng mục; không có thì gói rẻ nhất (theo tổng chi phí). Dropdown xếp theo tổng chi phí tăng dần.
- **Thứ tự dòng** (FE): hàng đầu dính khi cuộn gồm tên NCC, lịch ngày cưới và nút (Thêm vào kế hoạch, Xem chi tiết); Chọn gói; Tổng chi phí ước tính (kèm `formula`); So với mức gợi ý ("Thấp hơn mức gợi ý X" / "Bằng mức gợi ý" / "Cao hơn mức gợi ý X", hoặc `budgetNote`); Nếu chọn gói này (`consequence`); Giống nhau (`sameNote`); Số bàn tính phí (chỉ tiệc; cảnh báo khi tối thiểu > dự kiến); Vị trí; Sức chứa (chỉ tiệc); Đánh giá; Điểm nổi bật.
- **Vị trí**: ô ghi phường/xã của NCC ("Đống Đa"), cùng nơi tổ chức thì "{phường/xã}, cùng khu vực nơi tổ chức"; nơi tổ chức ghi một lần dưới nhãn dòng (`comparison.locationNote` = "Nơi tổ chức: {phường/xã}"), chỉ so khi cả nơi tổ chức và NCC đều xác định được phường/xã chính thức. Khách chưa chọn nơi tổ chức: ẩn dòng (`rows.location = false`).
- **Điểm nổi bật** (trường `includes`, trước gọi "Bao gồm"): 3–4 ý: thẻ của gói trước ("Phong cách …", dữ liệu có cấu trúc), rồi cụm ngắn từ mô tả; bỏ cụm dài hơn 60 ký tự, cụm nhắc tên NCC / tên gói, giá, sức chứa, điều chỉnh, lịch.
- **Nhãn theo dòng**, chỉ khi các bên khác nhau (hòa thì không gắn): `cheapest` "Chi phí thấp nhất" (theo tổng chi phí); `largestCapacity` "Sức chứa lớn nhất" (chỉ tiệc); `topRated` "Điểm cao nhất" (chỉ khi mọi bên có ít nhất `MIN_REVIEWS` = 3 lượt).
- **Dòng tóm tắt** (`summary`, BE ghép, không khuyên chọn): "{A} rẻ hơn {B} Xđ." (A rẻ nhất duy nhất); "{B} có sức chứa lớn hơn {C} Y khách." (chỉ tiệc, mọi bên đủ chỗ, chênh ≥ `CAPACITY_NOTABLE_GAP` = 50); "{A} cùng khu vực với địa điểm tổ chức." (chỉ khi có bên cùng, có bên khác); bên đã kín ngày cưới: "{NCC} đã kín ngày dd/mm." (đứng đầu). Bỏ câu "vượt ngân sách hạng mục" (thay bằng dòng So với mức gợi ý / `budgetNote`). Không có khác biệt: mảng rỗng, FE ẩn dòng.
- **Gói tiệc không đủ chỗ** (sức chứa < số khách): cảnh báo ở dòng Sức chứa, `canAdd = false` kèm `blockReason`; FE khóa nút "Thêm vào kế hoạch". Nút "Thêm vào kế hoạch" thêm NCC ở trạng thái "Dự kiến", không bắt chọn gói.
- Tiền định dạng đầy đủ dấu chấm (232.000.000đ), không dùng "tr"/"triệu"; dùng thống nhất từ "bàn".

## Cần chốt

1. Tên tham số theo database.md (`serviceIds` hay `vendorIds`).
