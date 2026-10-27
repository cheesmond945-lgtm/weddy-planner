# Báo cáo hiện trạng: trạng thái đơn hàng ở phía NCC và phía khách

> Kiểm tra ngày 26/10/2026. **Chỉ đọc code và chạy thử, không sửa code, không commit.**
> So với `docs/api/THE_DON_HANG.md` và `docs/database.md` (mục 9.5 đến 9.8).
> Phía khách (của Chika) chỉ đọc. Ảnh chụp ở thư mục scratchpad (mục 4), không nằm trong repo.

## 0. Tóm tắt

1. **Hai phía KHÔNG dùng chung dữ liệu đơn.** Phía NCC chạy mock `weddy.mock.vendorOrders.v4`, phía khách chạy mock riêng `weddy.mock.planning`. NCC gửi đơn thì khách **không thấy** (và ngược lại). Hai bên dùng mô hình đơn khác hẳn nhau.
2. Phía NCC **khớp** `THE_DON_HANG.md` ở cả 7 trạng thái và 2 trường hợp phụ. Chỉ có vài điểm nhỏ cần chốt (mục 5a).
3. Phía khách **lệch nhiều**: chỉ có 4 trạng thái gộp, thẻ đơn thiếu nhiều dòng, thiếu nút Xem chi tiết / Hủy đơn / Yêu cầu chỉnh sửa sau cọc / Xem hóa đơn, form yêu cầu chỉnh sửa chỉ có ô văn bản (mục 5b).
4. Nếu chạy backend thật cho đơn và chat, khách có thấy đơn của NCC, nhưng bị **méo** vì backend còn ánh xạ cũ (7 trạng thái gộp còn 4, biên nhận và hóa đơn thành tin chữ). Chi tiết ở mục 1 và 5c.
5. Với `.env` hiện tại (`VITE_REAL_APIS=catalog,auth`), khách **không mở được chat từ một dịch vụ thật**: báo "Không tìm thấy dịch vụ." vì chat mock tra danh mục mock. Đã tái hiện (mục 5b, điểm 11).

## 1. Nguồn dữ liệu của hai phía

| | Phía NCC | Phía khách (Chika) |
|---|---|---|
| Code | `features/vendorOrders/`, `features/vendorChat/`, `pages/vendor/`, `types/vendorOrder.ts`, `types/vendorConversation.ts` | `features/orders/`, `features/chat/`, `pages/couple/` (ChatPage, DealPage), `features/payments/`, `types/order.ts`, `types/chat.ts` |
| Mock | `mocks/vendorOrders.ts` (kho `weddy.mock.vendorOrders.v4`, theo từng tài khoản NCC) | `mocks/chat.ts` + `mocks/db.ts` (kho `weddy.mock.planning`, theo từng tài khoản khách) |
| Cờ | `isMock('orders')`, `isMock('vendorChat')`... | `isMock('orders')`, `isMock('chat')` |
| Mã | Hội thoại `vc-N` (theo **khách**), đơn `ord-N`, mã hiển thị `DH26100003` | Hội thoại `cv-N` (theo **dịch vụ**), đơn `od-N`, mã hiển thị `#001` |
| Mô hình đơn | 7 trạng thái CSDL, `items`, `depositPercent`, `depositDueDate`, `revisions`, `invoices`, `payment` | 4 trạng thái `SENT / REVISION_REQUESTED / PAID / CANCELLED`, một dòng `packageName`, `depositAmount`, `revisionNote`, `paidAt` |
| "Bên kia" | Nút **Giả lập khách** (đặt cọc, yêu cầu sửa, hủy sau cọc, nhắn tin) và **Giả lập thời gian**, ghi thẳng vào kho NCC | "NCC giả" trong `mocks/chat.ts`: trả lời mẫu; khách gõ "gửi đơn" hoặc "chốt" thì tự sinh đơn (gói đầu tiên, cọc 10%); sau khi khách yêu cầu sửa, 2 giây sau tự "gửi lại" (chỉ đổi trạng thái về SENT, **không đổi nội dung đơn**) |

**Có chung dữ liệu không?**

