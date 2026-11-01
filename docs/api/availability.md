# Lịch khả dụng theo gói

Dùng cho gói của mọi hạng mục. Khách nhập ngày trong chi tiết gói để xem gói đã được đặt chưa, kèm lịch tháng (khung chi tiết gói không còn nút "Chọn gói này cho kế hoạch"). Thẻ dịch vụ ở danh sách chỉ hiện trạng thái theo ngày cưới cho Trung tâm tiệc cưới (slug `nha-hang`). Cần chạy `backend/prisma/manual/2026-10-30-03-package-availability.sql`; chưa chạy thì mọi endpoint dưới đây trả 503 `DB_MIGRATION_PENDING` (FE ẩn phần lịch phía khách).

Trạng thái một ngày: `AVAILABLE` (Còn trống), `HELD` (Giữ chỗ), `BOOKED` (Đã kín), `UNKNOWN` (Chưa cập nhật, tức là không có dòng trong DB).

**Sảnh dùng chung.** Gói cùng NCC khai cùng tên sảnh (không phân biệt hoa thường) dùng chung lịch: một gói `BOOKED` thì cả nhóm `BOOKED` ngày đó, một gói `HELD` thì cả nhóm `HELD`. Nhờ vậy khách không thấy hai gói cùng "Còn trống" khi sảnh chỉ nhận được một tiệc. Quy tắc nằm ở `backend/src/modules/availability/availability-rules.ts`.

**Riêng tư.** API chỉ trả trạng thái theo ngày. Không lưu và không trả tên khách, đơn hay thông tin booking.

## Phía khách (không cần đăng nhập)

`GET /availability/services?ids=<id1,id2,…>&date=YYYY-MM-DD`: trạng thái từng gói đang bán trong một ngày, tối đa 60 dịch vụ. Dịch vụ không hiển thị thì không có trong `services`.

```json
{ "date": "2026-11-28", "services": { "<serviceId>": [{ "packageId": "…", "name": "Gold", "status": "AVAILABLE" }] } }
```

`GET /availability/packages/:packageId?month=YYYY-MM`: lịch tháng của một gói. Tháng nằm trong khoảng từ tháng trước đến 24 tháng tới, ngoài khoảng trả 400 `MONTH_OUT_OF_RANGE`.

```json
{ "packageId": "…", "month": "2026-11", "days": [{ "date": "2026-11-01", "status": "UNKNOWN" }] }
```

## Phía NCC (role Vendor)

- `GET /vendors/me/availability/packages/:id?month=YYYY-MM`: trả `{ packageId, month, resource, sharedWith[], lastUpdated, today, days[] }`. Mỗi phần tử của `days` gồm `{ date, status, own, blockedBy }`:
  - `status` là trạng thái khách thấy;
  - `own` là trạng thái NCC tự đặt;
  - `blockedBy` là tên gói cùng sảnh đang làm ngày đó kín hoặc giữ chỗ.
- `PUT /vendors/me/availability/packages/:id` với body `{ dates: string[], status }`: tối đa 62 ngày, không cho đặt ngày đã qua (400 `DATE_IN_PAST`). `status = UNKNOWN` là xóa, tức là về Chưa cập nhật. Trả `{ updated, status, conflicts[], sharedWith[] }`:
  - `conflicts` liệt kê ngày đặt Còn trống nhưng gói cùng sảnh đang kín hoặc giữ chỗ;
  - `sharedWith` liệt kê các gói cùng sảnh bị ảnh hưởng khi đặt Kín hoặc Giữ chỗ.
- `PUT /vendors/me/availability/packages/:id/resource` với body `{ name }`: khai tên sảnh. Tên rỗng hoặc null là gói dùng lịch riêng.
- `GET /vendors/me/availability/reminder`: trả `{ applicable, packages, lastUpdated, daysSinceUpdate, missingDays, windowDays, needsUpdate }`.
  - `missingDays` là số ngày trong 30 ngày tới còn gói chưa có trạng thái.
  - Nếu quá 7 ngày chưa cập nhật, endpoint tạo một thông báo `AvailabilityReminder` (`referenceType = 'Availability'`), tối đa một thông báo mỗi 7 ngày.

**Nhắc định kỳ toàn hệ thống.** Đặt `AVAILABILITY_REMINDER_ENABLED=true` thì backend quét mọi NCC đang hiển thị lúc khởi động và mỗi 6 giờ, rồi tạo thông báo theo cùng quy tắc trên. Mặc định tắt.

## Liên hệ nhà cung cấp

Nút "Liên hệ nhà cung cấp" trong chi tiết gói không cần endpoint riêng. FE soạn sẵn tin có ngày tổ chức, gói đang xem và trạng thái đang hiện, khách sửa được trước khi gửi. Sau đó FE dùng API chat có sẵn: `POST /conversations`, rồi `POST /conversations/:id/messages`.
