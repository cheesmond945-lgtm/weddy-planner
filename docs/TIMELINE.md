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

`GET /weddings/me/timeline` trả `{ items, level, daysLeft }`. Mỗi việc: `kind` (TASK, CHOOSE, CATEGORY_DEADLINE, SERVICE_TASK), `dueDate`, `isDone`, `isCustom`, `category`, `serviceId`, `urgent`, `tentative`, `needsMeeting`, `appointmentDate` (luôn null cho tới khi có cột), `orderCode` (SERVICE_TASK), `detailCount` và `cancelledOrder` (CATEGORY_DEADLINE đang Todo). `PATCH /weddings/me/timeline/items/:id` đổi `isDone` / `dueDate` / `title` (tên chỉ đổi được với việc tự thêm). Việc từ mẫu không xóa được. Việc chi tiết do NCC làm (`owner` = `VENDOR`) khách không tick được: xem mục 8.

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
- Chưa có: cột `appointment_date` (`backend/prisma/sql/2026-10-29-timeline-appointment-date.sql`, chưa chạy) cho Ngày hẹn.

## 7. Quy tắc kiểm tra ngày

Nguyên tắc: **ngày cưới W là mốc duy nhất của một đám cưới; ngày thực hiện E của mọi đơn phải bám theo W.** Trước đây E chỉ bị chặn khi ở quá khứ nên đơn nhập 2027 hay 2222 vẫn nhận, kéo cả bộ việc chi tiết ra ngoài đám cưới. Mã nguồn: `backend/src/modules/orders/order-rules.ts` (`weddingDateIssue`), `backend/src/modules/weddings/timeline-rules.ts`, `timeline-hooks.ts`, `timeline.service.ts`.

### 7.1 Ngày thực hiện của đơn (NCC) — chặn

| # | Quy tắc | Lỗi |
|---|---|---|
| A1 | `E ≤ W` khi NCC Gửi, Cập nhật, Tạo lại hoặc Chỉnh sửa sau cọc. Chỉnh sửa sau cọc mà giữ nguyên ngày đang có (đơn cũ lệch ngày) thì qua, để vẫn sửa được hạng mục / ghi chú. Cập nhật đơn chưa cọc không được miễn. Lưu nháp không kiểm | `422 EVENT_DATE_AFTER_WEDDING` |
| A2 | Ngày cưới của khách phải còn ở phía sau (`W > hôm nay`) khi Gửi / Cập nhật đơn. Chỉnh sửa sau cọc không xét | `409 WEDDING_DATE_PASSED` |
| A3 | Kiểm lại lúc khách **đặt cọc**: khách có thể đổi W sau khi đơn đã gửi, hoặc đơn cũ đã lệch. Chặn trước khi chuyển tiền; hướng dẫn "Yêu cầu chỉnh sửa → Đổi ngày thực hiện". Cổng thanh toán đã báo thành công (IPN) thì vẫn ghi nhận cọc (tiền đã thu), timeline xử lý ở 7.2 | `409 EVENT_DATE_AFTER_WEDDING` |

Giao diện: form đơn của NCC điền sẵn E = W, hiện "Ngày cưới của khách", ô ngày có `max` = W. Thẻ đơn của khách báo "Khác ngày cưới của bạn" / "Sau ngày cưới của bạn" kèm cách xử lý.

### 7.2 Sinh và đóng việc chi tiết

- **B1** `syncOrderDetails` không sinh việc chi tiết khi `E > W` (ghi log cảnh báo), không tự kẹp E về W vì sẽ che sự thật. Mốc chốt vẫn xong khi cọc.
- **B2** Đơn → Hoàn thành (NCC bấm hoặc tự hoàn thành sau E+7): việc chi tiết còn Todo của đơn tự thành Done. Không còn việc "quá hạn" của dịch vụ đã làm xong.
- **B3** NCC Sửa đơn đã cọc đổi E: việc chi tiết neo theo E còn Todo bị xóa rồi sinh lại theo E mới (`onOrderEventDateChanged`); việc đã xong và việc neo D / S / W giữ nguyên.
- Mỗi hạng mục tối đa một đơn Deposited (mục 3.5) giữ nguyên.

