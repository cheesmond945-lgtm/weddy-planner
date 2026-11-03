# Hiện trạng luồng Timeline (đang chạy thật)

Viết ngày 29/10/2026 từ **code thật** (nhánh `Chanh`, chưa commit) và dữ liệu thật trên Supabase (chỉ đọc). Mỗi ý kèm `file:dòng` để kiểm. **⚠️** = code làm khác ý đã chốt, hoặc chưa có quy tắc chốt nên đang chạy theo cách chưa chắc đúng ý.

Đường dẫn gọn: `BE` = `backend/src/modules`, `FE` = `frontend/src/features/weddings`.

Ký hiệu ngày (giữ nguyên như đã chốt): **W** ngày cưới, **I** hôm nay (giờ VN), **L = W − I**, **D** ngày đặt cọc, **E** ngày thực hiện của đơn, **S** ngày chụp album. Mọi ngày trên timeline là **HẠN (muộn nhất)**.

---

## 1. Khách mới nhập thông tin đám cưới

**Khách nhập gì.** Ngày tổ chức, khu vực (thành phố), số khách dự kiến, tổng ngân sách, phong cách (chọn nhiều), và **dịch vụ dự định cần** (chọn nhiều; lần đầu mặc định chọn TẤT CẢ). Form: [WeddingForm.tsx:32-56](../../frontend/src/features/weddings/components/WeddingForm.tsx). Form hiện ra ở hộp "Thiết lập thông tin đám cưới" ngay sau khi đăng nhập mà chưa có thông tin ([useAfterAuth.ts:30-33](../../frontend/src/features/auth/useAfterAuth.ts)), hoặc ở trang Timeline khi chưa có ([TimelinePage.tsx](../../frontend/src/pages/couple/TimelinePage.tsx)). Chặn ở form và ở backend: ngày phải sau hôm nay ([weddings.service.ts:72-73](../../backend/src/modules/weddings/weddings.service.ts)).

**Lưu ở đâu.** `PUT /weddings/me` → `saveMine` ([weddings.service.ts:69-111](../../backend/src/modules/weddings/weddings.service.ts)):
- bảng `weddings`: `wedding_date`, `city`, `guest_count`, `budget`, `style` (dòng 92-101; tên chú rể lấy từ họ tên tài khoản, cô dâu ghi "(chưa cập nhật)");
- bảng `wedding_categories`: mỗi dịch vụ quan tâm một dòng (dòng 106-107). **Đây là nơi DUY NHẤT ghi bảng này** (không code nào khác ghi).

**Timeline khung sinh ra.** Ngay sau khi lưu, `onWeddingCategories` ([timeline-hooks.ts:25-34](../../backend/src/modules/weddings/timeline-hooks.ts), gọi ở [weddings.service.ts:110](../../backend/src/modules/weddings/weddings.service.ts)) sinh các việc khung từ mẫu ([timeline-templates.ts:50-113](../../backend/src/modules/weddings/timeline-templates.ts), 62 mẫu nằm trong code):
- **Việc Chung (Tự làm) LUÔN có**, không phụ thuộc dịch vụ đã chọn: 11 việc ([timeline-schedule.ts:78](../../backend/src/modules/weddings/timeline-schedule.ts): `service === null`).
- **Chỉ dịch vụ đã chọn** mới có: các việc Chọn NCC + 1 Mốc chốt (Chốt …). Nhà hàng, chụp ảnh, trang phục, decor, makeup mỗi dịch vụ 2 Chọn NCC + 1 Mốc chốt; hoa cưới 1 Chọn NCC + 1 Mốc chốt. Chọn đủ 6 dịch vụ thì khung có 28 việc.
- Việc chi tiết (xác nhận sảnh, thử món, …) **KHÔNG sinh ở bước này**, chỉ sinh sau khi đặt cọc (mục 3).

**Cách tính Hạn của việc khung** ([timeline-schedule.ts:21-146](../../backend/src/modules/weddings/timeline-schedule.ts)):
1. Mức theo L ([dòng 21-26](../../backend/src/modules/weddings/timeline-schedule.ts)): L > 270 **Cưới xa**; 81–270 **Bình thường**; 21–80 **Gấp**; ≤ 20 **Rất gấp**; L ≤ 0 thì chặn.
2. Mỗi mẫu có "d" = số ngày trước ngày cưới (ví dụ W−270). Nếu L1 = L − 1 ≥ 270 thì **không ép**, ngày = W − d.
3. Ngược lại ép: K = min(60, max(⌊L1/2⌋, L1 − 20)); d ≤ K giữ nguyên, d > K thì d' = round(K + (d − K) × (L1 − K) / (270 − K)) ([dòng 50-53, 76](../../backend/src/modules/weddings/timeline-schedule.ts)). W−3, W+7, W+30 không bao giờ ép.
4. **Dời cuối tuần** chỉ cho các việc đi gặp / thử (cờ `weekendPreferred`): **chỉ lùi** về T7/CN gần nhất trước hạn; bị chặn (trước I+1, trước/trùng việc trước cùng dịch vụ) thì giữ ngày thường ([dòng 58-61, 128-134](../../backend/src/modules/weddings/timeline-schedule.ts)).
5. **Thứ tự** trong từng dịch vụ: Chọn NCC cách nhau ≥ 1 ngày; Mốc chốt sau Chọn NCC cuối ≥ 1 ngày ([dòng 110-136](../../backend/src/modules/weddings/timeline-schedule.ts)). Không việc nào trước I+1 (bị kẹp về I+1 thì gắn cờ gấp, dòng 100-105).
6. Việc của các dịch vụ khác nhau được trùng ngày, không dàn lại.

