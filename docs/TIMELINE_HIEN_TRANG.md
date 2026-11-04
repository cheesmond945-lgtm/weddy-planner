# Hiện trạng Timeline (khảo sát trước khi đổi hướng)

> **Tài liệu cũ, có thể không còn đúng.** Viết ở một thời điểm trước các thay đổi ngày 04/11/2026 (hạn đợt 2, VietQR thay VNPay, tên Forever, trang Quản lý đơn hàng). Xem tài liệu hiện hành: `LUONG_CHAT_DON_HANG.md` (phần Cập nhật đầu file), `api/orders.md`, `api/THE_DON_HANG.md`.


Khảo sát ngày 01/11/2026 trên nhánh `Chanh` (sau commit `Merge main into Chanh`). Chỉ đọc code và `schema.prisma`: không chạy lệnh nào đụng CSDL, không sửa code. Mỗi ý kèm `file:dòng`.

Đường dẫn gọn: `BE` = `backend/src/modules`, `FE` = `frontend/src`.
Ký hiệu ngày (theo code): **W** ngày cưới, **I** hôm nay (giờ VN), **L = W − I**, **D** ngày đặt cọc, **E** ngày thực hiện của đơn (`orders.event_date`), **S** ngày chụp album.

> Ghi chú: đã có sẵn `docs/TIMELINE.md` (thiết kế) và `docs/timeline/HIEN_TRANG_TIMELINE.md` (hiện trạng viết 29/10). Báo cáo này viết lại từ code hiện tại, không sửa hai file đó.

---

## 1. Các file liên quan timeline

### Backend

| File | Làm gì |
|---|---|
| `BE/weddings/timeline-templates.ts` (141 dòng) | 62 mẫu việc trong code (`TIMELINE_TEMPLATES`), `MIN_AFTER_DEPOSIT`, `SERVICE_BY_CATEGORY_NAME` (tên danh mục → hạng mục), `suggestOf` (nút Gợi ý) |
| `BE/weddings/timeline-schedule.ts` (304) | Hàm thuần tính ngày: `levelOf`, `keepThreshold`, `planFrame`, `planDetails`, `defaultAlbumDate`, `newDetailTasks`, `replanAlbumTasks`, `replanOnWeddingDateChange` |
| `BE/weddings/timeline-rows.ts` (113) | Biến kế hoạch ngày thành dòng `timeline_tasks`: `frameRows`, `detailRows`, `depositDetailPlan`, `cancelPlan` (thuần) |
| `BE/weddings/timeline-hooks.ts` (203) | Nối với CSDL: `onWeddingCategories`, `syncOrderDetails`, `onOrderEventDateChanged`, `onOrderDeposited`, `onOrderCancelled`, `planWeddingDateChange`, `notifyVendorsOfWeddingDate` |
| `BE/weddings/timeline-rules.ts` (164) | Luật khi khách tự đổi hạn (`dueBounds`, `sequenceIssue`), cảnh báo đơn lệch khi đổi ngày cưới (`dateChangeIssue`...), `auditTimeline` |
| `BE/weddings/timeline.service.ts` (223) | `TimelineService`: `get`, `regeneratePreview`, `addTask`, `update`, `remove`; dựng `kind`, `owner`, `suggest`, `needsMeeting`... cho FE |
| `BE/weddings/task-owner.ts` (158) | `ownerOf` / `canTick` (ai làm việc), nhắc hạn, `orderProgress`, `taskDigest` |
| `BE/weddings/calendar-items.ts` | Gom ngày thực hiện đơn + việc chi tiết thành lịch NCC |
| `BE/weddings/weddings.controller.ts` + `weddings.service.ts` | Route timeline (`weddings/me/timeline/*`); `saveMine` (`weddings.service.ts:69-114`) sinh khung / đổi ngày cưới |
| `BE/orders/order-tasks.service.ts` (163) | API phía NCC: `list`, `progress`, `board`, `calendar`, `setDone` |
| `BE/orders/order-reminders.ts`, `order-jobs.service.ts` | Nhắc hạn việc chi tiết (đơn Deposited) và gom việc khung cho khách |
| `BE/orders/order-lifecycle.ts` | `completeOrder` đóng các việc chi tiết còn Todo (`:75`), `autoComplete` |
| `BE/orders/orders.service.ts` | Gọi hook: `:426` (cọc), `:678` (NCC sửa ngày thực hiện), `:774` (NCC hủy) |
| `backend/scripts/rebuild-timelines.ts`, `restore-timelines.ts`, `repair-order-details.ts` | Dựng lại / khôi phục / sửa timeline cho mọi đám cưới (npm `timelines:*`, mặc định dry-run) |
| `backend/prisma/sql/2026-10-29-timeline-appointment-date.sql` | Thêm cột `appointment_date`, **CHƯA CHẠY** |
| `backend/test/timeline-schedule.test.ts` (507), `timeline-rows.test.ts` (212) | Test; có "golden" so với sheet xlsx |
| `docs/timeline/WebPlan_Timeline_ban_gon (2).xlsx` | Nguồn chuẩn của mẫu (sheet "Ví dụ 90 ngày") |

### Frontend (phía khách)

| File | Làm gì |
|---|---|
| `FE/pages/couple/TimelinePage.tsx` | Chưa có thông tin đám cưới: form "Tạo timeline khung"; có rồi: `TimelineView` |
| `FE/features/weddings/components/TimelineView.tsx` (354) | Trang chính: hero, banner gấp / quá hạn, lọc, **3 cách xem** (`ViewMode = 'time' \| 'service' \| 'calendar'`: "Theo thời gian", "Theo dịch vụ", "Lịch"), gom việc con vào Mốc chốt, nút Hẹn NCC |
| `.../TimelineRow.tsx` (189) | `TimelineCard`: ô tick, hạn, nhãn (Quá hạn / Gấp / Tạm tính / NCC thực hiện / Hai bên), nút **Gợi ý** (`:148`, theo `item.suggest`) và **Hẹn với NCC** (`:156`, `needsMeeting`), `meetingDraft` |
| `.../TimelineGroupCard.tsx` (129) | Thẻ nhóm của Mốc chốt đã cọc, chứa việc chi tiết ("Đã xong x/N việc") |
| `.../TimelineConfirmDialogs.tsx` | **Dialog hoàn thành** (`CompleteTaskDialog`, "Chúc mừng bạn!") và `ReopenTaskDialog` |
| `.../TimelineDialogs.tsx` | `EditMilestoneDialog` (đổi hạn), `AddTaskDialog` (thêm việc tự thêm) |
| `.../WeddingDialogs.tsx` (`WeddingEditDialog`) + `DateChangePreviewDialog.tsx` | **Đổi ngày cưới**: gọi xem trước rồi xác nhận |
| `.../TimelineCalendar.tsx`, `TimelineFilters.tsx`, `TimelineHero.tsx` | Cách xem Lịch, bộ lọc (tìm, tháng, owner), đầu trang |
| `FE/features/weddings/timelineGroups.ts` (+ `.test.ts`), `timelineFilter.ts` | Gom theo thời gian, lọc (`matchesOwner`: mine / vendor) |
| `FE/features/weddings/hooks.ts` (`:51-83`), `FE/api/weddings.ts`, `FE/types/wedding.ts` (`:24-100`) | Hook, API, kiểu `TimelineItem` |
| `FE/features/weddings/planActions.tsx` | `openChat` dùng cho "Hẹn với NCC" |
| `FE/app/RealtimeBridge.tsx` (`:36`, `:59-66`, `:76-88`) | Sự kiện `task` / thông báo `Task*` làm tải lại timeline, lịch, bảng việc |