- **Mock với mock: Không.** Hai kho localStorage khác khóa, khác mã, khác mô hình. NCC bấm Gửi đơn thì khách không có gì. Khách bấm Yêu cầu chỉnh sửa thì NCC không nhận được. Phải dùng nút Giả lập khách để thay.
- **Backend thật:** hai phía cùng đọc bảng `Orders`, `Messages` nên **có thấy nhau**. Nhưng backend hiện chưa theo CSDL/`THE_DON_HANG.md`:
  - `coupleStatusOf`: `Deposited` và `Completed` thành `PAID`; `Expired` và `Cancelled` thành `CANCELLED`; còn lại `SENT` hoặc `REVISION_REQUESTED`.
  - Tin phía khách chỉ có `TEXT` và `ORDER`; `DepositReceipt`, `FinalInvoice` và tin hệ thống đều thành chữ (`coupleMessage` trong `chat.service.ts`).
  - `requestRevision` (khách) chỉ cho đơn `Pending`, không ghi `OrderRevisionChanges`; không có endpoint khách hủy sau cọc, khách yêu cầu sửa sau cọc.
  - Hết hạn và tự hoàn thành chưa có job; các chỗ lệch phía NCC của backend đã liệt kê ở `docs/api/LECH_FE_BE.md`.
- Phía khách đang gọi API thật cho `orders` và `chat` nếu bỏ `VITE_USE_MOCK` hoặc thêm `orders`, `chat` vào `VITE_REAL_APIS`; hiện chưa bật nên mọi thứ ở phía khách chạy bằng mock riêng.

## 2. Bảng theo trạng thái

Ký hiệu: **NCC** là giao diện hiện tại phía NCC (đã chạy thử trên mock). **Khách** là phía khách đọc từ code và chạy thử trên mock phía khách (`mocks/chat.ts`); khi khác mock, ghi thêm "BE" là backend hiện tại. "Tin" ghi: ai gửi, loại tin, nội dung.