### 7.3 Đổi ngày cưới

`regenerate-preview` trả thêm đơn lệch (xem `warnings[]`: `kind` = `DIFFERENT` | `AFTER_WEDDING`, `blocksDeposit`):
- Đơn đã cọc: khác W mới thì nhắc (`DIFFERENT`), sau W mới thì `AFTER_WEDDING`.
- Đơn `Pending` / `NeedRevision` có E sau W mới: `AFTER_WEDDING` + `blocksDeposit` (khách chưa cọc được cho tới khi NCC đổi ngày, mục A3).
- Việc đổi ngày cưới **không bị chặn** (quyền của khách). Sau khi lưu, NCC có đơn `AFTER_WEDDING` nhận thông báo `WeddingDateChanged` để cập nhật đơn.

### 7.4 Khách tự đổi hạn việc (`PATCH` / `POST` timeline)

Khoảng hạn theo loại việc (`dueBounds`):

| Loại việc | Hạn hợp lệ |
|---|---|
| Khách tự thêm, mã lạ; Tự làm, Chọn NCC, Mốc chốt; việc chi tiết neo D hoặc S | `hôm nay ≤ hạn ≤ W` (gồm đúng ngày cưới) |
| Việc chi tiết neo E trước sự kiện (E − n) | `hôm nay ≤ hạn ≤ E` của đơn |
| "Ngày thực hiện" (EVENT, mốc E hoặc W) | Cố định theo đơn / ngày cưới, không đổi tay (`TIMELINE_ITEM_READONLY`) |
| Việc sau sự kiện (mốc W + n hoặc E + n: cảm ơn, nhận ảnh, thanh toán, trả đồ) | `max(hôm nay, mốc) ≤ hạn ≤ mốc + 365 ngày` |

Thứ tự trong một hạng mục (`sequenceIssue`): việc Chọn NCC phải trước hoặc **cùng ngày** Mốc chốt; Mốc chốt không trước việc Chọn NCC cuối. Mốc chốt đã xong thì không ràng buộc (`400 DUE_DATE_ORDER`).

### 7.5 Dữ liệu cũ

Luật mới chỉ áp cho lần Gửi / Sửa / Cọc tiếp theo; đơn cũ không tự sửa. Ba loại dữ liệu cũ có thể còn: đơn còn hiệu lực có E sau W (cần người xử lý: hủy hoặc để hết hạn đơn, nhắn NCC đổi ngày), việc chi tiết còn gắn đơn Cancelled / Expired / Draft, và đơn Completed còn việc chi tiết Todo (việc đã quá hạn nhưng dịch vụ đã làm xong). Đơn Hoàn thành từ nay tự đóng việc chi tiết (mục 7.2 B2).

### 7.6 API: trường mới

`GET /weddings/me/timeline`: việc SERVICE_TASK có `orderEventDate` và `dateConflict` (E sau W; thẻ nhóm hiện chú thích). Đơn (`Order`): `weddingDate`. Hội thoại NCC: `customer.weddingDate`.

## 8. Tiến độ đơn: chủ việc, nhắc hạn, việc quá hạn

Việc chi tiết (SERVICE_TASK) gắn với đơn đã cọc là **bảng việc dùng chung** của khách và NCC: một dòng `timeline_tasks`, hai bên cùng đọc. Trước đây chỉ khách ghi được nên NCC không có chỗ xem hay cập nhật. Mã nguồn: `backend/src/modules/weddings/task-owner.ts` (luật thuần), `orders/order-tasks.service.ts` (API NCC), `orders/order-reminders.ts` (nhắc hạn). Không đổi schema: chủ việc suy ra từ `task_code` qua mẫu.

### 8.1 Chủ việc và quyền

| Chủ | Việc | Khách | NCC |
|---|---|---|---|
| `CUSTOMER` | Gửi concept decor, chọn ảnh, duyệt ảnh, chọn kiểu hoa, trả đồ thuê, **mọi "Thanh toán phần còn lại"** | tick, đổi hạn | chỉ xem |
| `VENDOR` | Ngày thực hiện (setup decor, makeup, tiệc, chụp album, chụp ngày cưới) | chỉ xem | tick |
| `BOTH` | Thử món, chốt thực đơn, duyệt phối cảnh, thử đồ, nhận đồ, chốt chi tiết tiệc, "Nhận hoa, kiểm tra độ tươi", nhận ảnh phóng sự… | tick | tick |