### Frontend (phía NCC) — xem mục 9

---

## 2. Cấu trúc mẫu hiện tại (`timeline-templates.ts`)

### 2.1 Trường của một mẫu (`:17-35`)

| Trường | Ý nghĩa |
|---|---|
| `order` | Thứ tự trong sheet, xếp việc cùng ngày |
| `code` | `task_code` (ví dụ `VENUE_BOOK`) |
| `title` | Tên việc (chữ cứng trong code) |
| `service` | `'nha-hang' \| 'chup-anh' \| 'trang-phuc' \| 'decor' \| 'makeup' \| 'hoa-cuoi' \| null` (null = việc chung) |
| `kind` | `SELF` tự làm, `CHOOSE` chọn NCC, `BOOK` mốc chốt (cọc), `DETAIL` việc chi tiết, `EVENT` ngày thực hiện, `PAYMENT` thanh toán phần còn lại |
| `anchor` + `offset` | Ngày = mốc + offset; mốc `W` / `E` / `D` / `S` |
| `weekendPreferred?` | Ưu tiên dời về T7/CN (chỉ lùi) |
| `needsMeeting?` | Có nút "Hẹn với NCC" (8 việc) |
| `showSuggest?` | Việc Chọn NCC đầu tiên của dịch vụ có nút "Gợi ý" (6 việc) |
| `noShrink?` | Không bị ép khi thời gian ngắn (`SELF_FINAL_CHECK`, `SELF_THANKS`, `PHOTO_FILES`) |

Phân loại: `isFrameKind` (`:115`) = SELF / CHOOSE / BOOK là **khung**; DETAIL / EVENT / PAYMENT là **chi tiết** (`isFrame` trong `timeline-schedule.ts:55`).

Các hằng đi kèm: `MIN_AFTER_DEPOSIT` (`:38-45`: nhà hàng 2, chụp ảnh 2, decor 2, trang phục 3, makeup 3, hoa 2 ngày kể từ D) và `FRAME_MAX_OFFSET = 270` (`:48`).

### 2.2 Số lượng (đếm bằng cách nạp file mẫu, không đụng CSDL)

**Tổng 62 việc = 28 khung + 34 chi tiết.**

| Dịch vụ | SELF | CHOOSE | BOOK | DETAIL | EVENT | PAYMENT | Khung | Chi tiết |
|---|---|---|---|---|---|---|---|---|
| (chung) | 11 | 0 | 0 | 0 | 0 | 0 | 11 | 0 |
| nha-hang | 0 | 2 | 1 | 4 | 1 | 1 | 3 | 6 |
| chup-anh | 0 | 2 | 1 | 5 | 2 | 1 | 3 | 8 |
| trang-phuc | 0 | 2 | 1 | 6 | 0 | 1 | 3 | 7 |
| decor | 0 | 2 | 1 | 3 | 1 | 1 | 3 | 5 |
| makeup | 0 | 2 | 1 | 2 | 1 | 1 | 3 | 4 |
| hoa-cuoi | 0 | 1 | 1 | 2 | 1 | 1 | 2 | 4 |
| **Cộng** | **11** | **11** | **6** | **22** | **6** | **6** | **28** | **34** |

Việc neo theo S (chụp album): `PHOTO_CONCEPT` (S−21), `ATTIRE_ALBUM_PICKUP` (S−1), `PHOTO_ALBUM_SHOOT` (S+0), `PHOTO_PICK_EDIT` (S+7), `PHOTO_REVIEW` (S+28).

### 2.3 Danh sách việc KHUNG (28 việc, nguyên văn)

| # | Code | Tên việc | Dịch vụ | Loại | Mốc |
|---|---|---|---|---|---|
| 1 | `SELF_FAMILY_ALIGN` | Thống nhất với hai gia đình: ngân sách, quy mô tiệc, giờ các lễ, tiệc tổ chức bên nào | chung | SELF | W−270 |
| 2 | `SELF_GUEST_DRAFT` | Lập danh sách khách sơ bộ, chọn phong cách và màu chủ đạo | chung | SELF | W−250 |
| 3 | `VENUE_SHORTLIST` | Lọc và hỏi giá 3–5 nhà hàng: lịch trống, giá mâm, phí sảnh, ưu đãi | nha-hang | CHOOSE (Gợi ý) | W−235 |
| 4 | `VENUE_TOUR` | Đi xem sảnh và ăn thử để đánh giá (sức chứa, sân khấu, bãi xe, chất lượng món) | nha-hang | CHOOSE (cuối tuần) | W−205 |
| 5 | `PHOTO_SHORTLIST` | Lọc và hỏi giá 3–5 studio chụp ảnh & quay phim: phong cách, các buổi cần (album, phóng sự, phim), lịch trống | chup-anh | CHOOSE (Gợi ý) | W−200 |
| 6 | `PHOTO_CONSULT` | Gặp tư vấn studio: xem album in thật, phim mẫu, trang phục chụp, hợp đồng mẫu | chup-anh | CHOOSE (cuối tuần) | W−185 |
| 7 | `VENUE_BOOK` | Chốt nhà hàng: so sánh, xác nhận đơn và đặt cọc | nha-hang | BOOK | W−180 |
| 8 | `PHOTO_BOOK` | Chốt chụp ảnh & quay phim: so sánh, xác nhận đơn và đặt cọc | chup-anh | BOOK | W−170 |
| 9 | `ATTIRE_SHORTLIST` | Quyết định thuê hay may đo, số bộ cần; lọc và hỏi cửa hàng (mẫu còn trống ngày cưới, chính sách sửa) | trang-phuc | CHOOSE (Gợi ý) | W−160 |
| 10 | `DECOR_SHORTLIST` | Lọc và hỏi giá đơn vị decor: gửi thông tin sảnh, ý tưởng hạng mục (cổng, backdrop, lối đi, bàn gallery) | decor | CHOOSE (Gợi ý) | W−150 |
| 11 | `ATTIRE_TRY_STORE` | Đi thử váy, vest để đánh giá cửa hàng (form dáng, chất liệu) | trang-phuc | CHOOSE (cuối tuần) | W−145 |
| 12 | `DECOR_VISIT` | Xem công trình decor thực tế, so sánh báo giá và hạng mục | decor | CHOOSE | W−128 |
| 13 | `ATTIRE_BOOK` | Chốt trang phục: so sánh, xác nhận đơn và đặt cọc | trang-phuc | BOOK | W−130 |
| 14 | `MAKEUP_SHORTLIST` | Lọc và hỏi giá chuyên viên makeup: ảnh khách thật, lịch sáng ngày cưới, phí di chuyển, giá trang điểm người nhà | makeup | CHOOSE (Gợi ý) | W−120 |
| 15 | `DECOR_BOOK` | Chốt decor: xác nhận đơn và đặt cọc | decor | BOOK | W−115 |
| 16 | `SELF_RINGS` | Chọn và mua nhẫn cưới | chung | SELF | W−85 |
| 17 | `MAKEUP_ASSESS` | Đánh giá tay nghề makeup (makeup thử có phí hoặc xem video thực tế) | makeup | CHOOSE (cuối tuần) | W−105 |
| 18 | `MAKEUP_BOOK` | Chốt makeup: so sánh, xác nhận đơn và đặt cọc | makeup | BOOK | W−95 |
| 19 | `FLOWER_SHORTLIST` | Lọc tiệm hoa, xem mẫu, hỏi hoa theo mùa và báo giá (theo màu váy và decor) | hoa-cuoi | CHOOSE (Gợi ý) | W−65 |
| 20 | `SELF_INVITE_PRINT` | Thiết kế, chọn mẫu và đặt in thiệp cưới | chung | SELF | W−60 |
| 21 | `SELF_ENGAGEMENT` | Chuẩn bị lễ ăn hỏi: thuê tráp, đội bê tráp (bỏ qua được) | chung | SELF | W−50 |
| 22 | `FLOWER_BOOK` | Chốt hoa cưới: xác nhận đơn và đặt cọc | hoa-cuoi | BOOK | W−45 |
| 23 | `SELF_REGISTER` | Đăng ký kết hôn (bỏ qua được) | chung | SELF | W−40 |
| 24 | `SELF_INVITE_SEND` | Chốt danh sách khách và gửi thiệp mời | chung | SELF | W−30 |
| 25 | `SELF_CARS` | Thuê xe hoa, xe đưa đón (bỏ qua được) | chung | SELF | W−25 |
| 26 | `SELF_SCRIPT` | Lên kịch bản ngày cưới, phân công người nhà | chung | SELF | W−14 |
| 27 | `SELF_FINAL_CHECK` | Rà soát cuối: xác nhận tất cả NCC, giờ giấc, đồ cần mang | chung | SELF (noShrink) | W−3 |
| 28 | `SELF_THANKS` | Cảm ơn khách, tổng kết chi phí | chung | SELF (noShrink) | W+7 |