**Ví dụ thật.** Khách nhập hôm nay (29/10/2026), cưới sau 120 ngày (W = 26/02/2027, thứ Năm), chọn Nhà hàng + Chụp ảnh. L = 120 → mức Bình thường, K = 60. Sinh ra 17 việc (11 chung + 3 nhà hàng + 3 chụp ảnh), đây là kết quả tính bằng chính hàm `planFrame`:

| Hạn | Thứ | Dịch vụ | Việc | Luật tác động |
|---|---|---|---|---|
| 30/10/2026 | T6 | chung | Thống nhất với hai gia đình… (d=270) | rút ngắn |
| 05/11/2026 | T5 | chung | Lập danh sách khách sơ bộ… (d=250) | rút ngắn |
| 09/11/2026 | T2 | nhà hàng | Lọc và hỏi giá 3–5 nhà hàng (d=235) | rút ngắn |
| 15/11/2026 | CN | nhà hàng | Đi xem sảnh và ăn thử (d=205) | rút ngắn, dời cuối tuần |
| 19/11/2026 | T5 | chụp ảnh | Lọc và hỏi giá 3–5 studio (d=200) | rút ngắn |
| 22/11/2026 | CN | chụp ảnh | Gặp tư vấn studio (d=185) | rút ngắn, dời cuối tuần |
| 24/11/2026 | T3 | nhà hàng | **Chốt nhà hàng** (d=180) | rút ngắn |
| 27/11/2026 | T6 | chụp ảnh | **Chốt chụp ảnh & quay phim** (d=170) | rút ngắn |
| 21/12/2026 | T2 | chung | Chọn và mua nhẫn cưới (d=85) | rút ngắn |
| 28/12/2026 | T2 | chung | Thiết kế, chọn mẫu và đặt in thiệp (d=60) | giữ nguyên |
| 07/01/2027 | T5 | chung | Chuẩn bị lễ ăn hỏi (d=50) | giữ nguyên |
| 17/01/2027 | CN | chung | Đăng ký kết hôn (d=40) | giữ nguyên |
| 27/01/2027 | T4 | chung | Chốt danh sách khách và gửi thiệp mời (d=30) | giữ nguyên |
| 01/02/2027 | T2 | chung | Thuê xe hoa, xe đưa đón (d=25) | giữ nguyên |
| 12/02/2027 | T6 | chung | Lên kịch bản ngày cưới (d=14) | giữ nguyên |
| 23/02/2027 | T3 | chung | Rà soát cuối (d=3) | giữ nguyên |
| 05/03/2027 | T6 | chung | Cảm ơn khách, tổng kết chi phí (W+7) | không ép |

Không việc nào bị cờ "Gấp" vì mức Bình thường. Không có việc chi tiết và không có việc Decor, Trang phục, Makeup, Hoa cưới (khách không chọn).

---

## 2. Khách đổi thông tin

**Đổi ngày cưới (có xem trước).**
- Khi bấm Lưu ở "Chỉnh sửa thông tin" mà ngày đổi, giao diện gọi `POST /weddings/me/timeline/regenerate-preview` ([WeddingDialogs.tsx:114-124](../../frontend/src/features/weddings/components/WeddingDialogs.tsx) → [timeline.service.ts:127-135](../../backend/src/modules/weddings/timeline.service.ts)) và hiện hộp "Đổi ngày cưới sẽ cập nhật hạn của N việc chưa xong" với bảng cũ → mới, cảnh báo đơn có ngày thực hiện khác ngày cưới mới ([DateChangePreviewDialog.tsx](../../frontend/src/features/weddings/components/DateChangePreviewDialog.tsx)). Hủy thì không lưu gì.
- Xác nhận thì `PUT /weddings/me` lưu ngày cưới **và** cập nhật hạn trong **một transaction** ([weddings.service.ts:95-109](../../backend/src/modules/weddings/weddings.service.ts)).
- **Đổi hạn:** chỉ việc khung đang Todo, chưa gắn đơn (tính lại bằng đầy đủ luật co giãn, dời cuối tuần, thứ tự, với W mới và I = hôm nay), và việc neo theo S còn Todo ([replanOnWeddingDateChange, timeline-schedule.ts:278-306](../../backend/src/modules/weddings/timeline-schedule.ts); đọc dữ liệu ở [timeline-hooks.ts:123-168](../../backend/src/modules/weddings/timeline-hooks.ts)).
- **Giữ nguyên:** việc đã Done, việc chi tiết của dịch vụ đã cọc (neo theo E của đơn), việc khách tự thêm. Đơn Deposited có E khác ngày cưới mới chỉ **cảnh báo** kèm nút "Nhắn NCC".
- Ghi chú: việc khung Todo quá hạn cũng được tính lại từ hôm nay (I = hôm nay, không phải ngày tạo).