| Trạng thái | NCC: badge + dòng gợi ý + nút | Khách: badge + dòng gợi ý + nút | Tin trong chat khi chuyển sang trạng thái | Khớp THE_DON_HANG.md? |
|---|---|---|---|---|
| **Draft** | Badge "Bản nháp" (bảng, chi tiết, danh sách hội thoại).<br>**Không có thẻ trong chat**; có banner trên khung chat "Bản nháp DH… chưa gửi khách · chỉ bạn nhìn thấy · tạo hh:mm · dd/mm" + nút **Tiếp tục soạn**.<br>Chi tiết: gợi ý "Bản nháp, khách chưa thấy." + **Tiếp tục soạn**. Bảng: không nút chính; menu **Xem chi tiết, Tiếp tục soạn**. Nút **Gửi đơn** nằm trong form. | Không thấy (BE lọc `status != Draft`; mock khách không có Draft). | Không có tin. | **Có.** (Tài liệu chỉ ghi "Tiếp tục soạn · Gửi đơn"; chưa nhắc nút Xem chi tiết trong bảng.) |
| **Pending** | Badge "Chờ thanh toán cọc" (bảng: "Chờ cọc" + pill đếm ngược, đỏ khi còn dưới 6 giờ).<br>Thẻ có hàng "Hạn đặt cọc 15:49 26/10 · còn 2 giờ"; gợi ý "Chờ khách thanh toán cọc."<br>Nút thẻ: **Xem chi tiết, Cập nhật đơn**. Bảng: không nút chính; menu Xem chi tiết, Cập nhật đơn. Chi tiết: Cập nhật đơn. | Badge "Chờ thanh toán cọc". Thẻ: "Gói dịch vụ", ngày, tổng, "Cần cọc trước", "Còn lại". **Không có** hạn cọc, không dòng gợi ý.<br>Nút: **Xác nhận & thanh toán cọc**, **Yêu cầu chỉnh sửa**. Không có Xem chi tiết. | NCC gửi lần đầu: **NCC** gửi tin **Order** (mock NCC: "Đơn dịch vụ DH…", không có tin hệ thống đi kèm).<br>Mock khách: VENDOR/ORDER "Nhà cung cấp đã gửi đơn dịch vụ" + SYSTEM "Nhà cung cấp đã gửi đơn dịch vụ. Bạn xem lại và thanh toán cọc."<br>BE: Order "Đơn dịch vụ X: tổng…, đặt cọc…%. Hạn thanh toán cọc: …" + thông báo OrderSent. | **NCC: Có** (gợi ý không ghi "hạn" trên cùng dòng nhưng hạn có ở hàng riêng). **Khách: Lệch** (tên nút, thiếu Xem chi tiết, thiếu gợi ý "Vui lòng thanh toán cọc trước…", thiếu hạn cọc). |
| **NeedRevision** | Badge "Chờ chỉnh sửa" (cam). **Không có dòng hạn cọc.**<br>Thẻ có hộp cam **"Khách yêu cầu: Đổi số lượng, Đổi ngày thực hiện · "<lời nhắn>""**.<br>Nút thẻ: Xem chi tiết, **Cập nhật đơn** (vàng). Bảng: nút chính **Cập nhật đơn** + menu Xem chi tiết; vạch vàng bên trái. Danh sách hội thoại: badge **Cần sửa**, lọc "Cần xử lý". Form có dải nhắc lại yêu cầu. | Badge "Đang chỉnh sửa". Hộp "Bạn đã yêu cầu chỉnh sửa: <nội dung> / Chờ nhà cung cấp gửi lại đơn." **Không có nút.** | Khách yêu cầu: **mock NCC** ghi SYSTEM/Text "Khách đã yêu cầu chỉnh sửa đơn DH… " (lời nhắn chỉ ở thẻ).<br>**Mock khách** ghi COUPLE/TEXT "Yêu cầu chỉnh sửa đơn #001:\n<nội dung>" + SYSTEM "Đã gửi yêu cầu chỉnh sửa cho nhà cung cấp. Nhà cung cấp sẽ gửi lại đơn đã cập nhật."<br>BE: giống mock khách (COUPLE text + SYSTEM text) + thông báo OrderRevisionRequested. | **NCC: Có.** **Khách: Lệch** (tên badge "Đang chỉnh sửa" thay vì "Chờ chỉnh sửa"; gợi ý khác "Đã gửi yêu cầu chỉnh sửa, chờ NCC cập nhật"; thiếu Xem chi tiết). |
| **Pending sau khi NCC cập nhật** (NeedRevision hoặc Pending gửi lại) | Thẻ **cũ thu gọn** thành dòng "Đơn DH… đã được cập nhật, xem bản mới nhất bên dưới hh:mm · dd/mm"; thẻ **mới** có dòng "Đã cập nhật: tổng 57.600.000đ → 48.000.000đ", hạn cọc mới 24 giờ. | Mock khách: không có thẻ mới; thẻ cũ tự cập nhật (cùng một thẻ) về "Chờ thanh toán cọc", có thêm tin SYSTEM "Nhà cung cấp đã cập nhật đơn dịch vụ. Bạn xem lại và thanh toán cọc." **Nội dung đơn không đổi** (mock chỉ đổi trạng thái).<br>BE: thêm tin hệ thống chữ "Đã cập nhật và gửi lại đơn X\n- …" + **thêm một thẻ Order** (hai thẻ cùng đọc dữ liệu mới nhất, không thu gọn). | NCC gửi: **NCC** gửi tin **Order** mới (mock: "Đơn dịch vụ DH…"). | **NCC: Có** (thu gọn + dòng "Đã cập nhật"). **Khách: Lệch** (không thu gọn thẻ cũ; mock không thể hiện đơn mới). |
| **Deposited** | Badge "Đã đặt cọc". Thẻ: "Đã thanh toán cọc 19.200.000đ · 17:49 · 14/10", gợi ý "Đã nhận cọc. Thực hiện ngày …".<br>Nút thẻ: **Xem chi tiết, Chỉnh sửa, Xuất hóa đơn** (đã xuất thì **Xem hóa đơn**). Bảng: không nút chính; menu Xem chi tiết, Chỉnh sửa, Xuất hóa đơn. Sau khi NCC chỉnh sửa: thẻ mới có "Đã cập nhật: tổng a → b", thẻ cũ thu gọn. | Badge "Đã cọc". Dòng "Đã thanh toán cọc 1.400.000đ". Nút: **Xem việc cần làm** (sang timeline). **Không có** Xem chi tiết, Yêu cầu chỉnh sửa, Hủy đơn. | Khách cọc: **hệ thống** gửi tin **DepositReceipt** "Giấy xác nhận cọc XNC…: đã nhận … cho đơn … Số còn lại … thanh toán trực tiếp với nhà cung cấp." + nút Xem.<br>Mock khách: SYSTEM/TEXT "Đã ghi nhận đặt cọc 1.400.000đ. Dịch vụ được chốt." (không có giấy xác nhận).<br>BE: có tin DepositReceipt nhưng phía khách hiện như **chữ**, không có nút Xem.<br>NCC chỉnh sửa: **NCC** gửi tin **Order** ("Đơn dịch vụ DH… đã được cập nhật"). | **NCC: Có.** **Khách: Lệch** (thiếu Xem chi tiết, Yêu cầu chỉnh sửa, Hủy đơn; không có giấy xác nhận cọc dạng tin DepositReceipt; chỉ có "Xem việc cần làm", hợp với tài liệu). |
| *Phụ 1:* **Deposited + khách yêu cầu sửa sau cọc** | Badge "Đã đặt cọc" + nhãn phụ **"Khách yêu cầu chỉnh sửa"** (thẻ), "Yêu cầu sửa" (bảng). Hộp cam "Khách yêu cầu: Đổi số lượng · "…"". Nút: Xem chi tiết, **Chỉnh sửa**, Xuất hóa đơn. Bảng: không nút chính, chỉ vạch vàng + nhãn. Danh sách: "Đã cọc", tính vào "Cần xử lý". | **Không có chức năng này**: mock, BE và giao diện chỉ cho yêu cầu sửa khi đơn đang chờ cọc (SENT / Pending). | **Hệ thống** gửi SYSTEM/Text "Khách đã yêu cầu chỉnh sửa đơn DH…" (mock NCC). NCC chỉnh sửa xong thì gửi Order mới. | **NCC: Có.** **Khách: Lệch** (thiếu hẳn). |
| *Phụ 2:* **Deposited đã qua ngày sự kiện** | Như Deposited, thêm nút **Hoàn tất** (vàng). Bảng: nút chính **Hoàn tất**, vạch vàng. Gợi ý vẫn là "Đã nhận cọc. Thực hiện ngày …" (không nhắc đã qua ngày). Danh sách hội thoại: "Cần xử lý". Hộp xác nhận "Xác nhận đơn đã hoàn tất? Hoa hồng của đơn sẽ được tính." | Giống Deposited (khách không biết đã qua ngày). | Chưa có tin cho tới khi hoàn tất. Hệ thống tự hoàn tất sau `EventDate` + 7 ngày. | **NCC: Có.** Khách: không áp dụng. |
| **Completed** | Badge "Hoàn thành". Gợi ý "Đã hoàn thành ngày 24/09/2026. Đã tính hoa hồng." Nút: Xem chi tiết, Xuất hóa đơn / Xem hóa đơn. Bảng: không nút chính. | Mock và BE đều trả `PAID` nên khách thấy badge **"Đã cọc"**, nút "Xem việc cần làm". **Không phân biệt Hoàn thành**, không có Xem hóa đơn. | **Hệ thống** gửi SYSTEM/Text "Đơn DH… đã hoàn thành." Hóa đơn cuối (NCC xuất tùy chọn): **NCC** gửi tin **FinalInvoice** "Hóa đơn HD…: tổng …, đã cọc …, đã thanh toán tiền mặt …" + nút Xem. Phía khách: mock không có, BE hiện như chữ. | **NCC: Có.** **Khách: Lệch** (thiếu badge "Hoàn thành", "Đơn đã hoàn thành", Xem hóa đơn). |
| **Expired** | Badge "Đã hết hạn". Gợi ý "Đơn hết hạn vì khách chưa cọc." Nút: Xem chi tiết, **Tạo lại đơn** (chính; hộp xác nhận "Tạo đơn mới với cùng hạng mục, mã đơn mới."). Bảng: nút chính **Tạo lại đơn**. | Mock khách không sinh trạng thái này. BE gộp thành `CANCELLED`: badge **"Đã hủy"**, chữ "Đơn đã bị hủy hoặc hết hạn đặt cọc." Không nút. | **Hệ thống** gửi SYSTEM/Text "Đơn DH… đã hết hạn đặt cọc." (mock NCC, giờ gửi = hạn cọc). BE: chưa có job nên không có tin. Tạo lại: NCC tạo đơn mới (mã mới, Draft, rồi Gửi đơn → tin Order mới). | **NCC: Có.** **Khách: Lệch** (badge "Đã hết hạn", gợi ý "Đơn đã hết hạn đặt cọc", Xem chi tiết, Nhắn tin cho NCC). |
| **Cancelled** | Badge "Đã hủy". Gợi ý "Khách đã hủy đơn ngày …" Nút: chỉ Xem chi tiết. | Không có chức năng **Hủy đơn** ở phía khách (không nút, không API trong mock, BE không có endpoint). Chỉ hiện "Đã hủy" nếu BE trả. | **Hệ thống** gửi SYSTEM/Text "Khách đã hủy đơn DH… (mất cọc)." (mock NCC). | **NCC: Có** (theo tài liệu). **Khách: Lệch** (thiếu nút Hủy đơn và hộp xác nhận "Hủy sau khi cọc sẽ mất cọc"). Ngoài ra **tài liệu tự lệch:** `database.md` 9.5 nói Expired **và Cancelled** đều cho NCC tạo đơn mới; `THE_DON_HANG.md` chỉ cho Expired. |

