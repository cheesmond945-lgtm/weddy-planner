# Lịch trình ngày cưới theo giờ

> **Tính năng đã bỏ (04/11/2026, nhóm quyết định).** Không còn giờ đón khách / làm lễ, khối "Lịch trình ngày cưới" của khách, khối "Giờ có mặt ngày cưới" trong chi tiết đơn của NCC, các API `GET /weddings/me/day-schedule`, `GET|PUT|DELETE /vendors/me/orders/:id/day-slot`, trường `mainTime` của `PUT /weddings/me` và hai thông báo `WeddingTimeChanged`, `DaySlotConfirmed`. Tài liệu bên dưới chỉ giữ để tham khảo, **không còn đúng**.
>
> **Cột CSDL không còn dùng (giữ nguyên, không xóa):** `weddings.main_time`; `orders.dayof_start_at`, `orders.dayof_end_at`, `orders.dayof_confirmed_at`. Còn dùng cho thẻ "Thời gian trong ngày cưới" của gói (chưa có quyết định bỏ): `service_packages.dayof_lead_minutes`, `dayof_duration_minutes`, `setup_open_time` (xem `PUT /vendors/me/packages/:id/day-plan`).

Trước đây cả hệ thống chỉ tính theo ngày: biết decor làm "ngày 20/10" nhưng không biết phải vào sảnh từ mấy giờ. Phần này thêm **giờ** cho ngày cưới:
khách nhập giờ đón khách / làm lễ, mỗi gói khai thời gian cần trong ngày cưới, hệ thống xếp giờ có mặt cho từng NCC và cảnh báo khi thiếu giờ
(ví dụ cưới 11:00 ngày 20/10, ngày 19/10 sảnh có tiệc khác nên decor chỉ vào được từ giờ sảnh mở sáng 20/10). NCC chốt giờ với khách cho từng đơn.

Logic thuần: `backend/src/modules/weddings/wedding-day.ts` (test: `backend/test/wedding-day.test.ts`); đọc CSDL: `wedding-day-store.ts`.

## 1. Đơn nào vào lịch trình

Đơn **Đã cọc / Hoàn thành** có ngày thực hiện **đúng ngày cưới**. Đơn làm ngày khác (vd chụp ảnh trước, thử váy) không vào lịch này;
chi tiết đơn phía NCC ghi rõ lý do. Đơn chờ cọc chưa tính.

## 2. Giờ có mặt của một đơn

Mốc là **giờ chính** của khách (`weddings.main_time`). Mọi giờ là giờ Việt Nam; có mặt có thể từ **tối hôm trước**.

| Nguồn | Khi nào | Giờ |
|---|---|---|
| Đã chốt | NCC bấm "Chốt giờ" trong chi tiết đơn | Giờ NCC chốt (`orders.dayof_start_at`, `dayof_end_at`) |
| Dự kiến theo gói | Gói của đơn có khai thời gian | Có mặt = giờ chính − "có mặt trước"; xong = có mặt + "làm trong". Đơn nhiều gói: có mặt sớm nhất, xong muộn nhất |
| Dự kiến theo lĩnh vực | Gói chưa khai | Bảng mặc định dưới |

Mặc định theo lĩnh vực (`DAY_DEFAULTS`):

| Lĩnh vực | Có mặt trước giờ chính | Làm trong | Phải xong trước giờ chính |
|---|---|---|---|
| Trang trí | 6 giờ | 5 giờ | Có |
| Trang điểm | 4 giờ | 3 giờ | Có |
| Trang phục | 5 giờ | 1 giờ | Có |
| Hoa cưới | 3 giờ | 1 giờ | Có |
| Nhà hàng / Trung tâm tiệc cưới | 3 giờ | 7 giờ | Không |
| Chụp ảnh | 3 giờ | 8 giờ | Không |

Khách chưa nhập giờ chính: chỉ đơn đã chốt có giờ, đơn khác ghi "Chưa có giờ".

## 3. Sảnh và cảnh báo

Sảnh là đơn của Nhà hàng / Trung tâm tiệc cưới trong cùng ngày cưới. Gói sảnh khai **giờ cho đơn vị khác vào setup** (`service_packages.setup_open_time`);
chưa khai thì coi như **06:00**. Hôm trước sảnh có bận không lấy từ [lịch bận theo sảnh](LICH_BAN_SANH.md) (đơn đã cọc hoặc bận thủ công ngày hôm trước).

| Cảnh báo | Điều kiện | Mức |
|---|---|---|
| Thiếu giờ vào sảnh | Đơn vị khác (không phải sảnh) cần có mặt trước giờ sảnh mở, và hôm trước sảnh **bận** | Lỗi (đỏ): "Sảnh chỉ cho vào từ 05:00 vì hôm trước có tiệc khác; cần có mặt 04:00 nên thiếu 1 giờ." |
| Cần vào sớm | Như trên nhưng hôm trước sảnh **trống** (hoặc không biết sảnh nào) | Nhắc (vàng): hỏi sảnh cho setup từ tối hôm trước |
| Xong sau giờ chính | Trang trí, trang điểm, trang phục, hoa xong sau giờ chính | Lỗi (đỏ) |

