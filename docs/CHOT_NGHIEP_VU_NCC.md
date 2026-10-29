# Các quyết định đã chốt (phía Nhà cung cấp)

> Đọc file này trước khi sửa bất kỳ phần nào phía NCC. Khi có mâu thuẫn, ưu tiên theo thứ tự:
> 1. `docs/database.md` (CSDL của nhóm, backend cũng làm theo)
> 2. File này và `docs/api/THE_DON_HANG.md`
> 3. Các file `docs/api/*.md` cũ (một số mục viết trước khi có CSDL, có thể đã lỗi thời)
> 4. Prototype `docs/prototype/prototype_vendor/` (chỉ tham khảo giao diện)
>
> Cập nhật: 25/10/2026

---

## 1. Tài khoản và hồ sơ NCC

- Mỗi tài khoản NCC gắn **đúng 1 lĩnh vực** (`VendorProfiles.CategoryId`), do Admin chọn khi tạo tài khoản. Trên trang Hồ sơ hiển thị chỉ đọc (có biểu tượng khóa), NCC không đổi được.
- 6 dịch vụ: Nhà hàng (Trung tâm tổ chức sự kiện, đã gồm cỗ cưới), Decor, Trang phục, Makeup, Chụp ảnh (gồm quay phim), Hoa cưới. **Không còn "Cỗ cưới" riêng.**
- Trạng thái hồ sơ: `Draft`, `Pending`, `NeedRevision`, `Approved`.
- Địa chỉ: `Address` + `Ward` (phường/xã) + `City`. Không có quận. `GoogleMapsUrl` tùy chọn.
- Giờ làm việc: một chuỗi mô tả (`WorkingHours`).
- Giấy tờ bắt buộc: mọi loại cần `BusinessLicense` + `StorefrontPhoto` (ảnh mặt tiền); Nhà hàng thêm `FoodSafety` + `FireSafety`; Makeup thêm `SkillCertificate`.
- **Đã bỏ "Ảnh sảnh"** khỏi hồ sơ.

## 2. Gói dịch vụ

- **Một giá** (`ServicePackages.Price`). Không có giá tối thiểu/tối đa. Khoảng giá của NCC = giá thấp nhất đến cao nhất của các gói đang hiển thị.
- `Capacity` (sức chứa) cho gói Nhà hàng.
- Trạng thái: `Draft`, `Pending`, `NeedRevision` (Admin trả về, kèm lý do), `Approved`, `Hidden`.
- Tags qua `PackageTags`; mỗi gói đúng 1 ảnh bìa (`IsCover`).
- Đã bỏ nút "Thêm gói dịch vụ" trên trang Quản lý dịch vụ (theo yêu cầu nhóm).

## 3. Tin nhắn và tạo đơn

- Giao diện trang Tin nhắn NCC **đồng bộ với trang Nhắn tin phía khách** (của Chika). Không sửa file của Chika; component NCC viết riêng với cùng class.
- Header hội thoại: nút "Xem đơn ›" (khi đã có đơn) và nút vàng "+ Tạo đơn" (luôn hiện). Tên nút là **"Tạo đơn"** (không dùng "Thêm đơn hàng").
- Chấm xanh / "Trực tuyến" chỉ hiện khi backend có dữ liệu online thật.
- **Tạo đơn từ hội thoại:** FE chỉ gửi `conversationId`; backend tự suy `WeddingId` (Weddings có `UserId` = `Conversations.CoupleId`).
- Điền sẵn: **Tên khách** = GroomName & BrideName (không có thì `Users.FullName`); **SĐT** = `Users.PhoneNumber`. NCC sửa được, sửa không đổi hồ sơ khách.
- Khách chưa có SĐT: ô để trống, **NCC tự nhập tay**. SĐT bắt buộc khi gửi đơn, không bắt buộc khi lưu nháp.
- **Ngày sự kiện NCC tự nhập**, không điền sẵn. Lưu nháp cũng bắt nhập ngày.
- Khách chưa có thông tin đám cưới: backend trả `409 WEDDING_NOT_SET`; form hiện "Khách chưa điền thông tin đám cưới nên chưa tạo đơn được" + nút "Nhắc khách" (mỗi hội thoại nhắc 1 lần).

## 4. Đơn hàng

