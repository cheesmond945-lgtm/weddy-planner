# Thẻ đơn dịch vụ trong chat: nội dung và nút theo trạng thái

> Dựa trên `docs/database.md` (bảng Orders, OrderItems, OrderRevisions, OrderRevisionChanges, Payments, Invoices, Messages; mục 9.5–9.7).
> Mục tiêu: **khách và NCC nhìn thấy cùng một nội dung đơn**, chỉ khác nút thao tác theo vai trò.

---

## 1. Nguyên tắc chung

1. **Một thẻ, hai vai trò.** Thẻ đơn đọc dữ liệu trực tiếp từ `Orders` (không lưu bản chụp), nên khách và NCC luôn thấy cùng số liệu. Chỉ khác: **nút** và **một dòng gợi ý việc cần làm**.
2. **Chỉ hiển thị dữ liệu có trong CSDL.** Không có "Đã thu thực tế", "Còn phải thu", "Thanh toán & điều chỉnh", số phiên bản v1/v2. Phần còn lại trả bằng tiền mặt ngoài hệ thống, coi là đã thu khi đơn Hoàn thành.
3. **Thẻ đơn xuất hiện khi NCC gửi đơn** (`Messages.Type = Order`, `Messages.OrderId`). Bản nháp (`Draft`) không tạo tin nhắn, khách không thấy.
4. **Gửi lại sau khi sửa** tạo thêm một thẻ mới. Các thẻ cũ của cùng đơn thu gọn thành một dòng: "Đơn {OrderCode} đã được cập nhật, xem bản mới nhất bên dưới".
5. Tiền do backend tính (`Amount`, `TotalAmount`, `DepositAmount`); giao diện chỉ hiển thị.

---

## 2. Nội dung thẻ (giống nhau cho khách và NCC)

| Thứ tự | Nhãn hiển thị | Lấy từ | Ghi chú |
|---|---|---|---|
| 1 | **Đơn dịch vụ {OrderCode}** + badge trạng thái | `Orders.OrderCode`, `Orders.Status` | Badge theo bảng mục 3 |
| 2 | Dòng phụ: tên bên kia | Khách thấy tên NCC (`VendorProfiles.BusinessName`); NCC thấy `Orders.CustomerName` | |
| 3 | **Hạng mục** | `OrderItems`: `ItemName` — `Quantity` `Unit` × `UnitPrice` = `Amount` | Thẻ hiện tối đa 2 dòng + "và N hạng mục khác"; chi tiết hiện đủ |
| 4 | **Ngày thực hiện** | `Orders.EventDate` | |
| 5 | **Tổng giá trị** | `Orders.TotalAmount` | |
| 6 | **Đặt cọc ({DepositPercent}%)** | `Orders.DepositAmount` | Kèm "qua VNPay" |
| 7 | **Còn lại** | `TotalAmount − DepositAmount` | Kèm "(tiền mặt, thanh toán trực tiếp cho NCC)" |
| 8 | **Hạn đặt cọc** | `Orders.DepositDueDate` | Chỉ khi `Pending`: "Hạn cọc: 21:00 26/10 · còn 5 giờ" |
| 9 | **Dòng trạng thái tiền** | `Payments.Status`, `PaidDate` | `Paid`: "Đã thanh toán cọc {DepositAmount} · {PaidDate}" (xanh). `Unpaid`: không hiện |
| 10 | **Ghi chú của NCC** | `Orders.Note` | Ẩn nếu rỗng |
| 11 | Nút | Theo mục 4 | |

### Màn "Xem chi tiết" (mở từ nút trên thẻ, cũng giống nhau cho hai bên)

- Tất cả trường ở trên, cộng thêm: `CustomerName`, `CustomerPhone`, ngày tạo (`CreatedDate`).
- **Bảng hạng mục đầy đủ**: STT, Hạng mục, Đơn vị tính, Số lượng, Đơn giá, Thành tiền, dòng Tổng.
- **Lịch thanh toán 2 đợt cố định** (chỉ hiển thị, theo CSDL 9.6):