Ghi chú: các mã Mốc chốt kết thúc `_BOOK` là quy ước được code dùng để nhận diện (`endsWith('_BOOK')` ở `timeline-hooks.ts:97,122`, `timeline.service.ts:85,185`).

### 2.4 Việc CHI TIẾT hiện có (34 việc, để đối chiếu khi bỏ)

- **nha-hang:** `VENUE_HALL_CONFIRM` (D+2), `VENUE_TASTING` (E−45), `VENUE_MENU_FINAL` (E−30), `VENUE_EVENT_FINAL` (E−7), `VENUE_EVENT` (E+0, EVENT), `VENUE_PAY` (E+7).
- **chup-anh:** `PHOTO_CONCEPT` (S−21), `PHOTO_ALBUM_SHOOT` (S+0, EVENT), `PHOTO_PICK_EDIT` (S+7), `PHOTO_REVIEW` (S+28), `PHOTO_DELIVERY_PREP` (W−7), `PHOTO_EVENT` (W+0, EVENT), `PHOTO_PAY` (E+7), `PHOTO_FILES` (W+30).
- **trang-phuc:** `ATTIRE_MEASURE` (E−75), `ATTIRE_ALBUM_PICKUP` (S−1), `ATTIRE_FIT_FIRST` (E−45), `ATTIRE_FIT_LAST` (E−10), `ATTIRE_RECEIVE` (E−2), `ATTIRE_PAY` (E+7), `ATTIRE_RETURN` (E+2).
- **decor:** `DECOR_BRIEF` (E−75), `DECOR_REVIEW_MOCKUP` (E−30), `DECOR_FINAL` (E−10), `DECOR_EVENT` (E+0), `DECOR_PAY` (E+7).
- **makeup:** `MAKEUP_TRIAL` (E−30), `MAKEUP_FINAL` (E−7), `MAKEUP_EVENT` (E+0), `MAKEUP_PAY` (E+7).
- **hoa-cuoi:** `FLOWER_PICK_STYLE` (E−30), `FLOWER_FINAL` (E−14), `FLOWER_EVENT` (E+0), `FLOWER_PAY` (E+7).

---

## 3. Cơ chế sinh và tính ngày

### 3.1 Sinh timeline khung

- **Khi nào:** khách lưu thông tin đám cưới (`PUT /weddings/me` → `WeddingsService.saveMine`, `weddings.service.ts:69-114`). Lần đầu mở trang chưa có đám cưới thì `TimelinePage.tsx` hiện form "Tạo timeline khung"; bấm lưu mới sinh. Không sinh lúc chỉ mở trang.
- **Ghi vào bảng:** `timeline_tasks` qua `onWeddingCategories` (`timeline-hooks.ts:29-37`) → `frameRows` (`timeline-rows.ts:29`) → `createMany({ skipDuplicates: true })`. Chỉ thêm việc CHƯA có theo `task_code` (`:33-34`); việc đã sinh không bao giờ bị dời. Chọn thêm hạng mục sau đó chỉ thêm việc của hạng mục đó. **Bỏ chọn hạng mục không xóa việc khung đã sinh** (`saveMine` chỉ xóa/ghi lại `wedding_categories`, `:108-109`).
- **Mốc "hôm nay" khi sinh:** `I = vnYmd(new Date())` tại lúc lưu (`timeline-hooks.ts:32`).

### 3.2 Công thức co giãn khung (`timeline-schedule.ts`)

- `L = W − I`, `L1 = L − 1`. `levelOf` (`:21-27`): L > 270 `FAR`, 81–270 `NORMAL`, 21–80 `SOON`, ≤ 20 `VERY_SOON`; L ≤ 0 ném lỗi (chặn lưu).
- Ngưỡng giữ nguyên K (`:49-53`):
  ```ts
  export function keepThreshold(L1: number): number | null {
    if (L1 >= FRAME_MAX_OFFSET) return null;            // L1 ≥ 270: không phải ép
    return Math.min(60, Math.max(Math.floor(L1 / 2), L1 - 20));
  }
  ```
- Ép việc cách ngày cưới d > K (`:76`), trừ `noShrink`; việc sau ngày cưới (offset > 0) không ép (`:83`):
  ```ts
  const shrink = (d, noShrink) => (K === null || noShrink || d <= K ? d : roundHalfUp(K + ((d - K) * (L1 - K)) / (FRAME_MAX_OFFSET - K)));
  ```
- Kẹp về `I+1` nếu rơi quá khứ (`:102-106`, `:118-122`, gắn cờ gấp); trong một dịch vụ các việc Chọn NCC cách nhau ≥ 1 ngày và Mốc chốt sau việc Chọn cuối ≥ 1 ngày (`:123-126`).
- Dời cuối tuần: chỉ áp cho việc **CHỌN NCC** có `weekendPreferred` và chỉ lùi, không lùi quá việc trước hoặc `I+1` (`:57-61`, `:127-133`).
- Cờ "Gấp" (`urgent`, `:88-94`): bị kẹp, hoặc bị ép > 50% khi mức SOON / VERY_SOON, hoặc việc trước ngày cưới mà rơi sát / sau ngày cưới. Không lưu: tính lại khi đọc (`timeline.service.ts:29-38`, `:69-80`), với `I = created_date` của đám cưới.

### 3.3 Việc chi tiết

- **Sinh lúc nào:** khi đơn được ghi nhận cọc, KHÔNG phải lúc mở trang. Chuỗi: `markDepositPaid` (`orders.service.ts:381`, gọi hook ở `:426`) → `onOrderDeposited` (`timeline-hooks.ts:93-101`: chuyển Mốc chốt `_BOOK` của hạng mục sang Done rồi `syncOrderDetails`) → `syncOrderDetails` (`:43-76`) → `depositDetailPlan` (`timeline-rows.ts:85`) → `detailRows` → `planDetails` (`timeline-schedule.ts:177-236`). Được kích bởi VietQR `checkDeposit` và `confirmDemoDeposit`.
- **Bỏ qua** nếu ngày thực hiện E sau ngày cưới W (`timeline-hooks.ts:53-56`, ghi log cảnh báo), hoặc danh mục không thuộc 6 hạng mục.
- **Neo ngày:** `D` = `payments.paid_date` (giờ VN), `E` = `orders.event_date`, `W` = ngày cưới, `S` = ngày `PHOTO_ALBUM_SHOOT` nếu đã có, ngược lại tính mặc định.
- **Công thức co giãn việc chi tiết** (`:183-227`):
  ```ts
  const lo = D + k;                                   // k = MIN_AFTER_DEPOSIT[service]
  const space = E - lo;
  const scale = xmax > 0 && space > 0 ? Math.min(1, space / xmax) : 1;   // xmax = lớn nhất trong các E−x
  // việc E−x:  n = Math.min(E - roundHalfUp(x * scale), E - 1);  n < lo → n = lo ('rút ngắn')
  // space ≤ 0 (squeezed): mọi việc trước sự kiện dồn về Math.max(I + 1, D + 1), urgent
  ```
  EVENT = E (hoặc W cho `PHOTO_EVENT`, S cho `PHOTO_ALBUM_SHOOT`); PAYMENT = E+7; việc sau sự kiện W+n / E+n giữ nguyên. Dời cuối tuần chỉ lùi và chỉ khi `≥ lo` và `> prev` (`:221-227`).