- Nội dung thẻ đơn, badge, nút theo trạng thái và vai trò: xem **`docs/api/THE_DON_HANG.md`**. Khách và NCC thấy cùng nội dung, chỉ khác nút.
- 7 trạng thái: `Draft`, `Pending`, `NeedRevision`, `Deposited`, `Completed`, `Expired`, `Cancelled`.
- Hạng mục: `ItemName`, `Unit` (Gói/Bàn), `Quantity`, `UnitPrice`, `Amount`. Một `DepositPercent` (>0, <100), `DepositAmount` làm tròn 100.000đ, hạn cọc 1 ngày.
- **Thanh toán:** chỉ một khoản trong hệ thống là **tiền cọc qua VNPay**. Phần còn lại khách trả **tiền mặt trực tiếp cho NCC, ngoài hệ thống, không ghi nhận**. Không có nhiều đợt tùy chỉnh, không có "Ghi nhận thanh toán", không có "Đã thu thực tế / Còn phải thu".
- **Đơn hết hạn cọc (`Expired`): khóa. Muốn tiếp tục thì NCC bấm "Tạo đơn mới từ đơn này"** (chép hạng mục, mã đơn mới). Không có "gửi lại để gia hạn".
- **Hai giai đoạn.** Trước cọc (`Pending`, `NeedRevision`): khách Thanh toán cọc / Yêu cầu chỉnh sửa / Xem chi tiết; NCC Cập nhật đơn (đặt lại hạn cọc 24 giờ). Sau cọc (`Deposited`): khách **không** có Yêu cầu chỉnh sửa và Hủy đơn, chỉ Xem việc cần làm và Xem chi tiết; khách nhắn trong chat, **NCC tự thao tác**.
- **Mỗi hạng mục tối đa MỘT đơn `Deposited` cùng lúc** (một đám cưới, tính theo hạng mục của NCC, không phân biệt NCC). Khách đặt cọc đơn thứ hai cùng hạng mục, hoặc NCC Gửi / Cập nhật / Tạo lại đơn khi hạng mục đã có đơn `Deposited` khác, đều bị chặn `409 CATEGORY_ALREADY_DEPOSITED`; muốn đổi NCC thì NCC cũ hủy đơn trước. Đơn `Completed` không giữ chỗ; lưu nháp không bị chặn.
- **NCC hủy đơn sau cọc** (`Deposited` → `Cancelled`), **chỉ khi hôm nay còn trước `EventDate`** (giờ VN). Bắt buộc chọn lý do: "Khách yêu cầu hủy" (khách mất cọc) hoặc "NCC không thể thực hiện" (NCC hoàn cọc ngoài hệ thống), kèm ghi chú tùy chọn; ghi `CancelReason`, `CancelledDate`, gửi tin hệ thống vào chat; không tính hoa hồng. Đơn chưa cọc không hủy được (tự hết hạn). Khách không hủy được đơn.
- Sửa sau cọc: NCC sửa trực tiếp hạng mục, ngày, ghi chú; khóa tỷ lệ và tiền cọc; tổng mới ≥ tiền đã cọc; **bắt buộc ghi "Nội dung thay đổi" (khách sẽ thấy)**; lưu `OrderRevisions` loại `AfterDeposit` trạng thái `Applied` luôn (không có yêu cầu `Requested` của khách sau cọc); gửi thẻ cập nhật vào chat. Không có bước "phương án điều chỉnh chờ khách đồng ý".
- **NCC đánh dấu Hoàn thành** khi đã qua `EventDate`; hệ thống tự hoàn thành sau `EventDate` + 7 ngày.
- **NCC xuất hóa đơn cuối** (`FinalInvoice`) khi khách yêu cầu, mỗi đơn một lần.
- Không thêm cột `SourceOrderId` (đơn tạo lại không cần trỏ về đơn cũ).

## 5. Tin nhắn liên quan đơn

- `Messages.Type` chỉ có: `Text`, `Order`, `DepositReceipt`, `FinalInvoice`. Tin hệ thống có `SenderId` rỗng.
- Bản nháp không tạo tin; khách không thấy.

## 6. Hoa hồng

- Tỷ lệ theo loại dịch vụ (`ServiceCategories.CommissionRate`): Nhà hàng 5%, Decor 7%, Hoa cưới 8%, Trang phục 8%, Chụp ảnh 8%, Makeup 10%. Tỷ lệ được chụp lại vào `Commissions.Rate` lúc đơn hoàn thành.
- Tính trên `TotalAmount` cuối cùng **khi đơn `Completed`**; kỳ = tháng chứa `CompletedDate`.
- Hạn nộp **ngày 25 tháng sau**; NCC nộp một lần cho cả bảng kê **qua VNPay**. Không có upload minh chứng / Admin xác nhận.
- Giao diện hiển thị đúng số backend trả về, không tự tính lại.

## 7. Timeline (phía khách, để tham khảo)

- Thiết kế ở **`docs/TIMELINE.md`** (phiên bản 4). Mỗi dịch vụ: Tìm → Thử để đánh giá → Chốt và đặt cọc; cọc thành công sinh timeline chi tiết.

## 8. Chưa chốt

- Bắt buộc SĐT khi đăng ký tài khoản khách (việc của phía khách).
- **Quy tắc làm tròn tiền cọc đến 100.000đ** (`database.md` mục 15.5): tạm làm tròn **gần nhất**, **tối thiểu 100.000đ** (cọc 0đ thì khách không thanh toán được qua VNPay); nếu tiền cọc sau làm tròn **lớn hơn hoặc bằng tổng đơn** thì không cho Gửi đơn ("Tổng đơn quá nhỏ để đặt cọc"), Lưu nháp vẫn được. Form hiện "Tiền cọc ước tính ≈ …". **Chờ nhóm xác nhận** làm tròn gần nhất, lên hay xuống, và mức tối thiểu; backend là nơi tính chính thức (cùng công thức `frontend/src/lib/deposit.ts`).
- **Ngày thực hiện phải từ hôm nay trở đi** (giờ VN) khi Gửi đơn, Tạo lại đơn, Chỉnh sửa sau cọc (backend trả `422 EVENT_DATE_IN_PAST`); Lưu nháp không chặn. Chờ nhóm xác nhận.
- CSDL mục 9.6 cần sửa câu "NCC phải gửi lại để có hạn mới" thành "NCC tạo đơn mới (mã mới)".