| Đợt | Tên | Số tiền | Hạn | Phương thức | Trạng thái |
|---|---|---|---|---|---|
| 1 | Đặt cọc | `DepositAmount` ({DepositPercent}%) | `DepositDueDate` | VNPay | Chưa cọc / Đã cọc {PaidDate} |
| 2 | Thanh toán phần còn lại | `TotalAmount − DepositAmount` | `EventDate` (trả muộn tới +7 ngày) | Tiền mặt cho NCC | "Thu khi hoàn thành" / "Đã hoàn thành" |

- **Lịch sử chỉnh sửa** (`OrderRevisions`): mỗi lần gồm ngày, trước/sau cọc, nội dung khách muốn đổi (`OrderRevisionChanges`), lời nhắn (`RequestNote`), tổng cũ → tổng mới, trạng thái Đang chờ NCC sửa / Đã áp dụng.
- **Chứng từ** (`Invoices`): Giấy xác nhận cọc, Hóa đơn cuối (nếu có), mỗi loại một nút Xem.

---

## 3. Badge trạng thái (giống nhau hai bên, theo CSDL)

| `Orders.Status` | Badge | Màu gợi ý |
|---|---|---|
| Draft | Bản nháp (chỉ NCC thấy) | Xám |
| Pending | Chờ thanh toán cọc | Vàng |
| NeedRevision | Chờ chỉnh sửa | Cam |
| Deposited | Đã đặt cọc | Xanh lá |
| Completed | Hoàn thành | Xanh đậm |
| Expired | Đã hết hạn | Xám |
| Cancelled | Đã hủy | Đỏ nhạt |

Có `OrderRevisions` loại AfterDeposit đang `Requested` thì thêm nhãn phụ "Khách yêu cầu chỉnh sửa" cạnh badge Đã đặt cọc.

---

## 4. Nút theo trạng thái và vai trò

**Hai giai đoạn (nhóm đã quyết):**

- **Từ lúc gửi đơn đến khi cọc** (`Pending`, `NeedRevision`): khách có Thanh toán cọc, Yêu cầu chỉnh sửa, Xem chi tiết; NCC Cập nhật đơn (đặt lại hạn cọc 24 giờ).
- **Sau khi cọc** (`Deposited`): khách **không** có Yêu cầu chỉnh sửa và Hủy đơn, chỉ còn Xem việc cần làm, Xem chi tiết. Khách muốn đổi gì thì nhắn trong chat, **NCC tự thao tác** (Chỉnh sửa, Hủy đơn). Không có yêu cầu chỉnh sửa sau cọc của khách (không có `OrderRevisions` `AfterDeposit` trạng thái `Requested`).

| Trạng thái | Khách thấy dòng gợi ý | Nút của khách | NCC thấy dòng gợi ý | Nút của NCC |
|---|---|---|---|---|
| **Draft** | Không thấy thẻ | | "Bản nháp, khách chưa thấy" (banner trên khung chat) | **Tiếp tục soạn** (mở form; trong form có nút **Gửi đơn**) |
| **Pending** | "Vui lòng thanh toán cọc trước {DepositDueDate}" | **Thanh toán cọc** (VNPay, chính) · Yêu cầu chỉnh sửa · Xem chi tiết | "Chờ khách thanh toán cọc · hạn {DepositDueDate}" | Xem chi tiết · Cập nhật đơn (đặt lại hạn 24 giờ) |
| **NeedRevision** | "Đã gửi yêu cầu chỉnh sửa, chờ NCC cập nhật" | Xem chi tiết | "Khách yêu cầu: {các nội dung} · {RequestNote}" | **Cập nhật đơn** (chính) · Xem chi tiết |
| **Expired** | "Đơn đã hết hạn đặt cọc" | Xem chi tiết · Nhắn tin cho NCC | "Đơn hết hạn vì khách chưa cọc" | Xem chi tiết · **Tạo lại đơn** (sao chép hạng mục, mã mới) |
| **Deposited** | "Đã đặt cọc. Còn lại {số tiền} thanh toán trực tiếp cho NCC" | **Xem việc cần làm** (timeline) · Xem chi tiết | "Đã nhận cọc. Thực hiện ngày {EventDate}". Đã qua `EventDate`: "Đã qua ngày thực hiện. Bấm Hoàn tất khi đã xong dịch vụ." | Xem chi tiết · Chỉnh sửa · **Hoàn tất** (chỉ hiện khi đã qua `EventDate`) · Xuất hóa đơn · **Hủy đơn** (viền đỏ; chỉ hiện khi hôm nay còn trước `EventDate`, giờ VN) |
| **Completed** | "Đơn đã hoàn thành" | Xem chi tiết · Xem hóa đơn (nếu có) | "Đã hoàn thành ngày {CompletedDate}. Đã tính hoa hồng" | Xem chi tiết · Xuất hóa đơn (nếu chưa xuất) hoặc Xem hóa đơn (đã xuất) |
| **Cancelled** | "NCC đã hủy đơn ngày {CancelledDate}" kèm lý do ("Khách yêu cầu hủy: bạn mất cọc" hoặc "NCC không thể thực hiện: NCC hoàn cọc cho bạn") | Xem chi tiết | "NCC đã hủy đơn ngày {CancelledDate} · Lý do: {CancelReason}" | Xem chi tiết · **Tạo lại đơn** (sao chép hạng mục, mã mới) |