**Thêm dịch vụ quan tâm.** Có sinh thêm việc: `saveMine` xóa và ghi lại `wedding_categories`, rồi `onWeddingCategories` chỉ **chèn việc chưa có** (theo `task_code`), không bao giờ dời việc cũ ([timeline-hooks.ts:30-33](../../backend/src/modules/weddings/timeline-hooks.ts)). Ngày của dịch vụ mới tính với **I = hôm nay** và W hiện tại (nên bị ép theo L lúc thêm, không theo ngày khách đăng ký lần đầu).

**Bỏ dịch vụ quan tâm. ⚠️ Chưa có xử lý nào.** `saveMine` chỉ xóa và ghi lại `wedding_categories` ([weddings.service.ts:106-107](../../backend/src/modules/weddings/weddings.service.ts)); **không code nào xóa việc khung của dịch vụ bị bỏ**, và **không chặn** khi dịch vụ đó đã có đơn cọc. Hậu quả: việc Chọn NCC / Mốc chốt của dịch vụ vừa bỏ vẫn nằm trong timeline (timeline đọc theo `timeline_tasks`, không theo `wedding_categories`, [timeline.service.ts:41-70](../../backend/src/modules/weddings/timeline.service.ts)). Dữ liệu hiện tại chưa có ca này (kiểm tra mục 7-G), nhưng code cho phép.

---

## 3. Khách đặt cọc

Luồng: khách bấm đặt cọc → `createDeposit` ([orders.service.ts:250](../../backend/src/modules/orders/orders.service.ts)) → ghi nhận cọc `markDepositPaid` ([orders.service.ts:338-380](../../backend/src/modules/orders/orders.service.ts); cả đường thử và VNPay) → `onOrderDeposited` ([timeline-hooks.ts:73-85](../../backend/src/modules/weddings/timeline-hooks.ts)).

**Chặn trước khi cọc:** mỗi hạng mục tối đa MỘT đơn Deposited cùng lúc. Khách cọc đơn thứ hai cùng hạng mục, hoặc NCC gửi / tạo lại đơn khi hạng mục đã có đơn Deposited, đều trả `409 CATEGORY_ALREADY_DEPOSITED` ([orders.service.ts:105-120, 274-275, 347-350, 480-481, 511-512](../../backend/src/modules/orders/orders.service.ts)). Cả hai khoản cọc song song bị khóa theo (đám cưới, hạng mục) ở dòng 347.

**Dịch vụ CÓ trong danh sách quan tâm (đã có khung):**
1. Mốc chốt của dịch vụ chuyển Todo → **Done** (`completed_date` = lúc cọc) ([timeline-hooks.ts:77-80](../../backend/src/modules/weddings/timeline-hooks.ts)).
2. Sinh các việc chi tiết của dịch vụ, **gắn `order_id`** ([syncOrderDetails, timeline-hooks.ts:39-71](../../backend/src/modules/weddings/timeline-hooks.ts) → [depositDetailPlan, timeline-rows.ts:85-93](../../backend/src/modules/weddings/timeline-rows.ts)).
3. Hạn tính từ D (ngày cọc thật, lấy từ `payments.paid_date`) và E (ngày thực hiện của đơn) ([planDetails, timeline-schedule.ts:177-235](../../backend/src/modules/weddings/timeline-schedule.ts)):
   - việc dạng E − x co theo hệ số min(1, (E − (D + k)) / x_max), k = 2 (nhà hàng, chụp ảnh, decor, hoa cưới) hoặc 3 (trang phục, makeup) ([dòng 183-190](../../backend/src/modules/weddings/timeline-schedule.ts));
   - không còn chỗ (E − (D + k) ≤ 0) thì dồn vào max(I + 1, D + 1) và gắn cờ gấp ([dòng 203-209](../../backend/src/modules/weddings/timeline-schedule.ts));
   - các việc cần gặp / thử (đo số đo, thử món, thử đồ, makeup thử) được dời về T7/CN gần nhất trước hạn (chỉ lùi, bị chặn thì giữ ngày thường); ngày thực hiện = E; thanh toán còn lại = E + 7.

**Dịch vụ KHÔNG có trong danh sách quan tâm. ⚠️ Chưa có quy tắc chốt, code đang xử lý như sau:**
- Cọc vẫn thành công. `markDepositPaid` thêm NCC vào **kế hoạch** (`plan_vendors`, [dòng 359](../../backend/src/modules/orders/orders.service.ts)) nhưng **không thêm** vào `wedding_categories` (chỉ `saveMine` ghi bảng này).
- **Có việc con:** `syncOrderDetails` sinh việc chi tiết gắn đơn cho bất kỳ hạng mục nào có trong mẫu, không kiểm tra danh sách quan tâm ([timeline-hooks.ts:39-71](../../backend/src/modules/weddings/timeline-hooks.ts)).
- **Không có thẻ "Chốt …"**: vì khung của dịch vụ đó chưa từng được sinh (không có Chọn NCC, không có Mốc chốt), `updateMany` ở dòng 77-80 không có dòng nào để đánh dấu xong.
- **Hiện ở hai cách xem:** THEO THỜI GIAN: việc con hiện bình thường, có tên dịch vụ ở dòng hạn ([TimelineView.tsx:255-271](../../frontend/src/features/weddings/components/TimelineView.tsx)), nhưng không có thẻ Mốc chốt. THEO DỊCH VỤ: vì không có Mốc chốt để gom nên việc con **hiện rời như việc thường**, không có thẻ nhóm, không có tiến độ ([TimelineView.tsx:126-129](../../frontend/src/features/weddings/components/TimelineView.tsx)). Trang Kế hoạch vẫn liệt kê hạng mục này (hợp của `wedding_categories` và NCC trong kế hoạch, [weddings.service.ts:209-212](../../backend/src/modules/weddings/weddings.service.ts)).
- Hiện tại không có đám cưới nào rơi vào ca này (mục 7-A).

