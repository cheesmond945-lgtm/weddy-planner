# Lịch bận theo sảnh (Trung tâm tổ chức sự kiện)

Vấn đề: khách chọn một gói (sảnh) của trung tâm tiệc cưới rồi nhắn hỏi, trao đổi xong mới biết hôm đó sảnh đã kín. Mục tiêu: khách thấy sẵn ngày nào sảnh bận ngay trước khi nhắn; hệ thống chặn hai khách đặt cùng sảnh, cùng ngày.

Phạm vi: **chỉ Trung tâm tổ chức sự kiện** (slug `nha-hang`), tính **theo ngày**. Các dịch vụ khác (chụp ảnh, trang điểm, trang phục, trang trí, hoa cưới) có nhiều ekip nên chưa có lịch bận. Mỗi **gói** của trung tâm là **một sảnh**.

## 1. Khi nào sảnh bận

| Nguồn | Điều kiện | Gỡ |
|---|---|---|
| **Đơn** (tự động) | Đơn gắn sảnh (`orders.package_id`) ở trạng thái **Đã cọc** hoặc **Hoàn thành**: sảnh bận vào ngày thực hiện của đơn. Đơn **Chờ cọc chưa tính** (chưa giữ chỗ). | Hủy đơn / đổi ngày, đổi sảnh của đơn |
| **Thủ công** | NCC đánh dấu một hoặc nhiều sảnh bận một ngày hoặc khoảng ngày, kèm lý do (bảo trì, nghỉ, lý do riêng…) | NCC gỡ (cả khoảng của lần đánh dấu đó) |

Luật thuần: `backend/src/modules/halls/hall-busy.ts`; đọc CSDL: `hall-store.ts`.

## 2. Dữ liệu

`backend/prisma/sql/2026-10-31-package-busy-dates.sql` (chạy 31/10/2026, chỉ thêm):
- `orders.package_id` uuid NULL, khóa ngoài `service_packages` (`ON DELETE SET NULL`). Đơn cũ để NULL nên chưa làm sảnh bận; NCC chọn sảnh khi sửa đơn.
- Chỉ mục duy nhất `ux_orders_package_busy (package_id, event_date) WHERE status IN ('Deposited','Completed')`: CSDL chặn hai đơn đã cọc cùng sảnh, cùng ngày.
- Bảng `package_busy_dates (id, package_id, start_date, end_date, reason, created_date)`: mỗi lần NCC đánh dấu một dòng mỗi sảnh; `end_date - start_date <= 366`; lý do bắt buộc; bật RLS như các bảng khác.

## 3. Chặn đặt trùng

| Lúc | Kiểm | Lỗi |
|---|---|---|
| NCC **Gửi / Cập nhật / Tạo lại** đơn | Phải chọn sảnh của mình (gói đang đăng); sảnh không bận ngày thực hiện | `400 VALIDATION_ERROR` (`details.packageId`), `409 HALL_BUSY` |
| NCC **Chỉnh sửa sau cọc** | Đổi sảnh hoặc ngày thì sảnh mới phải trống ngày đó (khóa và kiểm lại trong transaction); giữ nguyên thì không kiểm. Đơn cũ chưa có sảnh: phải chọn | `409 HALL_BUSY` |
| Khách **bấm đặt cọc** | Sảnh không bận ngày thực hiện (chặn trước khi chuyển tiền) | `409 HALL_BUSY` |
| **Ghi nhận cọc** (giả lập, trang quay về VNPay, IPN) | Khóa `pg_advisory_xact_lock('hall:<sảnh>:<ngày>')` rồi kiểm lại; chỉ mục duy nhất là lớp chặn cuối | Không ghi nhận; đã thu tiền thì báo liên hệ hoàn tiền (như `CATEGORY_ALREADY_DEPOSITED`) |

Lời báo: NCC thấy nguồn ("đơn DH… đã đặt cọc", "bạn đã đánh dấu bận: …"); khách chỉ thấy "Sảnh … đã có khách khác đặt cọc ngày …" hoặc "… không nhận tiệc ngày …", không lộ khách, đơn hay lý do.

## 4. API

| Endpoint | Ai | Ý nghĩa |
|---|---|---|
| `GET /vendors/me/halls` | NCC | `{ enabled, halls: [{ id, name, hidden }] }`; `enabled = false` nếu không phải trung tâm sự kiện |
| `GET /vendors/me/busy-dates?from&to` | NCC | `{ enabled, halls, items: [{ packageId, date, source }] }`, `source` = `{ kind: 'ORDER', orderId, orderCode, customerName }` hoặc `{ kind: 'MANUAL', busyId, reason, startDate, endDate }`. Tối đa 100 ngày |
| `POST /vendors/me/busy-dates` | NCC | `{ packageIds, startDate, endDate?, reason }` (bỏ trống `endDate` = một ngày; không đánh dấu ngày đã qua). Trả `{ created, waitingOrders: [{ orderCode, date, hallName }] }`: đơn chờ cọc rơi vào khoảng đó (khách sẽ không cọc được). Lỗi `400 VALIDATION_ERROR` theo trường, `409 HALLS_NOT_SUPPORTED` |
| `DELETE /vendors/me/busy-dates/:id` | NCC | Gỡ một lần đánh dấu; `404 BUSY_DATE_NOT_FOUND` |
| `GET /halls/:packageId/busy?from&to` | Công khai | `{ hall, dates: ["YYYY-MM-DD"] }`: chỉ ngày bận, không nguồn. Gói đang đăng của NCC đã duyệt; `hall = false` nếu không phải trung tâm sự kiện; `404 PACKAGE_NOT_FOUND` |
| `GET /halls/free?date&ids` | Công khai | `{ "<serviceId>": { halls, free } }` cho các trung tâm sự kiện trong `ids` (tối đa 100; NCC khác không có mặt) |