Mã lạ hoặc việc không thuộc mẫu (timeline cũ): `BOTH` để không khóa nhầm. Vi phạm: `403 TIMELINE_ITEM_READONLY` (khách tick việc `VENDOR`, NCC tick việc `CUSTOMER`). NCC chỉ thấy việc gắn với **đơn của mình**, không thấy việc cá nhân của khách (đăng ký kết hôn, mua nhẫn…). NCC chỉ cập nhật khi đơn đang `Deposited`; đơn `Completed` thì Tiến độ đơn chỉ đọc (việc đã được đóng, mục 7.2 B2).

NCC tick xong một việc: khách nhận thông báo `TaskUpdated` ("{NCC} đã hoàn thành việc …"). Bỏ tick thì không thông báo. Mọi lần đổi việc gắn đơn (NCC tick / bỏ tick, khách tick / đổi hạn) đều đẩy sự kiện realtime `task` cho bên kia, không tạo thông báo: timeline của khách, Lịch làm việc và Tiến độ đơn của NCC đổi ngay.

### 8.2 Nhắc hạn

Hai nhóm việc, hai cách nhắc:

**1. Việc chi tiết của đơn đã cọc** (`Todo`, đơn `Deposited`): mỗi việc một thông báo cho đúng chủ việc.

| Giai đoạn | Điều kiện | Loại |
|---|---|---|
| Sắp đến hạn | hạn từ hôm nay đến hôm nay + 2 ngày | `TaskDueSoon` |
| Quá hạn | trễ 1 đến 14 ngày (trễ hơn là dữ liệu cũ, không nhắc dồn) | `TaskOverdue` |

Người nhận: chủ việc (`BOTH` thì cả hai). Mỗi (người nhận, việc, loại, hạn) chỉ một thông báo (đổi hạn thì nhắc lại theo hạn mới).

**2. Việc không gắn đơn của khách** (việc khung: thiệp, nhẫn, chọn NCC, Mốc chốt; việc tự thêm): một thông báo tổng hợp `TaskDigest` ("Bạn có 2 việc sắp đến hạn và 1 việc quá hạn trên timeline: …", tối đa 3 tên việc, còn lại "và N việc khác") **mỗi khách mỗi ngày** (giờ VN). Gom thay vì mỗi việc một thông báo vì timeline gấp thường dồn nhiều việc vào cùng một vài ngày. NCC không nhận loại này.

**Khi nào được tạo.** Không cần bật job nền: (a) tài khoản **tải thông báo** của mình (chuông ở mọi trang) thì quét đơn của NCC đó / khách đó (tối đa mỗi 5 phút mỗi tài khoản, `OrderJobsService.sweepUser`); (b) NCC hoặc khách đọc đơn (cách 10 phút/phạm vi); (c) toàn hệ thống khi `ORDER_JOBS_ENABLED=true` (cùng job với hết hạn cọc). Vì vậy một bên mở trang là cả hai bên có thông báo; thông báo mới được đẩy realtime tới trang đang mở.

### 8.3 Chính sách việc quá hạn (bản mềm, chờ nhóm xác nhận)

- Việc quá hạn **không chặn đơn, không phạt tự động** (nhóm chưa có luật phạt hay hoa hồng gắn việc).
- Việc của NCC (`VENDOR`) trễ: NCC nhận `TaskOverdue`; **khách cũng nhận** "Nhà cung cấp chưa cập nhật việc …" và được hướng dẫn nhắn trong chat. Trên timeline khách hiện "NCC chưa cập nhật" (chữ đỏ).
- Việc của khách trễ: khách nhận nhắc; NCC không nhận thông báo, chỉ thấy "Chờ khách thực hiện" và "Quá hạn" ở Tiến độ đơn.
- Đơn bên NCC có việc của NCC (hoặc hai bên) trễ thì hiện nhãn **"Trễ tiến độ · N"** ở danh sách đơn, thẻ đơn trong chat.
- **Hạn cứng duy nhất là ngày thực hiện E.** NCC không thực hiện được thì dùng luồng hủy đơn "NCC không thể thực hiện" (hoàn cọc cho khách).