Cảnh báo chỉ để báo, không chặn chốt giờ.

## 4. Dữ liệu

SQL `backend/prisma/sql/2026-11-02-wedding-day-schedule.sql`, **đã chạy 02/11/2026** (nhóm đồng ý). Chỉ thêm cột, đều cho phép NULL, không sửa dữ liệu cũ.

| Cột | Ý nghĩa |
|---|---|
| `weddings.main_time` (time) | Giờ chính của ngày cưới |
| `service_packages.dayof_lead_minutes` (0..1440) | Có mặt trước giờ chính bao nhiêu phút; NULL dùng mặc định |
| `service_packages.dayof_duration_minutes` (15..1440) | Làm trong bao nhiêu phút; NULL dùng mặc định |
| `service_packages.setup_open_time` (time) | Chỉ gói sảnh: giờ đơn vị khác được vào setup |
| `orders.dayof_start_at`, `dayof_end_at`, `dayof_confirmed_at` (timestamptz) | Giờ NCC đã chốt; cả ba NULL là chưa chốt. CHECK end > start |

## 5. API

| Method + route | Body | Trả về |
|---|---|---|
| `PUT /weddings/me` | thêm `mainTime: "HH:mm" \| null` (không gửi thì giữ nguyên) | `Wedding` có `mainTime`. Đổi giờ chính thì NCC có đơn trong ngày cưới nhận thông báo `WeddingTimeChanged` |
| `GET /weddings/me/day-schedule` | | `{ date, mainTime, venue, slots[] }`; mỗi slot: NCC, lĩnh vực, `start` / `end` ("YYYY-MM-DDTHH:mm"), `source` (`CONFIRMED` \| `PACKAGE` \| `DEFAULT`), `issues[]` |
| `GET /vendors/me/orders/:id/day-slot` | | `{ applicable: false, reason, message }` hoặc khung của đơn, khung dự kiến, sảnh, các NCC khác (chỉ lĩnh vực và giờ, không lộ tên), `canEdit` |
| `PUT /vendors/me/orders/:id/day-slot` | `{ start, end }` "YYYY-MM-DDTHH:mm", từ 00:00 hôm trước đến hết ngày cưới, tối đa 24 giờ | như GET; khách nhận `DaySlotConfirmed`. 409 nếu đơn không đang thực hiện hoặc không đúng ngày cưới |
| `DELETE /vendors/me/orders/:id/day-slot` | | Bỏ chốt, về giờ dự kiến |
| `PUT /vendors/me/packages/:id/day-plan` | `{ leadMinutes, durationMinutes, setupOpenTime }` (null là bỏ khai) | Gói, có `dayPlan`. Không qua Admin duyệt, không đổi `updated_date` |

Chốt / bỏ chốt phát sự kiện realtime `task` nên timeline của khách tải lại ngay.

## 6. Giao diện

- **Khách:** form thông tin đám cưới có ô "Giờ đón khách / làm lễ" (không bắt buộc). Timeline có thẻ **Lịch trình ngày cưới** (dưới các dải nhắc), chỉ hiện khi có NCC làm đúng ngày cưới. **Mặc định thu gọn thành một dòng** ("Lịch trình ngày cưới · Đón khách 09:00 · 1 nhà cung cấp", kèm số cảnh báo), bấm "Xem" mới mở chi tiết:
  các khung giờ theo thứ tự, mốc giờ đón khách chen vào đúng chỗ, nhãn "Đã chốt" / "Dự kiến", cảnh báo. Chưa có giờ chính thì nhắc nhập.
- **NCC, chi tiết đơn:** mục **Giờ có mặt ngày cưới** (trên Tiến độ đơn): khung của đơn, nút Chốt giờ này / Đổi giờ… / Bỏ chốt, giờ sảnh mở, các đơn vị khác trong ngày.
  Hộp Đổi giờ chọn được có mặt từ hôm trước.
- **NCC, gói:** tab Công việc có thẻ **Thời gian trong ngày cưới** (có mặt trước, làm trong, gói sảnh thêm giờ cho vào setup) kèm ví dụ theo giờ đón khách 11:00.

## 7. Chưa làm (phần 2)

- Lịch bận sảnh theo **ca** (trưa / tối) thay vì cả ngày.
- Chặn một NCC nhận hai đám trùng giờ trong cùng ngày.
- Giờ có mặt trên Lịch làm việc / Bảng việc của NCC (hiện chỉ ở chi tiết đơn).
