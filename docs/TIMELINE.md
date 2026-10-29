# Timeline cưới (phía khách)

Tài liệu quy tắc đã chốt cho timeline. Mã nguồn: `backend/src/modules/weddings/` (`timeline-templates.ts`, `timeline-schedule.ts`, `timeline-rows.ts`, `timeline-hooks.ts`, `timeline.service.ts`) và `frontend/src/features/weddings/components/Timeline*.tsx`. Nguồn chuẩn về danh sách việc và ngày: sheet "Ví dụ 90 ngày" của `docs/timeline/WebPlan_Timeline_ban_gon (2).xlsx`.

## 1. Mẫu việc

Mẫu nằm trong code (`TIMELINE_TEMPLATES`, 62 việc), không lưu bảng CSDL. Mỗi mẫu có `code`, `service` (null = việc chung), `kind`, mốc `anchor` (W/E/D/S) và `offset` ngày.

| kind | Ý nghĩa | Lớp |
|---|---|---|
| SELF | Tự làm | Khung |
| CHOOSE | Chọn NCC (lọc, hỏi giá, đi xem, thử để đánh giá). Chỉ việc ĐẦU TIÊN của dịch vụ (cờ `showSuggest` trong mẫu) có nút "Gợi ý {dịch vụ} →" | Khung |
| BOOK | Mốc chốt (mã `*_BOOK`): tự xong khi đặt cọc | Khung |
| DETAIL / EVENT / PAYMENT | Việc chi tiết, ngày thực hiện, thanh toán phần còn lại: chỉ sinh sau khi đặt cọc | Chi tiết |

Sáu hạng mục: nhà hàng (Trung tâm tổ chức sự kiện), chụp ảnh (gồm quay phim), trang phục, trang trí (decor), trang điểm (makeup), hoa cưới. Loại việc, `needsMeeting` (nút "Hẹn với NCC") và nguồn sinh suy ra từ `task_code` qua mẫu; `task_code` rỗng là việc khách tự thêm.

## 2. Công thức ngày

Ký hiệu: W ngày cưới, I hôm nay (giờ VN), L = W − I, L1 = L − 1, d số ngày trước W theo mẫu, D ngày đặt cọc, E ngày thực hiện của đơn, S ngày chụp album, k = 2 (nhà hàng, chụp ảnh, decor, hoa cưới) hoặc 3 (trang phục, makeup). **Ngày là HẠN (muộn nhất)**.

**Việc khung** (Tự làm, Chọn NCC, Mốc chốt):
- Mức: L > 270 Cưới xa; 81–270 Bình thường; 21–80 Gấp; ≤ 20 Rất gấp; ngày cưới ≤ hôm nay thì chặn.
- L1 ≥ 270: không ép. Ngược lại K = min(60, max(⌊L1/2⌋, L1 − 20)); d ≤ K giữ nguyên, d > K thì d' = round(K + (d − K) × (L1 − K) / (270 − K)). W−3, W+7, W+30 không bao giờ ép.
- Dời cuối tuần (chỉ việc đi gặp / thử): **chỉ lùi** về T7/CN gần nhất trước hạn; bị chặn (trước I+1, trước D+k, trước hoặc trùng việc trước cùng dịch vụ) thì giữ ngày thường.
- Chọn NCC cùng dịch vụ cách nhau ≥ 1 ngày; Mốc chốt sau Chọn NCC cuối ≥ 1 ngày; không việc nào trước I+1.
- Cờ "· Gấp": việc bị kẹp về I+1 / không xếp được, hoặc (mức Gấp / Rất gấp VÀ bị ép > 50%). Mức Bình thường trở lên không có "Gấp". Việc quá hạn chỉ tô đỏ chữ "Hạn".

**Việc chi tiết** (khi đơn Deposited, dùng D = ngày cọc thật, E = ngày thực hiện thật của đơn):
- Các việc dạng E − x co theo hệ số min(1, (E − (D + k)) / x_max); không có chỗ (E − (D + k) ≤ 0) thì mọi việc trước sự kiện = max(I + 1, D + 1) và gắn cờ gấp.
- D + 2, S ± n, W − 7, E (ngày thực hiện), E + 2; Thanh toán: Hạn E + 7.
- S mặc định = D(chụp) + 23, không muộn hơn W − 35, không sớm hơn D + 2; việc neo theo S hiện "· Tạm tính" cho tới khi khách chốt Ngày hẹn.