### 8.4 API

| Endpoint | Ý nghĩa |
|---|---|
| `GET /vendors/me/orders/:id/tasks` | `{ items: [{ id, title, dueDate, isDone, completedDate, owner, canTick, overdue }], progress }` |
| `PATCH /vendors/me/orders/:id/tasks/:taskId` | `{ isDone }`; việc của NCC / hai bên; `409 ORDER_NOT_ACTIVE` nếu đơn không phải `Deposited` |
| `GET /vendors/me/orders/progress` | `{ [orderId]: { open, overdueVendor, overdueCustomer, dueSoonVendor } }` cho đơn `Deposited` |
| `GET /weddings/me/timeline` | SERVICE_TASK có thêm `owner` (`CUSTOMER` / `VENDOR` / `BOTH`); việc khác `owner: null` |

Thông báo mới: `TaskUpdated` (gửi khách), `TaskDueSoon`, `TaskOverdue` (`referenceType: "TimelineTask"`, `referenceId` = id việc), `TaskDigest` (gửi khách, `referenceType: "Wedding"`).

### 8.5 Việc hiện gì trên giao diện

| Tình huống | Khách | NCC |
|---|---|---|
| Việc sắp đến hạn (còn 0 đến 2 ngày) | Nhãn "· Sắp đến hạn" trên thẻ việc; dải đầu trang "N việc sắp đến hạn" (bấm để lọc); thông báo ở chuông | Nhãn "· Sắp đến hạn" ở Tiến độ đơn; dải ở Lịch làm việc; nhãn "Sắp đến hạn · N" ở thẻ Theo đơn; thông báo ở chuông |
| Việc quá hạn | Chữ đỏ "Quá hạn"; dải "N việc quá hạn"; nhóm "Quá hạn" ở cách xem theo thời gian; thông báo ở chuông. Việc của NCC trễ: "NCC chưa cập nhật" (đỏ) và thông báo "Nhà cung cấp chưa cập nhật việc …" | Việc đỏ "Quá hạn"; nhãn "Trễ tiến độ · N" ở danh sách đơn, thẻ đơn trong chat, thẻ Theo đơn; dải đỏ ở Lịch làm việc; thông báo ở chuông (chỉ việc của NCC / hai bên) |

## 9. Chế độ xem Lịch

Danh sách việc có thêm cách xem **Lịch tháng** (kiểu Google Calendar, chỉ xem và chọn ngày, **không kéo thả**: hạn việc có luật khoảng ngày và thứ tự ở mục 7.4 nên đổi hạn vẫn đi qua các hộp thoại hiện có). Không thêm thư viện: lưới tháng tự tính ở `frontend/src/features/calendar/monthGrid.ts` (tuần bắt đầu thứ Hai, tính theo UTC), component dùng chung `CalendarMonth.tsx`.