## 3. Luồng tin nhắn qua lại theo thứ tự (một đơn đi từ đầu đến cuối)

Dùng mock NCC (đã chạy thật) làm chuẩn, ghi chú khác biệt của phía khách. "Khách thấy" là điều **tài liệu yêu cầu**, vì hai mock không nối với nhau; mục "Khách thấy (hiện tại)" ghi điều phía khách thực tế làm trong mock riêng hoặc qua BE.

| # | Ai làm | NCC thấy / thẻ NCC đổi | Khách thấy (theo tài liệu) | Khách thấy (hiện tại, mock khách hoặc BE) |
|---|---|---|---|---|
| 1 | NCC **Gửi đơn** (từ Draft) | Thẻ mới "Chờ thanh toán cọc" + hạn cọc 24 giờ, banner nháp biến mất, badge hội thoại "Chờ cọc". Tin **Order** của NCC. | Thẻ Order (Pending), nút Thanh toán cọc, Yêu cầu chỉnh sửa, Xem chi tiết | Mock khách: không thấy gì (kho khác). BE: thẻ ORDER với 2 nút, không có hạn cọc trên thẻ |
| 2 | Khách **Yêu cầu chỉnh sửa** (đơn Pending) | Tin hệ thống "Khách đã yêu cầu chỉnh sửa đơn DH…"; thẻ đổi sang "Chờ chỉnh sửa" + hộp cam; **hạn cọc biến mất**; badge hội thoại "Cần sửa" | Thẻ "Chờ chỉnh sửa", hộp "Bạn đã yêu cầu…" | Form chỉ có ô văn bản. Tin COUPLE "Yêu cầu chỉnh sửa đơn #001:\n<nội dung>" + tin SYSTEM "Đã gửi yêu cầu chỉnh sửa…". Không có danh sách "Nội dung muốn đổi" (OrderRevisionChanges) |
| 3 | NCC **Cập nhật đơn** | Form có dải nhắc lại yêu cầu; sau khi gửi: thẻ cũ thu gọn "Đơn … đã được cập nhật…", thẻ mới "Đã cập nhật: tổng a → b", hạn cọc mới 24 giờ, đơn về "Chờ thanh toán cọc". Tin **Order** mới | Thẻ mới Pending, thẻ cũ thu gọn | Mock khách: "NCC giả" chỉ đổi trạng thái thẻ cũ về SENT + tin SYSTEM, nội dung đơn không đổi. BE: thêm thẻ ORDER thứ hai (hai thẻ trùng) + tin chữ "Đã cập nhật và gửi lại đơn…" |
| 4 | Khách **Thanh toán cọc** (VNPay) | Đơn "Đã đặt cọc"; tin **DepositReceipt** (hệ thống) "Giấy xác nhận cọc XNC…" + nút Xem; badge hội thoại "Đã cọc"; thẻ có "Đã thanh toán cọc … · giờ · ngày" | Thẻ "Đã đặt cọc"; giấy xác nhận cọc; "Xem việc cần làm" | Mock khách: trang `/plan/deal/:id` rồi thẻ "Đã cọc" + tin SYSTEM chữ "Đã ghi nhận đặt cọc …". BE: DepositReceipt thành chữ, không có nút Xem |
| 5 | (Khách **Yêu cầu chỉnh sửa sau cọc**) | Tin hệ thống "Khách đã yêu cầu chỉnh sửa đơn DH…"; thẻ vẫn "Đã đặt cọc" + nhãn "Khách yêu cầu chỉnh sửa" + hộp cam; danh sách "Cần xử lý" | Thẻ có nút Yêu cầu chỉnh sửa | **Không có** ở phía khách |
| 6 | (NCC **Chỉnh sửa** đơn đã cọc) | Thẻ cũ thu gọn, thẻ mới "Đã cập nhật: tổng a → b", tiền cọc khóa, tổng mới không thấp hơn tiền cọc. Tin **Order** ("Đơn dịch vụ DH… đã được cập nhật") | Thẻ mới | Chưa có |
| 7 | NCC **Hoàn tất** (sau ngày sự kiện) hoặc hệ thống tự hoàn tất sau +7 ngày | Hộp xác nhận → đơn "Hoàn thành"; tin hệ thống "Đơn DH… đã hoàn thành."; hoa hồng vào kỳ tháng hiện tại | Thẻ "Hoàn thành", tin hệ thống | Khách vẫn thấy "Đã cọc" (gộp PAID) |
| 8 | NCC **Xuất hóa đơn** (tùy chọn) | Tin **FinalInvoice** của NCC "Hóa đơn HD…: tổng …, đã cọc …, đã thanh toán tiền mặt …" + nút Xem; nút trên thẻ đổi thành "Xem hóa đơn" | Tin FinalInvoice + nút Xem | BE: hiện như chữ |
| **Nhánh hết hạn** | Khách không cọc kịp (quá hạn 24 giờ) → hệ thống chuyển Expired | Tin hệ thống "Đơn DH… đã hết hạn đặt cọc."; thẻ "Đã hết hạn" + nút **Tạo lại đơn**. NCC bấm Tạo lại đơn → xác nhận → form (sao chép hạng mục, ngày để trống) → Gửi đơn → **đơn mới, mã mới**, tin Order mới | Thẻ "Đã hết hạn"; sau đó thẻ Order mới | BE: "Đã hủy" cho đơn cũ; không có tin hệ thống (chưa có job) |
| **Nhánh khách hủy sau cọc** | Khách hủy (Deposited → Cancelled, mất cọc) | Tin hệ thống "Khách đã hủy đơn DH… (mất cọc)."; thẻ "Đã hủy", chỉ còn Xem chi tiết; danh sách "Đã hủy" | Nút Hủy đơn + hộp xác nhận | **Không có** ở phía khách |