**Cọc nhiều dịch vụ ở các thời điểm khác nhau.** Mỗi lần cọc chỉ **thêm** việc của dịch vụ đó; ngày việc đã sinh của dịch vụ cọc trước **không đổi** ([depositDetailPlan chỉ xóa việc Todo của đơn khác CÙNG hạng mục, timeline-rows.ts:85-93](../../backend/src/modules/weddings/timeline-rows.ts)). Có test cọc 6 dịch vụ ở 6 thời điểm ([timeline-rows.test.ts](../../backend/test/timeline-rows.test.ts)). Việc của các dịch vụ khác nhau được trùng ngày (ví dụ 5 dịch vụ cùng có ngày thực hiện trùng ngày cưới).

**Ngày chụp album S và việc "Tạm tính".**
- S mặc định = D(chụp ảnh) + 23, không muộn hơn W − 35, không sớm hơn D + 2 ([defaultAlbumDate, timeline-schedule.ts:148-152](../../backend/src/modules/weddings/timeline-schedule.ts)). Nếu buổi chụp đã có thì dùng đúng ngày đó ([timeline-hooks.ts:51-58](../../backend/src/modules/weddings/timeline-hooks.ts)); trang phục cọc trước khi chụp ảnh cọc thì S tạm tính theo ngày cọc trang phục ([dòng 184](../../backend/src/modules/weddings/timeline-schedule.ts)) và việc "Nhận trang phục cho buổi chụp album" **không bao giờ** được tính lại.
- Việc neo theo S hiện chữ **"· Tạm tính"** ([timeline.service.ts:110](../../backend/src/modules/weddings/timeline.service.ts), [TimelineRow.tsx:113](../../frontend/src/features/weddings/components/TimelineRow.tsx)).
- **⚠️** "Tạm tính" **không bao giờ mất cho tới khi việc được tick xong**, vì cột Ngày hẹn chưa có (`appointmentDate` luôn `null`, [timeline.service.ts:112](../../backend/src/modules/weddings/timeline.service.ts)); luật "khách nhập Ngày hẹn thì S = ngày đó và chỉ tính lại việc của dịch vụ chụp ảnh" mới có hàm `replanAlbumTasks` ([timeline-schedule.ts:250](../../backend/src/modules/weddings/timeline-schedule.ts)), **chưa nối vào giao diện / API**.

---

## 4. NCC hủy đơn đã cọc

Chỉ NCC hủy được, chỉ khi đơn Deposited và hôm nay còn trước E ([orders.service.ts:686-715](../../backend/src/modules/orders/orders.service.ts)); gọi `onOrderCancelled` ([dòng 702](../../backend/src/modules/orders/orders.service.ts)).

- **Việc con:** gỡ MỌI việc chi tiết gắn với đơn đó, **kể cả việc đã xong**; dịch vụ khác không đổi ([cancelPlan, timeline-rows.ts:110-113](../../backend/src/modules/weddings/timeline-rows.ts); xóa ở [timeline-hooks.ts:87-108](../../backend/src/modules/weddings/timeline-hooks.ts)).
- **Mốc chốt:** về Todo, **nếu không còn đơn nào khác cùng hạng mục ở trạng thái Deposited hoặc Completed** (đơn Completed vẫn giữ Mốc chốt xong, đúng ý đã chốt). Còn đơn Deposited khác thì đơn cọc mới nhất nhận lại việc chi tiết.
- **Dòng "Đơn {mã} với {NCC} đã hủy ngày d/m":** hiện trên thẻ Mốc chốt đang Todo; lấy đơn **đã từng cọc** bị hủy gần nhất cùng hạng mục ([timeline.service.ts:58-62, 118](../../backend/src/modules/weddings/timeline.service.ts); vẽ ở [TimelineRow.tsx:122-126](../../frontend/src/features/weddings/components/TimelineRow.tsx)).
- **Nút "Gợi ý {dịch vụ} →"** hiện trên Mốc chốt đang Todo có dòng "đã hủy" ([suggestOf, timeline-templates.ts:136-142](../../backend/src/modules/weddings/timeline-templates.ts)); nhóm quay lại thẻ Mốc chốt thường với dòng ổ khóa "N việc chi tiết mở sau khi bạn đặt cọc" ([TimelineRow.tsx:128-132](../../frontend/src/features/weddings/components/TimelineRow.tsx)).
- **Thông báo cho khách** (loại `OrderCancelled` có sẵn): "Đơn {mã} đã bị nhà cung cấp hủy. Lý do: …. Các việc chi tiết của dịch vụ {dịch vụ} đã được gỡ khỏi timeline." ([orders.service.ts:711-716](../../backend/src/modules/orders/orders.service.ts)). Câu này luôn nói "đã gỡ" kể cả khi đơn khác nhận lại việc (ca hiếm, giờ không còn xảy ra vì luật một đơn Deposited mỗi hạng mục).
- **Cọc lại với NCC khác:** quy trình như mục 3 (sau khi đơn cũ bị hủy mới cọc được). Mốc chốt thành Done, việc con sinh mới theo D, E mới, dòng "đã hủy" và nút Gợi ý trên Mốc chốt biến mất (vì chỉ hiện khi Mốc chốt đang Todo, [timeline.service.ts:118](../../backend/src/modules/weddings/timeline.service.ts)). Có test cọc → hủy → cọc lại.