Kiểm chứng: 62 dòng sheet ví dụ (có kỳ vọng cập nhật theo luật chỉ lùi) và các L = 400, 180, 91, 45, 20, 7 trong `backend/test/timeline-schedule.test.ts`.

## 3. Vòng đời

1. **Tạo / sửa thông tin đám cưới** (`PUT /weddings/me`): sinh việc khung theo W và I = hôm nay. Chỉ thêm mã chưa có, không bao giờ dời việc đã sinh.
2. **Đặt cọc** (`onOrderDeposited`, cả đường simulate và VNPay): Mốc chốt của dịch vụ xong; sinh việc chi tiết của đơn. Dịch vụ cọc trước giữ nguyên ngày; dịch vụ cọc sau chỉ thêm việc của nó.
3. **Hủy đơn đã cọc** (NCC, `POST /vendors/me/orders/:id/cancel`; `onOrderCancelled`):
   - Gỡ MỌI việc chi tiết gắn với đơn, kể cả việc đã xong. Dịch vụ khác không đổi.
   - Còn đơn khác cùng hạng mục đã cọc / hoàn thành: Mốc chốt vẫn xong; đơn Deposited cọc mới nhất nhận lại việc chi tiết (chỉ còn đơn Completed thì không sinh lại).
   - Không còn đơn nào: Mốc chốt về Todo, nhóm quay lại trạng thái khóa ("N việc chi tiết mở sau khi bạn đặt cọc").
   - Thẻ Mốc chốt đang Todo hiện thêm "Đơn {mã} với {NCC} đã hủy ngày d/m" (đơn ĐÃ CỌC bị hủy gần nhất cùng hạng mục) và nút "Gợi ý {dịch vụ} →"; cọc đơn mới thì dòng này mất.
   - Khách nhận thông báo `OrderCancelled`: "Đơn {mã} đã bị nhà cung cấp hủy. Lý do: … Các việc chi tiết của dịch vụ {dịch vụ} đã được gỡ khỏi timeline."
4. **Cọc lại đơn mới**: sinh lại việc chi tiết theo D, E mới.
5. **Mỗi hạng mục tối đa MỘT đơn Deposited cùng lúc** (luật đơn hàng, `409 CATEGORY_ALREADY_DEPOSITED` khi khách cọc đơn thứ hai hoặc NCC gửi / tạo lại đơn): nhờ vậy mỗi hạng mục chỉ có một bộ việc chi tiết. Dữ liệu cũ (trước khi có luật) có thể còn hai đơn Deposited cùng hạng mục; `timeline_tasks` chỉ cho một dòng mỗi mã trong một đám cưới (UNIQUE `wedding_id, task_code`), nên khi đó đơn cọc MỚI NHẤT giữ việc chi tiết: việc chưa xong của đơn cũ bị thay, việc đã xong giữ nguyên.
6. **Đổi ngày cưới**: xem trước `POST /weddings/me/timeline/regenerate-preview { weddingDate }` (việc đổi hạn cũ → mới, cảnh báo đơn có ngày thực hiện khác ngày cưới mới). Xác nhận thì `PUT /weddings/me` lưu ngày cưới và cập nhật hạn trong một transaction. Chỉ tính lại việc khung Todo chưa gắn đơn và việc tạm tính theo S còn Todo; việc đã xong, việc chi tiết của dịch vụ đã cọc và việc khách tự thêm giữ nguyên.

## 4. API

`GET /weddings/me/timeline` trả `{ items, level, daysLeft }`. Mỗi việc: `kind` (TASK, CHOOSE, CATEGORY_DEADLINE, SERVICE_TASK), `dueDate`, `isDone`, `isCustom`, `category`, `serviceId`, `urgent`, `tentative`, `needsMeeting`, `appointmentDate` (luôn null cho tới khi có cột), `orderCode` (SERVICE_TASK), `detailCount` và `cancelledOrder` (CATEGORY_DEADLINE đang Todo). `PATCH /weddings/me/timeline/items/:id` đổi `isDone` / `dueDate` / `title` (tên chỉ đổi được với việc tự thêm). Việc từ mẫu không xóa được.

## 5. Giao diện