- **Khách:** tab thứ ba **LỊCH** cạnh "Theo thời gian" / "Theo dịch vụ" ở `/timeline`, nhớ lựa chọn trong `localStorage` (`weddy.timeline.view` = `calendar`). Cùng bộ lọc Chưa xong / Đã xong / Tất cả và theo hạng mục. Mỗi việc nằm ở ngày Hạn; ngày cưới được đánh dấu. Bấm ngày để xem các việc của ngày đó bằng đúng thẻ việc của cách xem danh sách (hoàn thành, hẹn NCC, sửa đều như cũ). Có dải "N việc quá hạn" nhảy tới việc quá hạn sớm nhất.
- **NCC:** trang **Lịch làm việc** (`/vendor/calendar`, menu trái) gồm ngày thực hiện của các đơn Chờ cọc / Chờ chỉnh sửa / Đã cọc / Hoàn thành và việc chi tiết của đơn đã cọc. NCC có nhiều khách cùng lúc nên lịch có công cụ để biết việc nào của khách nào và không bị chồng chéo:
  - **Màu theo đơn.** Mỗi đơn một màu ổn định (`features/calendar/orderColors.ts`: đơn đang theo dõi (chờ cọc, chờ chỉnh sửa, đã cọc) được chia trước, rồi theo mã đơn `DH<yyMM><số>` (id là UUID ngẫu nhiên nên không dùng để sắp), nên tối đa 8 đơn đang theo dõi không trùng màu dù có nhiều đơn cũ và đơn mới không làm đổi màu đơn đang có; quá 8 thì quay vòng; không dùng đỏ và vàng vì dành cho trạng thái). Thẻ ghi tên khách ngắn ("Hùng & Chi: Chốt thực đơn"). Trạng thái hiện bằng dấu hiệu riêng, không chiếm màu: quá hạn có "!" và viền đỏ, đã xong gạch ngang và mờ.
  - **Ô đông việc** (hơn 3) gom theo khách thành thẻ "Hùng & Chi · 2", ô nào có việc quá hạn thì thẻ có "!"; thừa thì "+N khách khác".
  - **Lọc.** Chú giải là các nút bấm được, mỗi khách / đơn một nút (kèm 4 số cuối mã đơn và số việc trễ); bấm để chỉ xem khách đó, chọn nhiều được, "Bỏ lọc" để về tất cả. Thêm bộ lọc **Việc của tôi** ẩn các việc do khách làm.
  - **Danh sách của ngày gom theo khách**: mỗi khách một nhóm có tên đầy đủ, mã đơn. Ngày có từ hai đơn cùng thực hiện hiện nhắc "Có N đơn cùng thực hiện trong ngày này".
  - **Chế độ "Bảng việc"** (tab thứ hai): kanban kéo thả, xem mục 9.2.
  - **Chế độ "Lịch bận"** (chỉ Trung tâm tổ chức sự kiện): lịch bận theo từng sảnh, nguồn Đơn / Thủ công, xem [LICH_BAN_SANH.md](LICH_BAN_SANH.md).
  - **Chế độ "Theo đơn"** (tab thứ ba; tab đang chọn nhớ trong `localStorage` `weddy.vendor.calendar.view`): mỗi đơn đang theo dõi một thẻ có màu riêng: tên khách, trạng thái, nhãn "Trễ tiến độ" / "Sắp đến hạn", ngày thực hiện còn bao lâu, thanh tiến độ `đã xong / tổng`, việc tiếp theo của NCC (hoặc "Đang chờ khách thực hiện" / "Đã xong mọi việc"), và nút mở danh sách việc để tick ngay. Đơn có việc của NCC bị trễ lên trước, rồi theo ngày thực hiện gần nhất.
- **API:** `GET /vendors/me/orders/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` (tối đa 100 ngày, `400 VALIDATION_ERROR` nếu sai) trả `{ items }`: mốc `ORDER` (`orderId`, `orderCode`, `customerName`, `date`, `status`) và `TASK` (thêm `owner`, `canTick`, `overdue`). Việc "Ngày thực hiện" trùng đúng ngày thực hiện của đơn bị bỏ vì đã có mốc ORDER. Logic thuần: `backend/src/modules/weddings/calendar-items.ts`.

### 9.1 Tìm kiếm và lọc (cách xem THEO THỜI GIAN và LỊCH)

Thanh tìm kiếm và lọc nằm dưới thanh chuyển cách xem, lọc ngay trên máy (không gọi API), lưu trên URL (`?q=` `&month=` `&owner=` `&category=`) nên tải lại hoặc gửi link vẫn còn. Logic thuần: `frontend/src/features/weddings/timelineFilter.ts`. Cách xem THEO DỊCH VỤ không có thanh này (đã gom theo dịch vụ).