---

## 5. Đơn hoàn thành / tự hoàn thành

**⚠️ Timeline KHÔNG thay đổi gì.** `completeOrder` và `autoComplete` ([order-lifecycle.ts:67-84, 87-](../../backend/src/modules/orders/order-lifecycle.ts)) chỉ đổi trạng thái đơn, tính hoa hồng, gửi tin và thông báo. Không có dòng code nào ngoài thư mục `weddings/` đụng `timeline_tasks`. Hệ quả: Mốc chốt vẫn Done; các việc chi tiết vẫn giữ trạng thái cũ (hiện **127 việc chi tiết của đơn Completed còn Todo**, đã quá hạn). Chưa có quy tắc chốt về việc này; đơn hết hạn cọc (Expired) cũng không đụng timeline (đúng vì chưa từng cọc).

---

## 6. Giao diện

**Hai cách xem: CÓ, đang chạy.** Sub tab `SegmentedTabs` ([TimelineView.tsx:244-254](../../frontend/src/features/weddings/components/TimelineView.tsx), [SegmentedTabs.tsx](../../frontend/src/components/SegmentedTabs.tsx)); mặc định THEO THỜI GIAN, nhớ trong `localStorage` ([dòng 29-45](../../frontend/src/features/weddings/components/TimelineView.tsx)). Dòng phụ: "{n} việc" và "{m} dịch vụ" theo bộ lọc. Lưu ý: component này tôi dựng mới theo ảnh bạn gửi (không tìm thấy sub tab "Ví chung / Chú rể / Cô dâu" trong repo để tái dùng).
- **THEO THỜI GIAN** ([TimelineView.tsx:255-271](../../frontend/src/features/weddings/components/TimelineView.tsx), [timelineGroups.ts](../../frontend/src/features/weddings/timelineGroups.ts)): danh sách phẳng mọi việc (khung + việc con + việc tự thêm), sắp theo Hạn, chia theo tháng, việc quá hạn vào nhóm "Quá hạn" trên cùng; việc con có tên dịch vụ ở dòng hạn; Mốc chốt là thẻ thường (đã cọc: "✓ Đã chốt · NCC").
- **THEO DỊCH VỤ** ([TimelineView.tsx:272-292](../../frontend/src/features/weddings/components/TimelineView.tsx), [TimelineGroupCard.tsx](../../frontend/src/features/weddings/components/TimelineGroupCard.tsx)): Mốc chốt đã cọc là thẻ nhóm, bấm để xổ việc con, có tiến độ "Đã xong x/N", "Tiếp theo: …", chấm đỏ khi có việc con quá hạn; mở sẵn khi có việc con quá hạn hoặc trong 14 ngày tới ([TimelineGroupCard.tsx:31-36](../../frontend/src/features/weddings/components/TimelineGroupCard.tsx)); trạng thái xổ / thu nhớ trong phiên (`sessionStorage`). Mốc chốt chưa cọc là thẻ riêng.

**Nút "Gợi ý {dịch vụ} →"** ([TimelineRow.tsx:74, 138](../../frontend/src/features/weddings/components/TimelineRow.tsx); cờ do backend trả, [timeline.service.ts:120](../../backend/src/modules/weddings/timeline.service.ts)): chỉ ở **việc Chọn NCC đầu tiên của mỗi dịch vụ** (cờ `showSuggest` trong mẫu: lọc và hỏi giá nhà hàng, studio, "Quyết định thuê hay may đo", decor, makeup, tiệm hoa); việc đó tick xong nút vẫn ở trên thẻ đó ở tab Đã xong. Ngoại lệ: Mốc chốt đang Todo có dòng "đã hủy". Bấm đi tới **trang dịch vụ lọc đúng lĩnh vực** (`/?category=slug`). Không còn nút "Nhắn NCC đang trao đổi".

**Nút "Hẹn với NCC"** ([TimelineRow.tsx:146-149](../../frontend/src/features/weddings/components/TimelineRow.tsx), cờ `needsMeeting` ở [timeline.service.ts:111](../../backend/src/modules/weddings/timeline.service.ts)): chỉ ở 8 **việc chi tiết** sau khi cọc: Xác nhận sảnh, khung giờ; Thử món; Chốt concept, lịch chụp album; Đo số đo, chốt mẫu; Thử đồ lần 1; Thử lần cuối; Makeup thử chính thức; Duyệt phối cảnh. Bấm → mở đúng hội thoại với NCC của đơn, câu nhắn điền sẵn "Chào shop, mình muốn hẹn lịch {việc} trước {hạn}, bên mình tiện ngày nào ạ?", **chưa tự gửi** ([TimelineView.tsx:202-213](../../frontend/src/features/weddings/components/TimelineView.tsx) → [planActions.tsx](../../frontend/src/features/weddings/planActions.tsx) `openChat`). **⚠️** Bước sau đó "khách nhập Ngày hẹn" **chưa có** (chờ cột `appointment_date`).