- **"Tạm tính theo S": CÒN dùng nhưng nửa vời.**
  - Còn dùng: `S = ctx.albumDate ?? defaultAlbumDate(...)` (`:184`); `defaultAlbumDate` = `min(D+23, W−35)` nhưng không sớm hơn `D+2` (`:148-151`); cờ `tentative = !done && tpl.anchor === 'S'` (`timeline.service.ts:113`) và nhãn "· Tạm tính" (`TimelineRow.tsx:120`).
  - Chưa nối: `appointmentDate` bị gán cứng `null` (`timeline.service.ts:115`, cột chờ SQL); `PATCH timeline/items/:id` không nhận `appointmentDate` (`weddings.controller.ts:40-43`); `replanAlbumTasks` (`timeline-schedule.ts:250`) chỉ được test dùng. Ngoài ra `PHOTO_ALBUM_SHOOT` do NCC làm (`ownerOf` → VENDOR) nên khách không đổi được hạn. Hiện không có đường nào đổi S.
- **Mỗi mã chỉ một dòng trong một đám cưới** (`@@unique([wedding_id, task_code])`), nên khi hạng mục có hai đơn cọc, đơn MỚI NHẤT giữ việc: việc chưa xong của đơn cũ bị xóa và thay bằng việc của đơn mới (`timeline-rows.ts:85-98`).

### 3.4 Đổi ngày cưới

- Xem trước: `POST /weddings/me/timeline/regenerate-preview` → `planWeddingDateChange` (`timeline-hooks.ts:143-180`), không ghi gì.
- Lưu: trong cùng transaction với `saveMine`, UPDATE `scheduled_date` các việc đổi hạn (`weddings.service.ts:98-108`, dòng 103).
- Thuật toán `replanOnWeddingDateChange` (`timeline-schedule.ts:278-304`): tính lại việc **khung Todo** bằng `planFrame` đầy đủ luật với `I` = hôm nay; tính lại việc chi tiết **neo S còn Todo** (S theo W mới; nếu `PHOTO_ALBUM_SHOOT` đã Done thì giữ). **Giữ nguyên:** việc đã Done, việc chi tiết neo E của dịch vụ đã cọc, việc khách tự thêm (không có mã mẫu).
- Sau đó `notifyVendorsOfWeddingDate` (`timeline-hooks.ts:186-203`) báo NCC có đơn (Deposited / Pending / NeedRevision) mà E sau ngày cưới mới. Cảnh báo cho khách: `DIFFERENT` / `AFTER_WEDDING`; chưa cọc thì kèm `blocksDeposit` (`createDeposit` chặn bằng `EVENT_DATE_AFTER_WEDDING`).

### 3.5 NCC sửa ngày thực hiện / hủy / hoàn thành đơn

- **NCC sửa E** (`editDeposited`, `orders.service.ts:631`, hook ở `:678` khi `changes` có `EventDate`): `onOrderEventDateChanged` (`timeline-hooks.ts:82-87`) xóa việc chi tiết **Todo neo E** rồi sinh lại theo E mới; việc Done và việc neo D / S / W giữ nguyên.
- **NCC hủy đơn đã cọc** (`cancel`, `orders.service.ts:758`, hook ở `:774`): `onOrderCancelled` (`timeline-hooks.ts:107-126`) xóa **mọi** việc chi tiết của đơn (kể cả đã Done); còn đơn Deposited khác cùng hạng mục thì đơn cọc mới nhất nhận lại việc (`syncOrderDetails`); không còn đơn nào (Deposited / Completed) thì Mốc chốt từ Done về Todo (khách tìm NCC khác). Timeline hiện dòng "Đơn … với … đã hủy ngày …" (`timeline.service.ts:61-66`, `:126`) và nút Gợi ý trên Mốc chốt.
- **Hoàn thành đơn** (`orders.service.ts:726` → `completeOrder`, `order-lifecycle.ts:67-77`): trong cùng transaction đóng mọi việc chi tiết còn Todo của đơn sang Done (`:75`) để khỏi tồn đọng quá hạn. Tự hoàn thành sau E+7 (`autoComplete`, `order-jobs.service.ts:58`). Việc của đơn Completed không còn xuất hiện ở Bảng việc NCC (chỉ lấy đơn Deposited).

### 3.6 "Thanh toán phần còn lại"

Không sinh riêng: là 6 mẫu `kind = PAYMENT` (`VENUE_PAY`, `PHOTO_PAY`, `ATTIRE_PAY`, `DECOR_PAY`, `MAKEUP_PAY`, `FLOWER_PAY`; `timeline-templates.ts:104-109`, mốc E+7). Sinh cùng lúc cọc trong `planDetails` (`timeline-schedule.ts:198-200`, hạn cố định `E + 7`), chủ việc là **khách** (`task-owner.ts:23`). Không liên quan bảng `payments` hay đợt 2 của đơn: chỉ là một dòng nhắc trên timeline.

---

## 4. Cơ sở dữ liệu (đọc `backend/prisma/schema.prisma`, không chạy lệnh)

### 4.1 `timeline_tasks` (`schema.prisma:380-400`)

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | uuid PK | |
| `wedding_id` | uuid? | Đám cưới |
| `category_id` | uuid? → `service_categories` | Hạng mục (null với việc chung / việc khách tự thêm) |
| `order_id` | uuid? → `orders` | Đơn đang giữ việc chi tiết; null với việc khung / việc tự thêm |
| `title` | varchar(255)? | Tên việc (copy từ mẫu lúc sinh) |
| `scheduled_date` | date? | **Hạn** |
| `status` | varchar(20), mặc định `Todo` | Chỉ `Todo` / `Done` |
| `completed_date` | timestamptz? | |
| `task_type` | varchar(20)? | `Frame` / `Detail` |
| `task_code` | varchar(50)? | Mã mẫu; NULL = việc khách tự thêm |
| `display_order` | int, mặc định 0 | = `order` của mẫu |
| `created_date` | timestamptz | |

Ràng buộc: `@@unique([wedding_id, task_code])` (Postgres cho nhiều dòng `task_code` NULL), index `order_id` và `(wedding_id, scheduled_date)`. **Chưa có** cột `appointment_date` (SQL chờ chạy), cột chủ việc (owner), cột neo / offset, hay cột tham chiếu gói / quy trình.

**Dạng `task_code` hiện có:** (a) `SELF_*` (11 mã chung); (b) `<DỊCH_VỤ>_<BƯỚC>` với tiền tố `VENUE_` / `PHOTO_` / `ATTIRE_` / `DECOR_` / `MAKEUP_` / `FLOWER_` (62 mã, xem mục 2); (c) `NULL` cho việc khách tự thêm; (d) có thể còn mã của timeline cũ (code có nhánh "mã lạ / timeline cũ": `timeline.service.ts:85`, `task-owner.ts:17-18`). Logic dựa vào hậu tố `_BOOK` và tra mẫu bằng `templateOf(task_code)`.