Hai cách xem, chọn bằng sub tab dùng chung `frontend/src/components/SegmentedTabs.tsx` (2 ô chia đều trong khung bo tròn; ô đang chọn nền xanh nhạt, chữ xanh in hoa; dòng phụ "{n} việc" theo bộ lọc / "{m} dịch vụ"). Mặc định THEO THỜI GIAN, nhớ lựa chọn trong `localStorage` (`weddy.timeline.view`). Hai cách dùng chung dữ liệu, bộ lọc Chưa xong / Đã xong / Tất cả, hộp xác nhận hoàn thành và các nút.
- **THEO THỜI GIAN:** danh sách phẳng mọi việc (khung, việc chi tiết của mọi dịch vụ đã cọc, việc tự thêm), sắp theo Hạn tăng dần, cùng hạn giữ thứ tự mẫu. Chia nhóm theo tháng ("Tháng m/yyyy" + "{n} việc"); việc chưa xong có hạn trước hôm nay gom vào nhóm "Quá hạn" trên cùng. Việc chi tiết thêm tên dịch vụ ở dòng hạn ("Hạn: d/m · Nhà hàng"). Mốc chốt là thẻ thường, không xổ xuống: đã cọc hiện "✓ Đã chốt · {NCC}", chưa cọc hiện dòng ổ khóa "N việc chi tiết mở sau khi bạn đặt cọc". Logic nhóm: `features/weddings/timelineGroups.ts`.
- **THEO DỊCH VỤ:** Mốc chốt đã cọc là thẻ nhóm xổ xuống việc con (tiến độ, "Tiếp theo: …").
- **Ngày không đổi giữa hai cách xem và giữa các dịch vụ:** việc của các dịch vụ khác nhau được trùng ngày, không tự dàn lại; dịch vụ cọc sau không bao giờ làm đổi ngày việc của dịch vụ đã cọc trước (test cọc đủ 6 dịch vụ ở 6 thời điểm trong `backend/test/timeline-rows.test.ts`).

Thẻ trắng bo góc, ô tick tròn; bấm thẻ hoặc ô tick mở hộp "Xác nhận hoàn thành" (Hoàn tác 5 giây).

Nút trên thẻ (backend trả cờ `suggest`, `needsMeeting`):
- **"Gợi ý {dịch vụ} →"** (sang trang dịch vụ lọc đúng lĩnh vực, `/?category=slug`): CHỈ ở việc Chọn NCC đầu tiên của mỗi dịch vụ ("Lọc và hỏi giá 3–5 nhà hàng", "Lọc và hỏi giá 3–5 studio…", "Quyết định thuê hay may đo…", "Lọc và hỏi giá đơn vị decor…", "Lọc và hỏi giá chuyên viên makeup…", "Lọc tiệm hoa…"), xác định bằng cờ `showSuggest` trong `timeline-templates.ts`, không suy theo tên việc. Việc đó tick xong thì nút vẫn ở trên thẻ đó trong tab Đã xong. Các việc Chọn NCC còn lại (đi xem, thử, đánh giá) và Mốc chốt không có nút; ngoại lệ: Mốc chốt đang Todo có dòng "Đơn {mã} với {NCC} đã hủy ngày …" thì có nút để tìm NCC khác. Không còn nút "Nhắn NCC đang trao đổi".
- **"Hẹn với NCC"**: chỉ 8 việc chi tiết cần trao đổi với NCC (Xác nhận sảnh, khung giờ; Thử món; Chốt concept, lịch chụp album; Đo số đo, chốt mẫu; Thử đồ lần 1; Thử lần cuối; Makeup thử chính thức; Duyệt phối cảnh). Mở đúng hội thoại với NCC của đơn, câu nhắn điền sẵn, chưa tự gửi. Mốc chốt không tick tay. Mốc chốt đã cọc là thẻ nhóm chứa việc chi tiết (xổ / thu, nhớ trong phiên). Bộ lọc Chưa xong / Đã xong / Tất cả, `?category=` lọc theo hạng mục. Ảnh mẫu: `docs/prototype/timeline/`.

## 6. Dữ liệu và công cụ

- `npm run timelines:rebuild [-- --apply]` (backend): dựng lại timeline mọi đám cưới theo mẫu mới; mặc định DRY-RUN, `--apply` sao lưu dòng sẽ xóa vào `backend/scripts/backup/` (không commit).
- `npm run timelines:repair [-- --apply]`: sinh bù việc chi tiết cho đơn đã cọc đang thiếu (xem mục 3.5).
- `npm run timelines:restore -- <file sao lưu> [--apply]`: khôi phục từ bản sao lưu.
- Chưa có: cột `appointment_date` (`backend/prisma/sql/2026-10-29-timeline-appointment-date.sql`, chưa chạy) cho Ngày hẹn; kiểm tra ngày thực hiện của đơn không sau ngày cưới (đơn nhập ngày 2222 sẽ kéo cả bộ việc chi tiết tới 2222).