**Bộ lọc, xác nhận, hoàn tác.**
- Bộ lọc Chưa xong (mặc định) / Đã xong / Tất cả: [TimelineView.tsx:23-27, 228-233](../../frontend/src/features/weddings/components/TimelineView.tsx); `?category=` lọc theo hạng mục (chip "Đang xem: …").
- Bấm thẻ hoặc ô tick mở hộp "Chúc mừng bạn!" (ĐÓNG / HOÀN THÀNH) ([TimelineRow.tsx:88-95](../../frontend/src/features/weddings/components/TimelineRow.tsx), [TimelineConfirmDialogs.tsx](../../frontend/src/features/weddings/components/TimelineConfirmDialogs.tsx)). Bấm nút trong thẻ không mở hộp. Thẻ trượt ra, toast "Đã chuyển sang Đã xong · Hoàn tác" 5 giây ([TimelineView.tsx:186-196](../../frontend/src/features/weddings/components/TimelineView.tsx)); tick cập nhật ngay trên giao diện rồi mới đồng bộ ([hooks.ts:66-76](../../frontend/src/features/weddings/hooks.ts)). Tab Đã xong: ✓ xanh, gạch ngang, nút ↺ (hỏi lại trước khi đưa về).
- **Mốc chốt không tick tay** (tooltip "Tự hoàn thành khi bạn đặt cọc cho nhà cung cấp", [TimelineRow.tsx:168-175](../../frontend/src/features/weddings/components/TimelineRow.tsx); backend cũng chặn, [timeline.service.ts:174](../../backend/src/modules/weddings/timeline.service.ts)).
- **Khối khóa:** không còn thẻ khóa riêng. Mốc chốt chưa cọc là một thẻ có dòng ổ khóa "N việc chi tiết mở sau khi bạn đặt cọc" ([TimelineRow.tsx:128-132](../../frontend/src/features/weddings/components/TimelineRow.tsx), số N từ [timeline.service.ts:24, 116](../../backend/src/modules/weddings/timeline.service.ts)).
- **Cờ "· Gấp"** ([TimelineRow.tsx:112](../../frontend/src/features/weddings/components/TimelineRow.tsx)): chỉ khi việc bị kẹp về I+1 / không xếp được, hoặc đám cưới ở mức Gấp / Rất gấp VÀ việc bị ép > 50% ([timeline-schedule.ts:88-93](../../backend/src/modules/weddings/timeline-schedule.ts); backend tính lại khi đọc, [timeline.service.ts:26-38, 67-78](../../backend/src/modules/weddings/timeline.service.ts)). Việc quá hạn chỉ tô đỏ chữ "Hạn", không thêm "Gấp".
- **Banner mức gấp** ([TimelineView.tsx:66-80, 223](../../frontend/src/features/weddings/components/TimelineView.tsx)): mức Gấp hiện "Còn N ngày… thời gian chuẩn bị khá gấp"; Rất gấp hiện "Thời gian chuẩn bị rất ngắn, ưu tiên chốt các dịch vụ chính trước". Mức Bình thường / Cưới xa không có banner.

**Việc khách tự thêm.** Thêm bằng nút "Thêm việc" (tên + hạn từ hôm nay tới trước ngày cưới, [TimelineDialogs.tsx:91-](../../frontend/src/features/weddings/components/TimelineDialogs.tsx), kiểm tra ở [timeline.service.ts:143-157](../../backend/src/modules/weddings/timeline.service.ts)). Sửa tên + hạn và xóa được, icon hiện khi rê chuột ([TimelineRow.tsx:151-160](../../frontend/src/features/weddings/components/TimelineRow.tsx), [TimelineDialogs.tsx:18-80](../../frontend/src/features/weddings/components/TimelineDialogs.tsx)). Việc từ mẫu **không xóa được** ([timeline.service.ts:182-184](../../backend/src/modules/weddings/timeline.service.ts)) và giao diện không cho đổi tên / hạn; ⚠️ nhỏ: API `PATCH` vẫn cho đổi hạn của việc từ mẫu ([timeline.service.ts:172](../../backend/src/modules/weddings/timeline.service.ts)), chỉ là giao diện không hiện nút.

---

## 7. Dữ liệu trên Supabase (đọc lúc viết tài liệu)

- **Bảng timeline đang dùng:** `timeline_tasks` (cột: `id, wedding_id, category_id, order_id, title, scheduled_date, status, completed_date, task_type, task_code, display_order, created_date`). **KHÔNG có cột mới** so với đầu đợt (đã SELECT `information_schema`: không có `appointment_date`). Cùng với `weddings`, `wedding_categories`, `plan_vendors`, `orders`, `payments` (chỉ đọc).
- **Mẫu timeline nằm ở đâu:** trong code, [timeline-templates.ts:50-113](../../backend/src/modules/weddings/timeline-templates.ts) (62 mẫu), **không có bảng mẫu** trên CSDL.
- **Số liệu:** 13 đám cưới (đều có ngày cưới); 522 việc = 301 việc khung + 201 việc chi tiết + 20 việc khách tự thêm (không mã); 54 việc đã Done.
- **Kiểm tra lệch quy tắc:**