### 4.2 Gói dịch vụ

- `service_packages` (`:338-359`): `id`, `vendor_id`, `name` (200), `description` (text tự do), `price`, `capacity`, `status` (`Draft`/…), `created_date`, `updated_date`, `min_tables`. Quan hệ: `order_items[]`, `orders[]`, `package_albums[]` (ảnh), `package_busy_dates[]`, `package_tags[]`, `package_verifications[]`.
- **Chưa có cột / bảng mô tả quy trình phục vụ.** Chỉ có `description` tự do. `package_verifications` (`:270-281`) lưu `snapshot Json` của bản cập nhật chờ Admin duyệt: nếu thêm "quy trình" vào gói thì phải đi qua luồng duyệt này.
- `vendor_profiles.category_id` (một NCC đúng một lĩnh vực): từ đơn suy ra hạng mục qua `orders.vendor_id` → `vendor_profiles.category_id`.

### 4.3 Đơn hàng biết khách đặt gói nào bằng cách nào?

- `orders` (`:205-240`): có cột `package_id` (FK `service_packages`) **nhưng chỉ ghi cho Trung tâm tiệc cưới** (chọn sảnh): `checkHall` trả `null` và bỏ `packageId` với dịch vụ khác (`orders.service.ts:163-175`, comment "Dịch vụ khác không theo sảnh"); FE chỉ gửi `packageId` khi là nhà hàng (`OrderFormDialog.tsx:194,448`).
- `order_items` (`:156-171`): có cột `package_id` (+ index, quan hệ `service_packages`) nhưng **không có code nào ghi** (`itemRows` ở `orders.service.ts` chỉ ghi `item_name`, `unit`, `quantity`, `unit_price`, `amount`); chỉ `reviews` đọc quan hệ này (`reviews.service.ts:65,76`).
- Vậy với 5/6 hạng mục (chụp ảnh, trang phục, trang trí, trang điểm, hoa cưới) **đơn không biết gói nào**: chỉ có tên hạng mục là chữ tự do (`item_name`) cộng NCC. Với nhà hàng chỉ biết sảnh.
- Không có bảng nào kiểu `PackageTasks` / quy trình phục vụ (tìm `package_tasks`, `process`, `quy trình`, `workflow` trong schema và `prisma/sql`: không có).
- Lưu ý: không đọc được CSDL thật nên không kiểm chứng cột `order_items.package_id` có thật sự tồn tại trên Supabase; schema ghi là có.

---

## 5. Phía NCC: quản lý gói dịch vụ

**Có.** Trang quản lý gói:

| Thành phần | File |
|---|---|
| Route | `/vendor/catalog` (danh sách, `VendorCatalogPage.tsx`), `/vendor/catalog/new` và `/vendor/catalog/:id` (`VendorPackagePage.tsx`); `routes/paths.ts:25-27`, `router.tsx` |
| Component | `FE/features/vendorPackages/components/`: `PackageEditor`, `PackageTable`, `PackageHeader`, `PackageDetails`, `PackageFilters`, `PackageStatusSummary`, `RowMenu`, `TagsInput`; `packageForm.ts`, `constants.ts`, `hooks.ts` |
| API FE | `FE/api/vendorPackages.ts` |
| API BE | `BE/vendors/vendor-packages.controller.ts` (`@Controller('vendors/me/packages')`): `GET /`, `POST suggest-description` (Gemini), `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, `DELETE /:id/update`, `POST /:id/submit`, `/hide`, `/republish`; xử lý ở `vendor-packages.service.ts` |
| Kiểu | `FE/types/vendorPackage.ts`: `SavePackageRequest` = `name`, `description`, `price`, `tags`, `capacity`, `minTables`, `photos`, `coverPublicId` |

**Chỗ nhập "quy trình": chưa có.** Form chỉ có tên, mô tả tự do, giá, tag, sức chứa, số mâm tối thiểu, ảnh. Gói đã đăng muốn sửa phải gửi bản cập nhật cho Admin duyệt (`package_verifications.snapshot`, `vendor-packages.service.ts:263-300,377`).

---

## 6. API timeline hiện có

### Phía khách (`BE/weddings/weddings.controller.ts`, controller `weddings/me`)

| Method + route | Mô tả | FE gọi |
|---|---|---|
| `PUT /weddings/me` | Lưu thông tin đám cưới + hạng mục; **sinh khung**, đổi hạn khi đổi ngày cưới | `useSaveWedding` (`hooks.ts:34`), form ở `TimelinePage` / `WeddingEditDialog` |
| `GET /weddings/me/timeline` | Toàn bộ việc (`items`, `level`, `daysLeft`) | `weddingsApi.getTimeline` → `useTimeline` (`hooks.ts:51`) → `TimelineView` |
| `POST /weddings/me/timeline/regenerate-preview` | Xem trước đổi ngày cưới (việc đổi hạn + cảnh báo đơn) | `weddingsApi.previewDateChange` ← `WeddingDialogs.tsx:119` |
| `POST /weddings/me/timeline/tasks` | Thêm việc tự thêm `{ title, dueDate }` | `AddTaskDialog` qua `useTimelineMutations` |
| `PATCH /weddings/me/timeline/items/:id` | Đổi tên (việc tự thêm), hạn, tick `isDone`; khách chỉ tick việc `CUSTOMER` / `BOTH` | `TimelineView` (`update`: hoàn thành, hoàn tác, đổi hạn) |
| `DELETE /weddings/me/timeline/tasks/:id` | Xóa việc tự thêm (`task_code` null) | `TimelineView` (`remove`) |

### Phía NCC (`BE/orders/orders.controller.ts`, controller `vendors/me/orders`, `:84-116`)

| Method + route | Mô tả | FE gọi |
|---|---|---|
| `GET /vendors/me/orders/progress` | Tiến độ mọi đơn Deposited | `vendorOrdersApi.progress` → `useOrderProgress` |
| `GET /vendors/me/orders/calendar?from&to` | Lịch (≤ 100 ngày): ngày thực hiện đơn + việc chi tiết | `vendorOrdersApi.calendar` → `useVendorCalendar` |
| `GET /vendors/me/orders/tasks` | Bảng việc (kanban) | `vendorOrdersApi.board` → `useTaskBoard` |
| `GET /vendors/me/orders/:id/tasks` | Việc chi tiết của một đơn + tóm tắt | `vendorOrdersApi.tasks` (`OrderProgressPanel`) |
| `PATCH /vendors/me/orders/:id/tasks/:taskId` `{ isDone }` | NCC tick / bỏ tick việc của NCC / hai bên | `vendorOrdersApi.setTaskDone` → `useSetOrderTask`, `useMoveBoardTask` |

Realtime: sự kiện `task` (`timeline.service.ts:214`, `order-tasks.service.ts` `setDone`) làm khách và NCC tải lại. Nhắc hạn: `order-reminders.ts`.

---

## 7. Chỗ sẽ bị ảnh hưởng nếu bỏ việc chi tiết sinh từ mẫu

### Backend

- **`timeline-templates.ts`:** bỏ 34 mẫu DETAIL/EVENT/PAYMENT; `MIN_AFTER_DEPOSIT`, `needsMeeting`; kiểu `TaskKind` và `anchor` `D`/`E`/`S`; `suggestOf` giữ (chỉ dùng CHOOSE/BOOK).
- **`timeline-schedule.ts`:** `planDetails`, `newDetailTasks`, `replanAlbumTasks`, `defaultAlbumDate`, `DetailContext`, `DetailPlan`; phần việc chi tiết của `replanOnWeddingDateChange` (`:296-302`) và các kiểu `DepositedOrder`, `ExistingTask` liên quan.
- **`timeline-rows.ts`:** `detailRows`, `depositDetailPlan`, `ExistingDetail`; `cancelPlan` đổi nghĩa (logic nhận lại việc giữa các đơn).
- **`timeline-hooks.ts`:** `syncOrderDetails`, `onOrderEventDateChanged`, `onOrderDeposited`, `onOrderCancelled` (nhánh `handOverTo`), nhánh đơn đã cọc của `planWeddingDateChange`.
- **`timeline-rules.ts`:** `dueBounds` (nhánh theo `kind EVENT` / `anchor E` / `offset > 0`); `sequenceIssue` (chỉ khung, giữ nguyên).
- **`timeline.service.ts`:** `get()` — phân loại `SERVICE_TASK` (`:86-95`), tính cờ gấp bằng `planDetails` (`:69-80`), `detailCountOf` (`:27`, `:124`), `tentative` (`:113`), `needsMeeting` (`:114`), `owner` (`:117`), `dateConflict` (`:122`), `appointmentDate` (`:115`); `update()` — quyền theo `ownerOf` (`:188-189`); `checkDue` với `order_id`.
- **`task-owner.ts`:** `ownerOf` hiện suy chủ việc từ mẫu (`CUSTOMER_CODES`, `kind`); `orderProgress`, nhắc hạn vẫn dùng `owner`.
- **`calendar-items.ts`** (`templateOf(...).kind === 'EVENT'`, bỏ trùng ngày thực hiện) và **`order-tasks.service.ts`** (`rowOf` dùng `ownerOf(task_code)`; `board`, `calendar`, `progress`, `setDone`).
- **`orders.service.ts`:** hook `:426` (cọc), `:678` (sửa ngày), `:774` (hủy); **`order-lifecycle.ts:75`** (đóng việc khi hoàn thành); **`order-reminders.ts`**.
- **`scripts/`:** `rebuild-timelines.ts`, `repair-order-details.ts`, `restore-timelines.ts` (dùng `detailRows`, `defaultAlbumDate`, mẫu).
- **Test:** `timeline-schedule.test.ts` — gần như toàn bộ: "mẫu timeline", "sheet Ví dụ 90 ngày" (golden 62 dòng, `SHEET`, test "đúng 62 dòng"), "theo từng L", "việc chi tiết theo ngày đặt cọc", "hai dịch vụ cọc ở hai thời điểm khác nhau", "Ngày hẹn chụp album", "bảng báo cáo", "đổi ngày cưới" (phần chi tiết); giữ phần `levelOf` / `keepThreshold` / Gợi ý / khung. `timeline-rows.test.ts` — cả 3 nhóm (đơn thứ hai cùng hạng mục, hủy đơn, cọc đủ 6 dịch vụ).
- **Tài liệu:** `docs/TIMELINE.md`, `docs/timeline/HIEN_TRANG_TIMELINE.md`, xlsx nguồn.

### Frontend

- `TimelineRow.tsx`: `needsMeeting` / `onMeet` / `meetingDraft`, `tentative`, `appointmentDate`, `vendorOwned`, `owner BOTH`, `detailCount` ("N việc chi tiết mở sau khi bạn đặt cọc").
- `TimelineView.tsx`: gom việc con vào Mốc chốt (`books`, `kidsOf`, `Entry group`), `chatWith`; `TimelineGroupCard.tsx` (cả file); `timelineFilter.ts` (`matchesOwner` theo `SERVICE_TASK`/`owner`); `timelineGroups.ts`.
- `features/payments/components/DepositView.tsx:146` (đếm `SERVICE_TASK` để báo "N việc cần làm").
- `types/wedding.ts`: `TimelineItem` (`kind SERVICE_TASK`, `owner`, `orderCode`, `orderEventDate`, `dateConflict`, `appointmentDate`, `tentative`, `needsMeeting`, `detailCount`).
- Phía NCC: toàn bộ mục 9 (`VendorCalendarPage`, `TaskBoard`, `taskBoard.ts`, `OrderProgressPanel`, `OrderBoard`, `api/vendorOrders.ts`, hooks, `RealtimeBridge`).

---

## 8. Rủi ro và điều chưa rõ

1. **Ràng buộc `unique(wedding_id, task_code)`.** Việc do NCC khai báo theo gói không có mã cố định, và một đám cưới có thể có nhiều việc cùng tên / nhiều gói. Cần chiến lược mã (hoặc bỏ ràng buộc / đổi sang khóa theo đơn): đây là thay đổi CSDL dùng chung, phải chạy SQL tay (không prisma migrate).
2. **`task_code = NULL` đang mang nghĩa "việc khách tự thêm".** `timeline.service.ts:105` (`isCustom`), `:87` (`kind = 'TASK'`), `:191` và `remove()` `:219` (cho sửa tên / xóa khi `task_code` null). Việc NCC khai báo mà để `task_code` rỗng sẽ bị coi là việc khách tự thêm: khách xóa / đổi tên được. Phải tách khái niệm bằng cột mới.
3. **Chủ việc suy từ mã mẫu** (`ownerOf`). NCC khai báo thì phải lưu `owner` (khách / NCC / hai bên) theo từng việc; mã lạ hiện mặc định `BOTH`.
4. **Hướng mới ghi "khách chỉ xem", nhưng hiện khách tick được việc `CUSTOMER` / `BOTH` và đổi hạn** (`timeline.service.ts:188-196`). Cần quyết định: việc nào khách vẫn tick (ví dụ khách gửi tài liệu, trả đồ, thanh toán) hay chỉ xem hoàn toàn; ảnh hưởng cột "Chờ khách làm" của NCC.
5. **Đơn không biết gói** với 5/6 hạng mục (mục 4.3). Muốn "việc của gói" hiện khi cọc đơn thì phải có liên kết đơn → gói (hiện `order_items.package_id` có cột nhưng chưa ai ghi; `orders.package_id` chỉ cho sảnh). Cần: NCC chọn gói khi tạo đơn, một đơn nhiều gói thì sao, đơn cũ (đã cọc, đã có việc từ mẫu) xử lý thế nào.
6. **Mốc tương đối do NCC khai báo.** Hiện ngày tính bằng mẫu + neo `E`/`D`/`W`/`S` + co giãn (`planDetails`). Nếu NCC khai "trước ngày thực hiện n ngày" thì phải quy ước neo, và quyết định có còn co giãn / ép khi `E − D` ngắn hay không. Các hook sửa ngày (`onOrderEventDateChanged`) và đổi ngày cưới phụ thuộc `templateOf(code)?.anchor`.
7. **Thời điểm chụp (snapshot).** Gói sửa sau khi khách đã cọc: việc của đơn lấy theo quy trình lúc cọc hay lúc sửa? Bản cập nhật gói đang phải qua Admin duyệt (`package_verifications`), nên "quy trình" mới có cần duyệt không?
8. **Dữ liệu cũ.** Các đơn Deposited đã có việc chi tiết sinh từ mẫu; cần giữ, đóng hay xóa. Các script `timelines:rebuild` / `repair` sẽ hỏng hoặc sinh lại việc cũ nếu không sửa. Hủy đơn hiện xóa cả việc đã Done (`timeline-hooks.ts:117`): mất lịch sử.
9. **Ngày hẹn / S đang nửa vời** (mục 3.3): `appointment_date` chưa có trong CSDL, FE hiển thị "Đã hẹn" nhưng BE trả `null`; nếu bỏ việc neo S thì dọn luôn phần này thay vì chạy SQL thừa (`prisma/sql/2026-10-29-timeline-appointment-date.sql` đang ghi "CHƯA CHẠY").
10. **Nút "Hẹn với NCC"** chỉ có ở 8 mẫu (`needsMeeting`) và chỉ mở khung chat với câu soạn sẵn; nếu việc do NCC khai báo thì cờ này nên là thuộc tính của việc.
11. **Nút "Gợi ý"** phụ thuộc cờ `showSuggest` trong mẫu khung và `SERVICE_LABEL` ở FE; danh mục ngoài 6 hạng mục (`SERVICE_BY_CATEGORY_NAME`) không có timeline. `Makeup` / `Trang điểm` là hai tên cho một hạng mục.
12. **Bỏ chọn hạng mục không dọn việc khung đã sinh** (mục 3.1): sẽ lộ ra khi thay đổi cách sinh.
13. **Thanh toán phần còn lại** hiện là việc nhắc cứng E+7, chủ việc khách. Cần quyết định giữ do hệ thống sinh (khung) hay do NCC khai; hiện không nối với `payments` hay đợt 2 của đơn.
14. **Phụ thuộc ngầm vào `order_id` + `task_type = 'Detail'`:** Bảng việc, lịch, tiến độ, nhắc hạn và đóng việc khi hoàn thành đều lọc theo hai trường này (`order-tasks.service.ts`, `order-reminders.ts:19`, `order-lifecycle.ts:75`); đổi cách lưu việc của NCC thì cả nhóm này đổi theo.
15. **Chưa xác minh với CSDL thật** (không được đọc): lược đồ lấy từ `schema.prisma` do nhóm tự duy trì; có thể lệch với Supabase.
16. **Tài liệu cũ có thể lệch code:** `docs/timeline/HIEN_TRANG_TIMELINE.md` viết 29/10 trước các thay đổi gần đây; không đối chiếu từng câu.

---

## 9. Màn "Lịch làm việc" phía nhà cung cấp

### 9.1 File và route

- **Route:** `/vendor/calendar` (`routes/paths.ts:29`, `router.tsx:97` → `VendorCalendarPage`).
- **Page:** `FE/pages/vendor/VendorCalendarPage.tsx` (303 dòng). Có 4 cách xem: `'month'` (Lịch tháng), `'board'` (**Bảng việc**, kanban), `'busy'` (Lịch bận sảnh, chỉ Trung tâm tiệc cưới), `'orders'` (Theo đơn). Nhớ lựa chọn bằng `localStorage` (`weddy.vendor.calendar.view`, `weddy.vendor.board.group`).
- **Component / logic:** `FE/features/vendorOrders/components/TaskBoard.tsx` (kanban kéo thả `@dnd-kit`), `FE/features/vendorOrders/taskBoard.ts` (hàm thuần chia cột / hàng), `OrderProgressPanel.tsx` (`TaskRow`), `OrderBoard.tsx` (`useHues`, `ACTIVE_STATUSES`), `FE/features/calendar/*` (lưới tháng, màu đơn).
- **Hook:** `FE/features/vendorOrders/hooks.ts`: `useTaskBoard` (`:211`), `useMoveBoardTask` (`:217`, cập nhật lạc quan), `useSetOrderTask` (`:189`), `useOrderProgress` (`:205`), `useVendorCalendar` (`:246`); khóa cache `keys.ts`.
- **API FE / kiểu:** `FE/api/vendorOrders.ts`, `FE/types/vendorOrder.ts:155-198` (`OrderTask`, `BoardTask`, `CalendarItem`).
- **Realtime:** `RealtimeBridge.tsx:59-66` làm tải lại lịch, tiến độ, bảng việc khi có sự kiện `task`.

### 9.2 API màn này gọi

| Mục đích | Method + route | Xử lý |
|---|---|---|
| Bảng việc | `GET /vendors/me/orders/tasks` | `VendorOrdersController.board` (`orders.controller.ts:97`) → `OrderTasksService.board` (`order-tasks.service.ts:85`) |
| Lịch tháng | `GET /vendors/me/orders/calendar?from&to` | `calendar` (`:107`) → `calendarItems` (`calendar-items.ts`) |
| Nhãn "Trễ tiến độ" | `GET /vendors/me/orders/progress` | `progress` (`:63`) |
| Danh sách đơn (chip lọc) | `GET /vendors/me/orders` | `OrdersService.listForVendor` |
| Tick / kéo thả | `PATCH /vendors/me/orders/:id/tasks/:taskId` `{ isDone }` | `setDone` (`:136`) |

### 9.3 Dữ liệu việc lấy từ đâu

**Cùng bảng `timeline_tasks`** với timeline của khách, không có bảng riêng. Điều kiện (`order-tasks.service.ts:85-100`, `board`):

```ts
where: { task_type: 'Detail', orders: { is: { vendor_id: vendor.id, status: 'Deposited' } } },
orderBy: [{ scheduled_date: 'asc' }, { display_order: 'asc' }],
```
tức việc chi tiết (`order_id` khác rỗng) của các đơn **đã cọc** (`Deposited`) của chính NCC; việc khung và việc tự thêm của khách không bao giờ hiện. Không lọc theo `category` (NCC có đúng một lĩnh vực). Đơn Completed không còn việc ở đây (việc đã bị đóng, mục 3.5). Lịch tháng lấy thêm ngày thực hiện của đơn `Pending` / `NeedRevision` / `Deposited` / `Completed` nằm trong khoảng (`calendar`, `:107-134`); việc "Ngày thực hiện" (EVENT) trùng đúng ngày thực hiện của đơn bị bỏ vì đã có mốc đơn (`calendar-items.ts:63`).

### 9.4 Các việc "Đo số đo…", "Thử đồ lần 1", "Trả trang phục thuê", "Thanh toán phần còn lại…" sinh ở đâu, lúc nào

Sinh **khi khách cọc đơn**, không phải khi mở trang. Chuỗi: `OrdersService.markDepositPaid` (`orders.service.ts:381`; hook ở `:426`) → `onOrderDeposited` (`timeline-hooks.ts:93`) → `syncOrderDetails` (`:43`) → `depositDetailPlan` (`timeline-rows.ts:85`) → `detailRows` (`:49`) → `planDetails` (`timeline-schedule.ts:177`). Nội dung từ mẫu `timeline-templates.ts`:

| Việc | Code | Dòng mẫu | Mốc | Chủ việc |
|---|---|---|---|---|
| Đo số đo, chốt mẫu chính thức | `ATTIRE_MEASURE` | `:71` | E−75, ưu tiên cuối tuần, `needsMeeting` | Hai bên |
| Thử đồ lần 1 | `ATTIRE_FIT_FIRST` | `:81` | E−45, ưu tiên cuối tuần, `needsMeeting` | Hai bên |
| Trả trang phục thuê (bỏ qua nếu may đo) | `ATTIRE_RETURN` | `:110` | E+2 | Khách |
| Thanh toán phần còn lại cho tiệm trang phục | `ATTIRE_PAY` | `:106` | E+7 | Khách |

Cùng bộ gồm cả `ATTIRE_ALBUM_PICKUP`, `ATTIRE_FIT_LAST`, `ATTIRE_RECEIVE`. Script `timelines:rebuild` / `repair-order-details.ts` cũng sinh lại được cho dữ liệu cũ (chạy tay).

### 9.5 Cách chia cột và nhãn

- **Chia cột** (`taskBoard.ts:20`): chỉ dựa trên hai cờ của mỗi việc:
  ```ts
  export const columnOf = (t) => (t.isDone ? 'done' : t.canTick ? 'todo' : 'customer');
  // customer → "Chờ khách làm", todo → "Cần làm", done → "Đã xong"
  ```
  `isDone` = `timeline_tasks.status === 'Done'` (CSDL chỉ có `Todo`/`Done`, không có cột "Đang làm"). `canTick` do BE tính: `canTick('VENDOR', owner)` (`order-tasks.service.ts:32-46`, `task-owner.ts:28`) = chủ việc là `VENDOR` hoặc `BOTH`.
- **Chủ việc `owner`** không lưu trong CSDL, suy từ `task_code` bằng `ownerOf` (`task-owner.ts:19-25`): thuộc `CUSTOMER_CODES` (`DECOR_BRIEF`, `PHOTO_PICK_EDIT`, `PHOTO_REVIEW`, `FLOWER_PICK_STYLE`, `ATTIRE_RETURN`) hoặc `kind = PAYMENT` → **CUSTOMER**; `kind = EVENT` → **VENDOR** (trừ `FLOWER_EVENT` → **BOTH**); các việc chi tiết còn lại và mã lạ → **BOTH**.
- **Nhãn:** `TaskBoard.tsx:29-33`: `CUSTOMER` → "Khách làm", `VENDOR` → "NCC làm", `BOTH` → "Hai bên". Do đó "Đo số đo" và "Thử đồ lần 1" nằm cột **Cần làm** (nhãn "Hai bên"); "Trả trang phục thuê" và "Thanh toán phần còn lại" nằm cột **Chờ khách làm** (nhãn "Khách làm").

### 9.6 Lọc, gom, "Việc của tôi"

- **"Tất cả việc" / "Việc của tôi"** (`VendorCalendarPage.tsx`, nút ở `:203` và `:206`): `mineOnly` lọc phía FE: `!(mineOnly && !t.canTick)` (bảng: `:148`; lịch: `:127`), tức bỏ việc NCC không tick được (`CUSTOMER`); khi bật còn ẩn cả cột "Chờ khách làm" (`hideCustomer={mineOnly}`).
- **"Gom việc": "Theo khách / đơn" | "Không gom"** (`BoardGroup = 'order' | 'none'`, `taskBoard.ts:26`; nút ở `VendorCalendarPage.tsx:216,219`): theo đơn là mỗi đơn một hàng (mỗi hạng mục của một đám cưới chỉ có một đơn đã cọc nên theo khách cũng là theo đơn), sắp hàng có nhiều việc trễ trước, rồi theo ngày thực hiện (`boardLanes`, `taskBoard.ts:71`); "Không gom" là một hàng chung kèm tên khách trên thẻ.
- **Bộ lọc theo khách / đơn:** các chip `picked` (tập `orderId`) lọc `board.data` theo `orderId` (`:148`); ở chế độ bảng chỉ liệt kê đơn `Deposited` (`chipOrders`).

### 9.7 NCC tick hoàn thành một việc

1. FE: bấm ô tick hoặc kéo thẻ từ **Cần làm** sang **Đã xong** (chỉ kéo được việc `canTick`, chỉ giữa hai cột đó: `canMove`, `taskBoard.ts:23`) → `useMoveBoardTask` đổi cột ngay (lạc quan), gọi `PATCH /vendors/me/orders/:orderId/tasks/:taskId { isDone }`.
2. BE `OrderTasksService.setDone` (`:136-`): kiểm đơn thuộc NCC và đang `Deposited` (409 `ORDER_NOT_ACTIVE`), việc thuộc đơn và `task_type = 'Detail'` (404), NCC được tick (403 `TIMELINE_ITEM_READONLY` nếu việc của khách) → `UPDATE timeline_tasks SET status = 'Done'|'Todo', completed_date`. Chuyển cột "Cần làm" ↔ "Đã xong".
3. Khách thấy ngay: cùng dòng `timeline_tasks`; BE gửi sự kiện realtime `task` cho cả khách và NCC (`publish`), `RealtimeBridge.tsx:59-66` tải lại timeline của khách; khi **hoàn thành** (không phải bỏ tick) khách còn nhận thông báo `TaskUpdated` "Nhà cung cấp cập nhật tiến độ". Trên timeline khách việc do NCC làm hiện nhãn "NCC thực hiện / NCC đã cập nhật" và khách không tick được (`TimelineRow.tsx:76,120-123`).

### 9.8 Hạn và "thực hiện"

- "Hạn dd/mm/yyyy" = `timeline_tasks.scheduled_date` đã **lưu** lúc sinh (`board` trả `dueDate`; hiển thị `formatDate(task.dueDate)`, `TaskBoard.tsx:65`); không tính lại khi đọc. Cờ `overdue` tính lúc đọc: `!done && due < todayVn()` (`order-tasks.service.ts:rowOf`).
- Hàm tính: `planDetails` (`timeline-schedule.ts:177`), neo **chủ yếu theo `E`** = ngày thực hiện của đơn; một số việc neo `D` (`VENUE_HALL_CONFIRM` D+2), `S` (nhóm chụp ảnh), `W` (`PHOTO_DELIVERY_PREP` W−7, `PHOTO_EVENT`, `PHOTO_FILES` W+30). Không neo ngày cưới cho hầu hết việc.
- "thực hiện 06/01/2027" trên tiêu đề hàng (`TaskBoard.tsx` `LaneHeader`) lấy `BoardTask.eventDate` = cột **`orders.event_date`** (`board`: `t.orders.event_date` → `ymdOf`). NCC sửa ngày này ở "Chỉnh sửa sau cọc" thì các việc neo E còn Todo được sinh lại (mục 3.5).

### 9.9 Những gì trên màn này phải đổi nếu việc chi tiết lấy từ quy trình gói do NCC khai báo

- **Nguồn dữ liệu:** `OrderTasksService.board` / `calendar` / `list` / `progress` lọc `task_type = 'Detail'` + `order_id` + đơn `Deposited`; cần giữ được hoặc đổi sang nguồn mới (bảng việc của đơn lấy từ quy trình gói tại lúc cọc).
- **Chủ việc / cột:** `owner` và `canTick` hiện suy từ `task_code` qua mẫu (`ownerOf`) nên với việc NCC khai báo phải lưu owner riêng; `columnOf` sẽ đọc `owner` từ dữ liệu thay vì từ mẫu. Cột "Chờ khách làm" chỉ còn ý nghĩa nếu NCC được khai việc của khách (và nếu khách còn tick được, xem rủi ro 4).
- **Hạn:** `scheduled_date` hiện do hệ thống tính bằng mẫu + co giãn; cần quy tắc tính từ khai báo của NCC (neo `E` hay ngày cố định), tính lúc cọc và khi NCC sửa `E`.
- **Nhãn / chức năng gắn mẫu:** `needsMeeting` ("Hẹn với NCC" ở timeline khách), `tentative` (S), `appointmentDate`, nhãn "Hai bên / NCC làm / Khách làm" (`TaskBoard.tsx:29-33`), "Trễ tiến độ", nhắc hạn (`remindersFor`).
- **Gom hàng:** `boardLanes` gom theo `orderId`, vẫn dùng được; nếu một đơn có nhiều gói thì cần quyết định gom theo gói hay đơn.
- **Lịch tháng:** `calendarItems` bỏ việc EVENT trùng ngày đơn dựa vào `templateOf(code).kind` (`calendar-items.ts:63`): cần cách nhận biết mới.
- **Realtime / thông báo:** giữ nguyên nếu vẫn dùng `timeline_tasks` + `order_id`; đổi nếu tách bảng.
- **Ngày thực hiện của đơn:** hàng tiêu đề lấy `orders.event_date`, không đổi.