### Quy tắc của từng nút

| Nút | Ai | Điều kiện | Hành vi theo CSDL |
|---|---|---|---|
| Gửi đơn | NCC | Draft, đủ trường bắt buộc. Hộp xác nhận: "Gửi đơn cho khách? Khách có 24 giờ để đặt cọc." | Draft → Pending; tạo `Payments` (Unpaid); `DepositDueDate` = +1 ngày; gửi tin `Order` vào chat |
| Thanh toán cọc | Khách | Pending, chưa quá hạn | Mở VNPay. Thành công: Payments Paid, Orders Deposited, thêm vào PlanVendors, tạo Invoices DepositReceipt + tin `DepositReceipt`, sinh timeline chi tiết, thông báo |
| Yêu cầu chỉnh sửa (trước cọc) | Khách | Pending | Chọn nội dung muốn đổi (OrderRevisionChanges: Đổi hạng mục, Đổi số lượng, Đổi ngày thực hiện, Khác) + lời nhắn. Tạo OrderRevisions (BeforeDeposit, Requested); Pending → NeedRevision |
| Cập nhật đơn | NCC | Pending hoặc NeedRevision. Hộp xác nhận: "Gửi bản cập nhật cho khách? Hạn cọc được đặt lại 24 giờ." | Sửa tự do; OrderRevisions → Applied (ghi tổng mới); về Pending; đặt lại hạn 1 ngày; gửi thẻ mới |
| Chỉnh sửa | NCC | Deposited. Form có ô bắt buộc **"Nội dung thay đổi (khách sẽ thấy)"**. Hộp xác nhận ghi chú "Tiền cọc đã khóa, tổng mới không thấp hơn tiền cọc." | Sửa hạng mục, ngày, ghi chú. Khóa `DepositPercent`, `DepositAmount`. Tổng mới ≥ tiền đã cọc. Ghi `OrderRevisions` loại `AfterDeposit` trạng thái **`Applied` luôn** (ghi nội dung thay đổi vào `RequestNote`, `OldTotalAmount` → `NewTotalAmount`); gửi thẻ cập nhật vào chat |
| Hủy đơn | **NCC** | Deposited **và hôm nay < `EventDate`** (giờ VN). Nút viền đỏ. Hộp xác nhận **bắt buộc chọn lý do**: "Khách yêu cầu hủy" (khách mất cọc) hoặc "NCC không thể thực hiện" (NCC hoàn cọc ngoài hệ thống), kèm ghi chú tùy chọn | Deposited → Cancelled, ghi `CancelledDate`, `CancelReason` (`CUSTOMER_REQUEST` / `VENDOR_UNABLE`); ghi chú tùy chọn chỉ đưa vào tin hệ thống (không lưu cột); tin hệ thống "NCC đã hủy đơn {mã} · Lý do: …"; không tính hoa hồng; xóa việc chi tiết của dịch vụ trên timeline của khách |
| Hoàn tất | NCC | Deposited và đã qua `EventDate`. Hộp xác nhận: "Xác nhận đơn đã hoàn tất? Hoa hồng của đơn sẽ được tính." | Deposited → Completed, ghi `CompletedDate`; tạo Commissions vào bảng kê tháng. Hệ thống tự làm sau `EventDate` + 7 ngày nếu NCC không bấm |
| Xuất hóa đơn / Xem hóa đơn | NCC | Deposited hoặc Completed. "Xuất hóa đơn" khi chưa có FinalInvoice, đã xuất thì thành "Xem hóa đơn" | Tạo Invoices FinalInvoice (mỗi đơn một), gửi tin `FinalInvoice` vào chat |
| Tạo lại đơn | NCC | Expired hoặc Cancelled (CSDL mục 9.5). Hộp xác nhận: "Tạo đơn mới với cùng hạng mục, mã đơn mới." | Mở form Tạo đơn, điền sẵn hạng mục và ghi chú của đơn cũ, mã đơn mới |