Đơn: `OrderContent.packageId`, `Order.package` (xem [api/orders.md](api/orders.md)). Realtime: tin nhắn kèm đơn (cọc, hủy, sửa) làm mới lịch bận của NCC và lịch sảnh của khách.

## 5. Giao diện

**NCC**
- Form đơn trong chat: ô **Sảnh \*** (gói đang đăng; đơn đang có sảnh đã ẩn vẫn giữ), cảnh báo ngay nếu sảnh bận ngày đã chọn.
- **Lịch làm việc > Lịch bận** (chỉ trung tâm sự kiện): lịch tháng, mỗi sảnh một màu, ô bận ghi nguồn **"Đơn · sảnh"** hoặc **"Thủ công · sảnh"**; ô ngày có sảnh bận **tô đỏ**: đỏ đậm khi mọi sảnh đang xem đều bận (lọc một sảnh thì ngày sảnh đó bận), đỏ nhạt khi còn sảnh trống; ngày đông thì gom "+N sảnh khác"; lọc theo sảnh; danh sách của ngày theo từng sảnh (Trống / Đơn + Xem đơn / Thủ công + **Gỡ bận**); bấm một ngày thì trang tự cuộn tới danh sách đó; nút **Đánh dấu bận** (chọn một hoặc nhiều sảnh, từ ngày đến ngày, lý do).
- Thẻ đơn, chi tiết đơn, hóa đơn hiện tên sảnh.

**Khách**
- Trang chi tiết trung tâm sự kiện: bấm một gói (sảnh) → khung chi tiết gói có **Lịch của sảnh**: lịch tháng hai trạng thái **Bận / Còn trống**; đã có ngày cưới thì đánh dấu và báo "Sảnh này bận / còn trống vào ngày cưới của bạn". Ngày chính khách đã đặt cọc sảnh đó hiện **"Của bạn"** ("Bạn đã đặt cọc sảnh này cho ngày cưới"), không hiện "Bận".
- Khung giá: "Ngày cưới của bạn (dd/mm/yyyy): Còn N/M sảnh trống" hoặc "Tất cả sảnh đã bận".
- Danh sách dịch vụ: thẻ trung tâm sự kiện có nhãn "Còn N sảnh trống ngày cưới" / "Hết sảnh ngày cưới".
- Không lộ tên khách hay chi tiết đơn khác ở bất cứ đâu.

Thay cho "Lịch trống" cấp nhà cung cấp (tính số tiệc cho mọi loại dịch vụ) làm trước đó trên cùng nhánh, chưa merge.

## 6. Dữ liệu thử trên CSDL dùng chung (31/10/2026)

Tạo qua API của app cho **Trống Đồng Palace** (`ncc18@example.com`), mọi bản ghi có chữ **"(dữ liệu thử)"**:

| Loại | Nội dung | Gỡ |
|---|---|---|
| Đơn (nguồn "Đơn") | **DH26100037**, khách `thao.trinh01@example.com` (Lý Gia Đạt & Trịnh Diệu Thảo), Sảnh Hoàng Gia Trắng Vàng, 29/12/2026, 30 bàn, đã cọc giả lập (có giấy xác nhận cọc, tin nhắn, việc chi tiết trên timeline của khách) | Không xóa được trong app: NCC "Hủy đơn" thì sảnh trống lại |
| Bận thủ công | Sảnh Hoa Hồng Màn LED 10–12/11/2026 (bảo trì màn LED); Lễ Đường Ngoài Trời Xanh 20–22/11/2026 (cải tạo bãi cỏ); Sảnh Gỗ Ấm Áp 29/12/2026 (sự kiện riêng); Sảnh New Space Xanh 15/01/2027 (tiệc ngoài hệ thống); cả 5 sảnh 05–09/02/2027 (nghỉ Tết) | Nút **Gỡ bận** ở Lịch làm việc > Lịch bận (bấm vào ngày) |

Xem nhanh: khách `chi.bui12@example.com` (cưới 15/01/2027) thấy "Còn 4/5 sảnh trống" và Sảnh New Space Xanh bận ngày cưới; khách `thao.trinh01@example.com` thấy "Bạn đã đặt cọc Sảnh Hoàng Gia Trắng Vàng". Mật khẩu tài khoản mẫu: xem `HUONG_DAN_CHAY.md`.