| Kiểm tra | Kết quả |
|---|---|
| A. Đơn Deposited/Completed thuộc dịch vụ KHÔNG nằm trong danh sách quan tâm | 0 |
| B. Việc chi tiết không có Mốc chốt cùng hạng mục | 0 |
| C. Mốc chốt Done mà không có đơn Deposited/Completed | 0 |
| D. Mốc chốt Todo mà đã có đơn Deposited | 0 |
| E. Việc chi tiết gắn với đơn Cancelled/Expired/Draft/Pending | 0 |
| F. Đơn Deposited thiếu việc chi tiết | 0 (13 đơn Deposited đều có việc, 4–8 việc mỗi đơn) |
| G. Khung của dịch vụ đã bỏ khỏi danh sách quan tâm | 0 |
| Trùng mã (đám cưới, `task_code`) | 0 (có UNIQUE trên bảng) |
| Mã không thuộc mẫu mới (timeline cũ) | 0 |
| Đám cưới không có việc Chung | 0 |
| Khách có >1 đơn Deposited cùng hạng mục | 0 |

- **Điểm lệch / bất thường tìm thấy:**
  1. **⚠️ thao.trinh01, đơn DH26100018 (Deposited):** ngày thực hiện nhập **22/02/2222** nên 5 việc chi tiết Decor có hạn từ 09/12/2221 tới 01/03/2222 (đám cưới 16/08/2026). Logic đúng, dữ liệu đơn sai; hệ thống chưa chặn ngày thực hiện xa ngày cưới.
  2. **chi.bui12:** việc khách tự thêm "Gửi thiệp mời" hạn 19/03/2027, sau ngày cưới hiện tại 15/01/2027 (việc tự thêm được giữ nguyên khi đổi ngày cưới, đúng thiết kế).
  3. **5 đám cưới đã qua ngày cưới** (trang.ly05, thao.trinh01, giang.mai02, nga.ngo03, linh.pham04) còn tổng **224 việc Todo quá hạn**. Toàn hệ thống có **316 việc Todo quá hạn** (148 việc chi tiết), trong đó **127 việc chi tiết thuộc đơn Completed** vẫn Todo (xem mục 5).

---

## 8. Tóm tắt cuối

| Tình huống | Hiện tại làm gì | Đúng ý đã chốt? | Cần sửa gì |
|---|---|---|---|
| Khách mới nhập thông tin | Lưu `weddings` + `wedding_categories`; sinh khung: 11 việc Chung (luôn có) + Chọn NCC/Mốc chốt của dịch vụ đã chọn | ✅ | Không |
| Cách tính Hạn khung (L, co giãn, cuối tuần chỉ lùi, thứ tự) | Đúng công thức đã chốt, khớp sheet ví dụ (61/62 dòng + các dòng đổi theo luật) | ✅ | Không |
| Đổi ngày cưới | Xem trước cũ → mới; xác nhận lưu + cập nhật hạn trong 1 transaction; chỉ đổi việc khung Todo chưa gắn đơn và việc theo S; giữ việc Done, việc con, việc tự thêm | ✅ | Không |
| Thêm dịch vụ quan tâm | Chèn thêm việc khung của dịch vụ mới (I = hôm nay), không dời việc cũ | ✅ | Chỉ cần xác nhận: ngày tính theo hôm nay chứ không theo ngày đăng ký ban đầu |
| Bỏ dịch vụ quan tâm | Chỉ sửa danh sách; việc khung của dịch vụ đó vẫn nằm trong timeline; không chặn khi đã cọc | ⚠️ | Chốt: có chặn khi đã cọc không, và có xóa việc khung Todo của dịch vụ bị bỏ không |
| Cọc dịch vụ CÓ trong danh sách quan tâm | Mốc chốt → Done, sinh việc con theo D/E, gắn đơn | ✅ | Không |
| Cọc dịch vụ KHÔNG có trong danh sách quan tâm | Có việc con, không có thẻ Chốt, không gom thành nhóm (hiện rời), không tự thêm vào `wedding_categories` | ⚠️ | Chốt: tự thêm dịch vụ vào danh sách quan tâm và sinh khung + Mốc chốt (đã Done), hay chặn |
| Cọc nhiều dịch vụ ở nhiều thời điểm | Ngày việc dịch vụ trước không đổi; việc các dịch vụ được trùng ngày; có test | ✅ | Không |
| Mỗi hạng mục tối đa 1 đơn Deposited | Chặn 409 ở khách cọc, NCC gửi, NCC tạo lại đơn; khóa chống cọc song song | ✅ | Không (dữ liệu hiện 0 ca lệch) |
| Ngày chụp album S | Mặc định D + 23 (≤ W − 35, ≥ D + 2); việc "Nhận trang phục" không tính lại | ✅ | Không |
| Việc "Tạm tính" | Hiện cho tới khi tick xong; không có cách chốt vì chưa có Ngày hẹn | ⚠️ | Chạy SQL `appointment_date` rồi làm ô nhập Ngày hẹn, nối `replanAlbumTasks` |
| NCC hủy đơn đã cọc | Gỡ mọi việc con (kể cả đã xong), Mốc chốt về Todo (trừ khi còn đơn Deposited/Completed khác), dòng "đã hủy", nút Gợi ý, thông báo | ✅ | Không |
| Cọc lại với NCC khác | Việc con sinh mới theo D/E mới; dòng "đã hủy" mất | ✅ | Không |
| Đơn hoàn thành / tự hoàn thành | Timeline không đổi: việc con vẫn Todo (127 việc quá hạn) | ⚠️ | Chốt: có tự tick xong việc con khi đơn Completed không |
| Hai cách xem | Có: THEO THỜI GIAN (phẳng, theo tháng, "Quá hạn") và THEO DỊCH VỤ (nhóm) | ✅ | Sub tab là component mới (không tìm thấy bản "Ví chung / Chú rể / Cô dâu" để dùng lại) |
| Nút Gợi ý | Chỉ ở việc Chọn NCC đầu tiên của dịch vụ (+ Mốc chốt Todo có "đã hủy"); sang trang dịch vụ lọc đúng lĩnh vực | ✅ | Không |
| Nút Hẹn với NCC | Ở 8 việc chi tiết; mở đúng hội thoại, câu nhắn điền sẵn, chưa tự gửi | ✅ (nút) / ⚠️ (nhập Ngày hẹn) | Làm ô nhập Ngày hẹn sau khi có cột |
| Bộ lọc, xác nhận hoàn thành, hoàn tác, khối khóa, cờ Gấp, banner | Đúng như đã chốt | ✅ | Không |
| Việc khách tự thêm | Thêm / sửa tên, hạn / xóa được; việc mẫu không xóa | ✅ | (nhỏ) cân nhắc chặn đổi hạn việc mẫu ở API |
| Dữ liệu thật | 13 đám cưới, 522 việc, 0 lệch cấu trúc, không có cột mới | ⚠️ | Đơn DH26100018 của thao.trinh01 có ngày thực hiện 2222 → sửa ngày đơn rồi chạy lại việc sinh chi tiết; cân nhắc chặn ngày thực hiện sau ngày cưới |