## 4. Ảnh chụp

Thư mục gốc: `C:\Users\ACER\AppData\Local\Temp\claude\d--T-I-LI-U-H-C-T-P-----N\e1dbca5b-2662-4424-9e45-a417799ab62d\scratchpad\hall\`

**Thẻ đơn phía NCC theo trạng thái** (thư mục `states\`, mock NCC + dữ liệu mẫu):

| Trạng thái | Tệp |
|---|---|
| Draft (banner, không có thẻ) | `states\draft.png` |
| Pending | `states\pending.png` |
| NeedRevision | `states\needrevision.png` |
| Deposited (đã chỉnh sửa sau cọc) | `states\deposited.png` |
| Deposited + khách yêu cầu sửa sau cọc | `states\deposited-request.png` |
| Deposited đã qua ngày sự kiện (có nút Hoàn tất) | `states\deposited-passed.png` |
| Completed | `states\completed.png` |
| Expired | `states\expired.png` |
| Cancelled | `states\cancelled.png` |

Ảnh bảng Quản lý đơn hàng ở các độ rộng đã có ở `t-1100.png`, `t-1366.png`, `t-1440.png` (cùng thư mục).

**Thẻ đơn phía khách** (thư mục `couple\`, chạy được bằng mock riêng: tài khoản mock `minh.anh@example.com`, dữ liệu mẫu có sẵn đơn `#001` của "Lumi Wedding Studio"):