| Bộ lọc | Cách dùng |
|---|---|
| Từ khóa | Không cần gõ dấu ("dat coc" khớp "đặt cọc"). Tìm trong tên việc, dịch vụ, tên NCC, hạng mục, mã đơn và ngày hạn. Mỗi từ phải là **đầu của một từ** (nên "hang" không khớp "tháng"), đủ mọi từ, thứ tự tùy ý. Gõ ngày: "12/11". Gõ "tháng 12" để lấy việc có hạn trong tháng 12 |
| Tháng | Danh sách các tháng có việc kèm số việc; "Quá hạn" (chưa xong, hạn trước hôm nay) và "Sắp đến hạn" (chưa xong, còn 0 đến 2 ngày) lên đầu. Số đếm tính theo các bộ lọc khác nên khớp những gì sẽ thấy. Ẩn ở cách xem Lịch (đã có nút chuyển tháng) |
| Dịch vụ | Một hạng mục (nhà hàng, decor…); thay chip "Đang xem" trước đây |
| Người thực hiện | Mọi việc / Việc của tôi (bỏ việc chỉ NCC làm) / Việc do NCC làm (xem mục 8.1) |

Cùng bộ lọc trạng thái Chưa xong / Đã xong / Tất cả có sẵn; các bộ lọc kết hợp theo AND. Khi bộ lọc nào bật hiện "N việc phù hợp" và "Xóa bộ lọc". Cách xem Lịch: nếu tháng đang xem không có việc nào khớp thì có dải "Tháng này không có việc nào" kèm nút tới việc gần nhất.

### 9.2 Bảng việc của NCC (kanban kéo thả)

Tab **Bảng việc** ở Lịch làm việc (`/vendor/calendar`), giữa "Lịch tháng" và "Theo đơn". Dữ liệu: `GET /vendors/me/orders/tasks` (mọi việc chi tiết của đơn Đã cọc). Logic thuần: `frontend/src/features/vendorOrders/taskBoard.ts`; giao diện: `components/TaskBoard.tsx` (thư viện `@dnd-kit/core`).

| Cột | Việc | Kéo |
|---|---|---|
| Chờ khách làm | Việc của khách (`CUSTOMER`) chưa xong | Không (chỉ xem) |
| Cần làm | Việc của NCC / hai bên chưa xong, theo hạn tăng dần | Sang Đã xong = đánh dấu xong |
| Đã xong | Mọi việc đã xong, xong gần nhất trước | Việc của NCC / hai bên kéo về Cần làm = mở lại |

- **Hàng (swimlane):** mặc định mỗi đơn một hàng (tên khách, mã đơn, ngày thực hiện, "đã xong / tổng", nhãn "Trễ tiến độ · N"), đơn có việc của NCC trễ lên trước rồi theo ngày thực hiện gần nhất; thu / mở từng hàng. "Không gom" cho một hàng chung, thẻ ghi tên khách và mã đơn. Mỗi hạng mục của đám cưới chỉ có một đơn Đã cọc (mục 3.5) nên gom theo khách cũng là gom theo đơn. Lựa chọn nhớ trong `localStorage` (`weddy.vendor.board.group`).
- **Luật kéo thả:** chỉ việc NCC được tick, chỉ giữa Cần làm và Đã xong, không sang hàng khác; ô không thả được thì không sáng khi đang kéo. Thả xong thẻ đổi cột ngay rồi gọi `PATCH /vendors/me/orders/:id/tasks/:taskId`; lỗi (403 / 409) thì thẻ về chỗ cũ kèm thông báo. Khách thấy ngay (sự kiện realtime `task`) và nhận `TaskUpdated` khi việc xong.
- **Cách kéo:** chuột kéo ngay; cảm ứng nhấn giữ rồi kéo (để vẫn cuộn ngang được các cột); bàn phím Space / Enter nhấc, mũi tên di chuyển, Space / Enter thả, Esc hủy, có lời đọc tiếng Việt. Mỗi thẻ vẫn có ô tròn để tick không cần kéo.
- **Bộ lọc** dùng chung với Lịch tháng: chọn khách / đơn (chỉ hiện đơn Đã cọc), "Việc của tôi" ẩn cột Chờ khách làm và việc của khách.
- **Không có** cột "Đang làm" (trạng thái việc trong CSDL chỉ có Todo / Done, thêm cần đổi CHECK của `TimelineTasks.Status`) và không tự sắp thứ tự thẻ trong cột (`display_order` dùng chung với timeline của khách).