### Việc đang làm dở / chưa commit

**Chưa commit (toàn bộ đợt này):**
- Sửa: `backend/.gitignore`, `backend/package.json`, `backend/tsconfig.json`; `orders/order-rules.ts`, `orders/orders.service.ts`; `weddings/timeline-hooks.ts`, `timeline.service.ts`, `weddings.controller.ts`, `weddings.service.ts`; docs `CHOT_NGHIEP_VU_NCC.md`, `LUONG_CHAT_DON_HANG.md`, `api/THE_DON_HANG.md`, `api/orders.md`, `api/payments.md`; frontend `api/weddings.ts`, `components/ui/toast.tsx`, `TimelineRow.tsx`, `TimelineView.tsx`, `WeddingDialogs.tsx`, `hooks.ts`, `planActions.tsx`, `types/wedding.ts`.
- Mới: `backend/src/modules/weddings/timeline-{templates,schedule,rows}.ts`, `backend/scripts/` (rebuild, repair, restore), `backend/prisma/sql/2026-10-29-timeline-appointment-date.sql`, 4 file test backend, frontend `SegmentedTabs.tsx`, `DateChangePreviewDialog.tsx`, `TimelineConfirmDialogs.tsx`, `TimelineGroupCard.tsx`, `timelineGroups.ts` (+ test), `docs/TIMELINE.md`, `docs/timeline/`, `docs/prototype/timeline/` (ảnh).
- Thay đổi cấu hình: `rewriteRelativeImportExtensions` trong `backend/tsconfig.json` (để test chạy bằng Node), script `test`, `timelines:*` trong `backend/package.json`.
- Bản sao lưu timeline cũ nằm ở `backend/scripts/backup/` (đã ignore, không commit).

**Đang chờ quyết định / người khác:**
1. Chạy SQL `backend/prisma/sql/2026-10-29-timeline-appointment-date.sql` (chưa chạy) → rồi mới thêm cột vào `schema.prisma`, API và ô nhập Ngày hẹn.
2. Sửa `purge` trong `weddings.service.ts` (xóa hội thoại, tin nhắn, đơn khi thay / bỏ NCC trong kế hoạch): đang chờ bạn hỏi người viết; đã ghi quy tắc "không dùng replace:true để dọn test" vào `docs/LUONG_CHAT_DON_HANG.md` (quy tắc 10).
3. Bốn điểm chốt ⚠️ ở bảng trên (bỏ dịch vụ quan tâm, cọc dịch vụ ngoài danh sách, đơn hoàn thành, Tạm tính).
4. `docs/CHOT_NGHIEP_VU_NCC.md` mục 7 và `docs/database.md` mục 9.9 chưa viết lại theo mẫu timeline mới (mới có `docs/TIMELINE.md`).
5. Dữ liệu: đơn DH26100018 (thao.trinh01) ngày 2222; chưa chạy `--apply` cho `timelines:repair` (không cần: 0 đơn thiếu việc).
6. Lỗi `send` khi tạo đơn đã sửa (chưa commit); các đơn tạo từ 28/10 17:36 có thể bị lưu sai (đã liệt kê cho bạn).