**Hủy đơn chỉ do NCC thực hiện**, chỉ với đơn `Deposited` còn trước ngày sự kiện. Đơn chưa cọc không hủy được (tự `Expired`); từ ngày sự kiện trở đi không hủy được (NCC Hoàn tất hoặc để hệ thống tự hoàn tất). Khách không có nút Hủy đơn.

---

## 5. Các tin khác trong chat liên quan đến đơn

| `Messages.Type` | Khi nào | Nội dung hiển thị (hai bên giống nhau) |
|---|---|---|
| Order | NCC gửi hoặc gửi lại đơn | Thẻ đơn (mục 2) |
| DepositReceipt | Cọc thành công. **Hệ thống gửi** (`SenderId` rỗng) | "Giấy xác nhận cọc {InvoiceCode}: đã nhận {DepositAmount} cho đơn {OrderCode}. Số còn lại {TotalAmount − DepositAmount} thanh toán trực tiếp với NCC." + nút Xem |
| FinalInvoice | NCC xuất hóa đơn cuối. **NCC gửi** (`SenderId` = tài khoản NCC) | "Hóa đơn {InvoiceCode} cho đơn {OrderCode}: tổng {TotalAmount}, đã cọc {DepositAmount}, đã thanh toán tiền mặt {phần còn lại}." + nút Xem |
| Tin hệ thống (SenderId rỗng) | Khách yêu cầu chỉnh sửa (trước cọc), đơn hết hạn, NCC hủy đơn, đơn hoàn thành | Một dòng nhỏ ở giữa, nền nhạt, ví dụ "Khách yêu cầu chỉnh sửa đơn DH26080001: Đổi số lượng · "Giảm còn 15 bàn nhé."", "Đơn DH26080001 đã hết hạn đặt cọc", "NCC đã hủy đơn DH26080001 · Lý do: Khách yêu cầu hủy" |

---

## 6. Điểm cần nhóm chốt

1. **Đã chốt:** đơn hết hạn cọc (Expired) bị khóa, muốn tiếp tục thì NCC **tạo đơn mới** (mã mới) bằng nút "Tạo lại đơn", theo CSDL mục 9.5. Cần sửa câu ở CSDL mục 9.6 ("NCC phải gửi lại để có hạn mới") thành "NCC tạo đơn mới (mã mới) để khách cọc lại".
2. **Đã chốt:** NCC hủy đơn sau cọc (trước `EventDate`), bắt buộc chọn lý do. CSDL đã có `Orders.CancelReason`; ghi chú tùy chọn chỉ nằm trong tin hệ thống (cột `CancelNote` đã bị bỏ theo quyết định nhóm 27/10/2026).

---

## 7. Phía NCC: bảng Quản lý đơn hàng và luồng khách yêu cầu chỉnh sửa trước cọc

- **Nút chính trong bảng** chỉ có ở đơn cần NCC xử lý: Cập nhật đơn (NeedRevision), Hoàn tất (Deposited đã qua `EventDate`), Tạo lại đơn (Expired, Cancelled). Mọi đơn có menu "…" (Xem chi tiết và các thao tác còn lại theo bảng mục 4).
- **NeedRevision:** không có hạn đặt cọc (đơn không hết hạn khi chờ NCC sửa). Thẻ đơn có hộp màu cam "Khách yêu cầu: {các nội dung} · "{RequestNote}"". Danh sách hội thoại có badge "Cần sửa".
- **Form Cập nhật đơn** có dải nhắc lại yêu cầu của khách. Gửi xong: thẻ cũ thu gọn "Đơn {mã} đã được cập nhật, xem bản mới nhất bên dưới"; thẻ mới có dòng "Đã cập nhật: tổng {OldTotalAmount} → {NewTotalAmount}"; đơn về Pending, `DepositDueDate` = +24 giờ.