| Bước | Tệp |
|---|---|
| Đơn chờ thanh toán cọc (SENT) | `couple\k1-sent.png` |
| Hộp "Yêu cầu chỉnh sửa đơn" | `k2-revise-dialog.png` (ở thư mục `hall\`) |
| Đã yêu cầu chỉnh sửa (REVISION_REQUESTED) | `couple\k3-revision.png` |
| NCC giả gửi lại (về SENT) | `couple\k4-resent.png` |
| Trang thanh toán cọc `/plan/deal/…` | `k5-deal.png` (ở thư mục `hall\`) |
| Trang "Đặt cọc thành công" | `k6-paid-page.png` (ở thư mục `hall\`) |
| Thẻ sau khi cọc (PAID) | `couple\k7-paid.png` |

Không chụp được phía khách ở các trạng thái Completed, Expired, Cancelled và "Deposited có yêu cầu sửa sau cọc" vì **phía khách không có các trạng thái này** (mock khách không sinh ra; backend gộp thành PAID hoặc CANCELLED). Không chạy được phía khách với dịch vụ thật vì lỗi ở mục 5b điểm 11, nên phải chạy bằng mock khách trên một cổng riêng (`VITE_REAL_APIS` rỗng), không ảnh hưởng web đang chạy ở cổng 5173.

## 5. Chỗ lệch cần sửa

### (a) Phía NCC (mình sửa)

1. **Deposited đã qua ngày sự kiện:** dòng gợi ý vẫn là "Đã nhận cọc. Thực hiện ngày …"; chỉ có nút Hoàn tất. Nên đổi gợi ý thành "Đã qua ngày thực hiện, bấm Hoàn tất khi đã xong." (tài liệu chưa quy định, cần chốt).
2. **Bảng: đơn Deposited có yêu cầu sửa sau cọc không có nút chính** (quy tắc hiện tại chỉ cho 3 nút chính). NCC chỉ thấy vạch vàng và nhãn "Yêu cầu sửa". Cân nhắc cho nút chính "Chỉnh sửa" ở trường hợp này (cần chốt với yêu cầu "chỉ hiện 1 nút chính khi đơn cần NCC xử lý").
3. **Cancelled không có nút Tạo lại đơn**: `database.md` 9.5 nói Expired **hoặc Cancelled** muốn tiếp tục thì NCC tạo đơn mới; `THE_DON_HANG.md` chỉ Expired. FE đang theo `THE_DON_HANG.md`. Cần nhóm chốt rồi sửa một trong hai tài liệu.
4. **Dòng gợi ý Pending** chưa kèm hạn ("Chờ khách thanh toán cọc · hạn …" theo tài liệu); hạn đang ở hàng "Hạn đặt cọc" riêng trên thẻ và pill ở bảng. Nhỏ, chỉ khác hình thức.
5. **Tin hệ thống phía NCC không mang lời nhắn của khách** ("Khách đã yêu cầu chỉnh sửa đơn DH…"; lời nhắn chỉ ở hộp cam trên thẻ). Backend lại ghi lời nhắn vào một tin COUPLE ("Yêu cầu chỉnh sửa đơn X:\n<lời nhắn>"). Cần chốt một cách và đồng bộ giữa mock NCC, mock khách, backend (xem 5c).
6. **Người gửi tin FinalInvoice:** mock NCC để NCC gửi, DepositReceipt để hệ thống gửi; tài liệu và CSDL không nói rõ `SenderId` của từng loại. Cần ghi rõ vào `THE_DON_HANG.md` mục 5.
7. **Docs còn tên nút cũ:** `database.md` 9.5 vẫn ghi "Gửi đơn cho khách hàng" (nay là "Gửi đơn").
8. Thông báo (chuông) cho NCC chưa có: OrderRevisionRequested, OrderDeposited, OrderExpired, OrderCancelled... (để sau, đã báo trước).

### (b) Phía khách (gửi Chika)

1. **Mô hình đơn khác hẳn.** `types/order.ts` chỉ có `code`, `packageName`, `depositAmount`, `status` (4 giá trị), `revisionNote`, `paidAt`. Thiếu: `orderCode` thật, `items` (nhiều hạng mục), `depositPercent`, `depositDueDate`, `note`, `revisions`, `invoices`, `customerName`. Khuyến nghị dùng `types/vendorOrder.ts` (đúng CSDL) làm chuẩn chung.
2. **Trạng thái:** chỉ `SENT / REVISION_REQUESTED / PAID / CANCELLED`. Thiếu `Completed` ("Hoàn thành"), `Expired` ("Đã hết hạn"). Tên badge lệch: "Đang chỉnh sửa" (đúng: "Chờ chỉnh sửa"), "Đã cọc" (đúng: "Đã đặt cọc").
3. **Thẻ đơn thiếu nhiều dòng so với `THE_DON_HANG.md` mục 2:** tên NCC, danh sách hạng mục (đang 1 dòng "Gói dịch vụ"), "Đặt cọc (N%)", hạn đặt cọc, ghi chú của NCC, "Còn lại … (tiền mặt, thanh toán trực tiếp cho NCC)" (đang chỉ ghi "thanh toán trực tiếp cho NCC").
4. **Nút lệch:**
   - "Xác nhận & thanh toán cọc" nên là "Thanh toán cọc".
   - Thiếu **Xem chi tiết** ở mọi trạng thái (màn chi tiết gồm bảng hạng mục, lịch thanh toán 2 đợt, lịch sử chỉnh sửa, chứng từ).
   - Sau cọc thiếu **Yêu cầu chỉnh sửa** và **Hủy đơn** (kèm hộp xác nhận "Hủy sau khi cọc sẽ mất cọc").
   - Completed thiếu **Xem hóa đơn**.
   - Expired thiếu **Nhắn tin cho NCC**.
5. **Dòng gợi ý theo trạng thái** (mục 4 của tài liệu) chưa có: "Vui lòng thanh toán cọc trước {hạn}", "Đã gửi yêu cầu chỉnh sửa, chờ NCC cập nhật", "Đã đặt cọc. Còn lại {số tiền} thanh toán trực tiếp cho NCC", "Đơn đã hoàn thành", "Đơn đã hết hạn đặt cọc", "Bạn đã hủy đơn (mất cọc)".
6. **Form Yêu cầu chỉnh sửa chỉ có ô văn bản** và 4 gợi ý nhanh ("Đổi ngày thực hiện, Đổi mức giá, Đổi gói dịch vụ, Đổi tiền cọc") không trùng `OrderRevisionChanges` (Đổi hạng mục, Đổi số lượng, Đổi ngày thực hiện, Khác). Cần chọn nội dung bằng ô tích + lời nhắn bắt buộc; `POST /orders/:id/revision-requests` hiện chỉ nhận `note`, cần thêm `changes`.
7. **Gửi lại đơn:** không thu gọn thẻ cũ (tài liệu yêu cầu "Đơn … đã được cập nhật, xem bản mới nhất bên dưới"). Với backend, mỗi lần gửi lại thêm một thẻ ORDER nữa và cả hai đều hiện nội dung mới nhất.
8. **Tin biên nhận và hóa đơn:** `types/chat.ts` chỉ có `TEXT | ORDER`; `DepositReceipt`, `FinalInvoice` hiện như chữ, thiếu nút Xem. Tin hệ thống chỉ là chữ nền xanh, không phân biệt (hủy, hết hạn nên màu cam).
9. **Mock "NCC giả"** tự sinh đơn kiểu cũ (gói đầu tiên của dịch vụ, cọc 10%, mã `#001`), khác hẳn đơn NCC thật (`DepositPercent` mặc định 30%, làm tròn 100.000đ, mã `DH…`, nhiều hạng mục). Khi nối backend thật thì bỏ.
10. **Mã đơn:** khách thấy `#001`, NCC thấy `DH26100003`; mô hình thật dùng một `OrderCode`.
11. **Khách không mở được chat từ dịch vụ thật (đã tái hiện):** với `VITE_REAL_APIS=catalog,auth`, nút "Nhắn tin với nhà cung cấp" ở trang dịch vụ của danh mục thật báo "Không tìm thấy dịch vụ." vì `mocks/chat.ts` tra `mockCatalog`. Cần nối `chat` và `orders` sang backend, hoặc cho mock chat tạo hội thoại theo dịch vụ thật.
12. **Danh sách hội thoại phía khách** chỉ có nhãn "Đã cọc"; thiếu nhãn theo trạng thái đơn (Chờ cọc, Đã hết hạn…) như phía NCC.
13. **Phương thức thanh toán** (VNPay QR / ATM / thẻ quốc tế) không có trong tài liệu (tài liệu chỉ nói VNPay); chấp nhận được, nhưng cần chốt có giữ không.

### (c) Hai phía chưa dùng chung dữ liệu

1. **Mock với mock:** hai kho riêng (`weddy.mock.vendorOrders.v4` và `weddy.mock.planning`), khác khóa hội thoại (`vc-N` theo khách và `cv-N` theo dịch vụ), khác mã đơn và mô hình. Muốn thử trọn luồng hai chiều bằng mock phải làm một kho chung (hoặc làm backend thật); hiện thử bằng nút Giả lập khách ở phía NCC.
2. **Backend thật:** hai phía chung bảng `Orders`, `Messages`, nhưng phía khách đang đọc qua `toCoupleOrder`/`coupleStatusOf` (gộp trạng thái) và `coupleMessage` (gộp loại tin). Phía NCC đọc qua `toServiceOrder` cũ (versions, installments). Hai bản ánh xạ này đều cần viết lại theo `THE_DON_HANG.md` để hai phía cùng thấy đủ 7 trạng thái và 4 loại tin.
3. **Danh tính hội thoại:** phía khách mở hội thoại theo **dịch vụ** (`serviceId`); phía NCC theo **khách**. Backend lưu `Conversations (CoupleId, VendorId)`, nên một cặp (khách, NCC) chỉ có một hội thoại dù khách xem nhiều dịch vụ của NCC đó. Mock khách đang tạo hội thoại theo từng dịch vụ.
4. **Việc cần làm khi nối thật** (đề xuất thứ tự): (1) backend viết lại đơn và chat theo `orders.md`, `chat.md`, `THE_DON_HANG.md`; (2) phía khách đổi sang `types/vendorOrder.ts`, thêm Xem chi tiết, Hủy đơn, Yêu cầu chỉnh sửa theo `OrderRevisionChanges`, Xem hóa đơn; (3) thêm `chat`, `orders` vào danh sách API thật cho cả hai phía.
