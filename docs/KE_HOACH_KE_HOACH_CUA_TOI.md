# Kế hoạch: "Kế hoạch của tôi", thành viên, chia sẻ (bước 0, chờ duyệt)

Tiến độ: **GĐ 1, 2, 3, 5 xong phần code; ngân sách theo giá gói (thay GĐ 4) xong phần code** (30/10/2026, chưa commit). Còn chờ chạy 4 file SQL (xem docs/LICH_SU_THAY_DOI_DB.md) rồi chạy test tích hợp. Còn của GĐ 4: cảnh báo "Danh sách khách cần n bàn".

29/10: đã **trả lại** mọi thay đổi ở phần chat với nhà cung cấp (backend `modules/chat`, frontend `features/chat`, `ChatPage`, nút chat nổi) vì đó là phần của Chanh. Việc áp quyền thành viên cho chat (viewer không xem chat, editor gửi tin bằng tài khoản mình, thông báo cho cả nhóm) để Chanh làm.

29/10: **viewer chỉ xem được Kế hoạch của tôi** và các subtab được cho phép. Menu chỉ còn "Kế hoạch của tôi"; ẩn nút nổi Yêu thích/Tin nhắn và mục Tin nhắn trong menu tài khoản; mở trang khác (Dịch vụ cưới, chi tiết dịch vụ, Yêu thích, So sánh, Tin nhắn) thì chuyển về `/plan`; trong kế hoạch ẩn các nút "Xem dịch vụ", "Khám phá dịch vụ", "Gợi ý bằng AI". Editor không bị giới hạn này. Hiện chỉ chặn ở frontend.

30/10: làm theo đặc tả **ngân sách theo giá gói và mức chi** (thay phần ngân sách của GĐ 3 và phần giá theo bàn của GĐ 4): bỏ phong cách, thêm Mức chi tiêu, ngân sách hạng mục theo phân vị giá gói, ô sửa tay, cân đối, gói dự kiến và chọn gói, số bàn sửa tay, chi phí khác, ghi đồng thời theo `updated_date`, So sánh dùng ngân sách hạng mục. SQL mới ở `backend/prisma/manual/2026-10-30-01-budget-tiers.sql` (chưa chạy). Chi tiết: `docs/api/weddings.md` mục 7. Còn của GĐ 4: cảnh báo "Danh sách khách cần n bàn" ở tab Khách mời.

Đã chốt thêm khi làm GĐ 3: thêm SheetJS 0.20.3 (tải từ cdn.sheetjs.com, tách chunk tải lười); Q9 theo đề xuất (sửa ngân sách hạng mục chưa tích thì tự tích); kiểm tra từng dòng nhập chỉ nằm ở backend, FE gọi `dryRun` để xem trước; cảnh báo "Danh sách khách cần n bàn" chuyển sang GĐ 4 (cần số bàn).

Trạng thái kế hoạch: bản lần 3. Prototype m gửi ngày 29/10 (`prototype (1).html`) chỉ có phần **Kế hoạch của tôi** là bản mới nhất, các phần khác và dữ liệu mẫu trong đó đã cũ. Vì vậy prototype chỉ dùng làm đặc tả cho Kế hoạch của tôi; trang dịch vụ, chi tiết, yêu thích, chat và đặt cọc giữ như code hiện tại. Bản này ghi lại hiện trạng, đặc tả, các điểm còn cần chốt, việc từng giai đoạn và danh sách migration.

Đã chốt ngày 29/10: dùng chữ **"bàn"** (không dùng "mâm") ở mọi chỗ trên giao diện; dùng cột `min_tables` **đã có** trong DB, không thêm cột; tỷ lệ ngân sách tạm theo P3, m sẽ sửa sau; đúng là **6 hạng mục**.

---

## A. Hiện trạng đã kiểm tra

| # | Điều đã kiểm tra | Ảnh hưởng |
|---|---|---|
| A1 | `docs/prototype/prototype.html` trong repo không có phần Kế hoạch của tôi mới. Bản m gửi chỉ mới ở phần này. | Không chép đè prototype vào repo. Mọi chi tiết cần dùng đã ghi ở mục P. |
| A2 | Repo **không dùng Prisma migrate**: `prisma/migrations/` trống, `schema.prisma` lấy từ DB bằng `db pull`. Nhóm sửa DB bằng file SQL chạy tay (`prisma/sql/*.sql`). | Xem **Q2**. |
| A3 | Backend **không dùng DTO hay class-validator**. Các service tự validate rồi ném `VALIDATION_ERROR` kèm `details`. | Code mới viết theo cách đang có. |
| A4 | Backend **chưa có test và lint**. Dev và DB dùng chung một Supabase. Máy này không có Docker và không có Postgres. | Xem **Q3**, **Q4**. |
| A5 | RLS bật ở cả 27 bảng, bảng riêng tư không có policy. Backend dùng role chủ. | Bảng mới: bật RLS, không thêm policy. |
| A6 | DB chỉ có **6 hạng mục**: Trung tâm tổ chức sự kiện (slug `nha-hang`), Trang trí (`decor`), Trang phục, Trang điểm (`makeup`), Chụp ảnh, Hoa cưới. Đây là danh sách đúng. | Tỷ lệ ngân sách áp cho 6 hạng mục này, xem **P3**. |
| A7 | Nhà hàng: mỗi **sảnh là một `service_package`** có `capacity`, `price` (giá một bàn) và `min_tables`. Ví dụ Mipec Place có 4 sảnh 300–600 khách, giá 5,0–5,8 triệu/bàn, tối thiểu 20–40 bàn. Một sảnh có **một giá**, còn trong prototype mỗi sảnh có khoảng giá từ p đến pmax. | Khoảng ước tính lấy theo các sảnh đủ chỗ. Ghim một sảnh thì giá thấp nhất bằng giá cao nhất. Dùng `min_tables` có sẵn, xem **P8**. |
| A8 | Đơn vị tính hiện suy ra bằng regex trên mô tả (`catalog/services.service.ts:226`). Hàm `tablesNotTrays` đổi chữ "mâm" trong mô tả NCC thành "bàn". | Thêm cột đơn vị tính để thay regex. **Giữ** hàm đổi chữ thành "bàn". |
| A9 | `conversations.couple_id`, `notifications.user_id` và socket room `user:<id>` đều gắn với một tài khoản. Có 30 chỗ dùng `couple_id`. | Xem **Q6**. |
| A10 | `weddings.user_id` là cột unique, DB có 13 đám cưới. Form hiện tại cho phép bỏ trống tên. | GĐ 1 đổi thành bắt buộc. |
| A11 | Nhánh `Chie` có 3 file sửa chưa commit. Module orders và chat là của Chanh. | Làm trên nhánh mới, báo Chanh trước GĐ 2. |

---

## P. Đặc tả lấy từ phần Kế hoạch của tôi trong prototype (đã chốt, không cần hỏi)

Chỉ lấy hành vi và chữ hiển thị. Không lấy dữ liệu mẫu và các phần ngoài Kế hoạch của tôi. Chữ "mâm" trong prototype đều đổi thành "bàn".

**P1. Đầu trang Kế hoạch.** Tiêu đề `<Chú rể> & <Cô dâu>`, dòng `<dd/mm/yyyy>, còn n ngày`, avatar (chữ cái đầu, owner tô màu vàng, link mời đang chờ viền nét đứt). Nút "Chia sẻ kế hoạch" cho owner, "Người tham gia" cho người khác. Nút "Chỉnh sửa thông tin" bị khóa với viewer. Có 5 subtab kèm icon, tab Dịch vụ hiện số lượng.

**P2. Tổng quan.**
- Hàng 3 thẻ:
  - Công việc: `x/y việc đã xong`, thanh tiến độ, "n việc quá hạn" hoặc "Chưa có việc nào quá hạn".
  - Ngân sách: dự kiến chi trên tổng, thanh ghép Đã cọc / Chưa cọc / Còn lại hoặc Vượt.
  - Khách mời: tổng trên dự kiến, "Vượt n khách so với dự kiến" hoặc "Đã mời x, sẽ đến y".
- Cột trái:
  - Việc sắp đến hạn: 5 việc, chữ "Còn n ngày" khi ≤ 7 ngày, "Quá hạn n ngày", "Hạn hôm nay".
  - Tiến độ theo hạng mục, có thêm nhóm "Việc chung".
  - Phân công: chỉ hiện khi đã có việc được giao. Bấm vào thì mở Timeline lọc theo người đó.
- Cột phải:
  - Phong cách và dịch vụ: chỉ có Phong cách và Dịch vụ muốn dùng.
  - Chi phí theo hạng mục: biểu đồ tròn, chú thích ghi "vượt", có lát "Chi phí khác".
  - Người cùng lập kế hoạch.
- Lời nhắc "Hiện chỉ mình bạn xem được kế hoạch này" khi owner chưa mời ai.

**P3. Ngân sách.** Tỷ lệ mặc định tạm thời (m sẽ sửa sau), đặt thành một hằng số duy nhất ở backend để dễ đổi. Gắn vào 6 hạng mục: nhà hàng 40%, decor 12%, chụp ảnh 10%, trang phục 8%, hoa cưới 8%, makeup 6% (tổng 84%).
- Ngân sách hạng mục = giá trị đã lưu, nếu chưa có thì lấy tổng × tỷ lệ, làm tròn 100.000đ. Prototype không chuẩn hóa về 100%, t giữ nguyên như vậy.
- Bốn thẻ số: Tổng ngân sách, Dự kiến chi, Còn lại hoặc Vượt ngân sách, Đã đặt cọc.
- Dự kiến chi = giá các dịch vụ trong kế hoạch + chi phí khác. Giá một dịch vụ = tổng đơn nếu đã có đơn, nếu chưa thì là ước tính thấp nhất.
- Bảng: Hạng mục, Ngân sách hạng mục (sửa được, số nhạt là số tự tính), Dịch vụ đã chọn, Trạng thái, Giá (nhà hàng chưa có đơn ghi "đến <cao nhất>"), Chênh lệch "Còn/Vượt".
- Banner khi tổng phân bổ lớn hơn tổng ngân sách. Nút "Đặt lại theo tỷ lệ gợi ý". Không có biểu đồ ở tab này.
- Chi phí khác chỉ gồm **tên khoản chi và số tiền**. Có thêm, xóa và nhập từ Excel.

**P4. Timeline.**
- Có thanh tiến độ, các nút Tải về, Nhập từ Excel, Thêm việc.
- Lọc theo hạng mục. Lọc theo phụ trách chỉ hiện khi có việc được giao, gồm Tất cả, Cô dâu, Chú rể, Cả hai, từng người thân, Chưa giao, mỗi mục kèm số việc.
- Các dòng việc bị khóa gộp thành một dòng "Việc chi tiết của a, b, c". Lọc theo người thì không hiện dòng này.
- Bấm chip phụ trách hoặc "Giao việc" để mở menu nhỏ. Bấm hạn để mở ô chọn ngày, chọn là lưu luôn. Sau mỗi thao tác hiện thông báo kèm nút "Hoàn tác".
- Giao việc cho người chỉ xem thì báo "… đang chỉ xem nên chưa tích xong được", owner có thêm nút "Cho phép chỉnh sửa".
- Thành viên là Cô dâu hoặc Chú rể thì được tính là `Bride`/`Groom`, không phải `Member`.
- Có "Xong bởi <tên>".
- **Mỗi việc có một ghi chú** (tối đa 200 ký tự), kèm người viết và ngày. Người cùng lập kế hoạch đều thấy, link công khai thì không.
- Hộp sửa việc gồm tên (chỉ việc tự thêm), hạn, phụ trách, ghi chú.

**P5. Khách mời.**
- Thẻ số: Tổng/dự kiến, Đã mời, Sẽ đến, Từ chối, Chưa phản hồi.
- Biểu đồ "Phản hồi của khách mời" và thanh Nhà trai/Nhà gái nằm ngay ở tab này.
- Lọc: Tất cả, Nhà trai, Nhà gái, Chưa mời, Sẽ đến.
- Mỗi khách gồm: tên, bên, nhóm (Gia đình, Họ hàng, Bạn bè, Đồng nghiệp, Khác, hoặc tự nhập tối đa 30 ký tự), số người ≥ 1, đã mời, phản hồi (Chưa phản hồi, Sẽ đến, Từ chối).
- Phản hồi chỉ chọn được khi đã mời. Bỏ "đã mời" thì phản hồi về lại chưa phản hồi.
- Thêm nhiều khách bằng cách mỗi dòng một tên, chọn chung bên và nhóm.
- Cảnh báo "Danh sách khách cần n bàn (x khách), bạn đang để m bàn", kèm nút "Cập nhật số bàn". Chỉ hiện khi kế hoạch có hạng mục nhà hàng.

**P6. Nhập và xuất.**
- Ghép cột tự động theo từ đồng nghĩa (bỏ dấu), có ô chọn tay. Xem trước 50 dòng, đánh dấu dòng lỗi. Tối đa 500 dòng, 2 MB.
- Khách mời và Chi phí khác có lựa chọn "Thêm vào" hoặc "Thay toàn bộ". Công việc chỉ thêm vào.
- Kiểm tra trùng khách theo tên + bên, cả trong file lẫn với danh sách hiện có.
- Ngày tháng/ngày/năm chỉ được chọn khi trong cột có ngày mà số thứ hai lớn hơn 12, và không có ngày nào số đầu lớn hơn 12.
- Phụ trách: CD là cô dâu, CR là chú rể, "Tất cả" hoặc "Cả hai" là cả hai, tên thành viên là người đó. Cụm lạ thì bỏ qua, không đoán.
- Số tiền nhận được dạng "5tr" hay "5 triệu".
- Tải về `khach-moi.csv`, `cong-viec.csv`, `ngan-sach.csv` (UTF-8 có BOM) và ba file mẫu.

**P7. Chia sẻ.**
- Link xem công khai: một nút bật/tắt. Chọn tab được xem (Tổng quan, Timeline và Dịch vụ mặc định bật; Ngân sách và Khách mời mặc định tắt; tắt được mọi tab, miễn còn ít nhất 1 tab).
- Người xem công khai:
  - Header chỉ có Đăng nhập và Đăng ký.
  - Có banner "Bạn đang xem kế hoạch này qua liên kết chia sẻ".
  - Tổng quan ẩn thẻ của các tab bị tắt.
  - Tab Dịch vụ chỉ hiện giá khi tab Ngân sách được bật.
  - Thành viên chỉ hiện tên.
- Link mời gồm: quan hệ (Cô dâu, Chú rể, Người thân), tên hiển thị không bắt buộc (tối đa 40 ký tự), quyền (chọn Cô dâu hoặc Chú rể thì mặc định Chỉnh sửa, Người thân thì mặc định Chỉ xem). Tối đa 10 link chờ, có thông báo lỗi riêng. Danh sách link chờ có nút sao chép và thu hồi.
- **Chọn subtab cho từng người được mời** (chốt 29/10), giống chọn tab của link công khai:
  - Tab nào cũng tắt được, kể cả Tổng quan, miễn còn **ít nhất 1 tab** (áp dụng cho cả lời mời lẫn link công khai; khác prototype, nơi Tổng quan luôn bật). Vào `/plan` hoặc `/xem/:token` thì mở tab đầu tiên được xem.
  - Mặc định: Cô dâu và Chú rể được xem cả 5 tab; Người thân được xem Tổng quan, Timeline, Dịch vụ (Ngân sách và Khách mời tắt).
  - Owner chọn khi tạo link mời, đổi lại được bất cứ lúc nào trong danh sách thành viên. Owner luôn xem tất cả.
  - Áp dụng cho cả editor và viewer. Editor chỉ sửa được trong các tab mình được xem.
  - Backend chặn API của tab không được xem (403), Tổng quan không trả số liệu của tab đó. Frontend ẩn tab.
- **Chat** (chốt 29/10): viewer **không** xem được chat. Owner và editor có tab Dịch vụ thì chat và đặt cọc được, editor gửi tin bằng tài khoản của mình. Hội thoại vẫn gắn với owner. Thông báo tin nhắn và đơn chỉ gửi cho owner và editor.
- Owner đổi quyền thành viên (Chỉnh sửa hoặc Chỉ xem) và xóa thành viên. Xóa thành viên thì bỏ luôn phân công của người đó.

**P8. Gợi ý AI và bàn.**
- Ngân sách hạng mục lấy giá trị đã lưu, nếu chưa có thì lấy theo tỷ lệ.
- Sảnh đủ chỗ là sảnh có `capacity` ≥ **số khách dự kiến**.
- Số bàn tối thiểu lấy từ cột `min_tables` đã có trong DB. Ước tính một sảnh = `max(số bàn, min_tables) × giá bàn`. Khi số bàn nhỏ hơn mức tối thiểu, lý do ghi thêm "Sảnh X yêu cầu tối thiểu n bàn". Đây là cách t chọn mặc định, m muốn chỉ hiện chữ nhắc mà không tính vào ước tính thì báo.
- Mỗi gợi ý ghi lý do dạng `n bàn × a đến b mỗi bàn, khoảng X đến Y`, `Sảnh đủ chỗ: …`, và "Trong ngân sách hạng mục dù chọn menu cao nhất" hoặc "…có thể vượt nếu chọn menu cao".
- Khi không có kết quả: hiện "Lựa chọn rẻ nhất phù hợp là …", nút "Tăng ngân sách <hạng mục> lên X" kèm Hoàn tác. Nếu không nhà hàng nào đủ chỗ thì hiện nút "Sửa số khách dự kiến".
- Menu "Sửa" số bàn gồm: ô số (1–500) và "Dùng số tự tính (n bàn)". Phần chọn sảnh chỉ có khi NCC đã nằm trong kế hoạch và chưa có đơn.
- Danh sách bên dưới ghi "n dịch vụ khác, ngoài các gợi ý ở trên".

**Không làm (chỉ là mô phỏng trong prototype):** "Xem với tư cách này", "Mô phỏng: người nhận mở link", `DEV_AUTOFILL`, thanh mô phỏng NCC, ô "Hiện mã chức năng", dữ liệu mã hóa trong link `#chia-se=`.

---

## B. Điểm còn cần m quyết định

⛔ là phải có câu trả lời trước giai đoạn ghi trong ngoặc.

**Q2 ⛔ (trước GĐ 1) Cách migration.** *Đề xuất:* giữ cách của nhóm. Viết `backend/prisma/sql/2026-10-29-*.sql` chạy lại nhiều lần vẫn an toàn (`IF NOT EXISTS`) và giữ dữ liệu cũ, sau đó `db pull` rồi `generate`. T chỉ chạy lên Supabase dùng chung khi m đồng ý cho từng file. Cách khác là chuyển sang Prisma migrate với baseline `0_init`, nhưng cách này phải chốt với cả nhóm.

**Q3 ⛔ (trước GĐ 2) DB để chạy test.** Test phân quyền phải ghi dữ liệu. *Đề xuất:* một project Supabase riêng cho test (`TEST_DATABASE_URL`), hoặc m cài Docker Desktop để chạy Postgres trên máy.

**Q4 ⛔ (trước GĐ 3) Thư viện.**
- Đọc Excel: *đề xuất* `xlsx` (SheetJS) bản 0.20.x tải từ `cdn.sheetjs.com`, dùng ở frontend và tải lười. Prototype đang dùng bản 0.18.5, bản này có lỗi bảo mật đã công bố.
- Test: `node --test`, không thêm thư viện.
- Lint: chưa thêm.
- Biểu đồ: tự vẽ SVG như prototype.
- Giới hạn tần suất: tự viết, không thêm thư viện.

**Q5 (đã chốt 30/10, làm theo đề xuất) Người nhận lời mời đã có đám cưới riêng.**
- Nếu đám cưới riêng chưa có hội thoại, đơn hay thanh toán: hỏi "Bỏ kế hoạch riêng để tham gia?", đồng ý thì xóa đám cưới đó rồi nhận lời mời.
- Nếu đã có: từ chối với `ALREADY_IN_WEDDING`.
- Đang là thành viên đám cưới khác thì phải rời trước.
- Tài khoản NCC hoặc Admin thì từ chối.

**Q6 ⛔ (trước GĐ 2) Chat, đơn và thông báo khi có nhiều thành viên.** Prototype không chặn viewer mở chat, chỉ chặn thêm hay bỏ dịch vụ và đặt cọc. *Đề xuất:*
- Hội thoại vẫn gắn với owner (`couple_id = weddings.user_id`).
- Owner và editor gửi tin bằng tài khoản của mình. Viewer **xem được, không gửi được**.
- Thông báo và realtime gửi tới mọi thành viên.
- Yêu thích và So sánh vẫn là của riêng từng tài khoản (prototype không chia sẻ hai phần này).

**Q7 Tên giá trị enum.** *Đề xuất* theo kiểu PascalCase đang dùng trong DB:
- role: `Owner|Editor|Viewer`
- quan hệ: `Bride|Groom|Relative`
- bên: `Bride|Groom`
- phản hồi: `Pending|Attending|Declined`
- phụ trách: `Bride|Groom|Both|Member`
- đơn vị tính: `Table|Package`

Mọi cột có ràng buộc `CHECK`.

**Q9 Ngân sách cho hạng mục không nằm trong "Dịch vụ muốn dùng".** Prototype vẫn hiện hạng mục có dịch vụ trong kế hoạch dù không được tích. *Đề xuất:* khi sửa ngân sách của hạng mục đó thì tự thêm vào `wedding_categories` (tức là tự tích luôn "muốn dùng"). Cách khác là thêm một bảng ngân sách riêng.

**Q10 Tên route.** *Đề xuất:* `/plan` chuyển sang `/plan/tong-quan`, các tab còn lại là `/plan/timeline`, `/plan/dich-vu`, `/plan/ngan-sach`, `/plan/khach-moi`. `/timeline` chuyển sang `/plan/timeline`. Giữ nguyên `/plan/deal/:dealId`. Link mời là `/moi/:token`, link xem là `/xem/:token/<tab>`.

**Q12 Cách chia nhánh.** Mỗi giai đoạn một nhánh `feature/fe-be-plan-<gđ>` tách từ `Chie`. Làm và duyệt lần lượt từng giai đoạn.

---

## C. Thiết kế dữ liệu (file SQL theo giai đoạn)

| File SQL | Nội dung | Giữ dữ liệu cũ |
|---|---|---|
| `…-01-wedding-members.sql` (GĐ 2) | `wedding_members (id, wedding_id, user_id UNIQUE, role, relation, display_name, tabs text[], joined_date)`, unique `(wedding_id, user_id)`. Thêm owner từ `weddings.user_id` (`ON CONFLICT DO NOTHING`). Giữ `weddings.user_id` làm owner. | Mỗi đám cưới cũ có owner |
| `…-02-timeline-assign.sql` (GĐ 3) | `timeline_tasks`: `assignee`, `assignee_user_id`, `note varchar(200)`, `note_by`, `note_date`, `completed_by` | Cột mới cho phép rỗng |
| `…-03-budget.sql` (GĐ 3) | `wedding_categories.budget_amount numeric(18,2)` cho phép rỗng. `wedding_expenses (id, wedding_id, title varchar(100), amount numeric(18,2) > 0, created_by, created_date, updated_date)` | Có |
| `…-04-guests.sql` (GĐ 3) | `wedding_guests (id, wedding_id, full_name varchar(100), side, group_name varchar(30), party_size ≥ 1, is_invited, rsvp_status, created_date, updated_date)`. Ràng buộc: `rsvp_status = 'Pending'` khi chưa mời | Bảng mới |
| `…-05-table-pricing.sql` (GĐ 4) | `service_packages.pricing_unit` mặc định `'Package'`. Gói của hạng mục nhà hàng có `capacity` thì gán `'Table'`. `weddings.table_count_override int` cho phép rỗng. `plan_vendors.package_id uuid` cho phép rỗng, khóa ngoại tới `service_packages` | Có |
| `…-06-invites-share.sql` (GĐ 5) | `wedding_invites (id, wedding_id, token_hash char(64) UNIQUE, role, relation, display_name varchar(40), tabs text[], created_by, expires_date, used_by, used_date, revoked_date, created_date)`. `wedding_share_links (id, wedding_id UNIQUE, token_hash UNIQUE, is_enabled, tabs text[], created_date, updated_date)` | Bảng mới |

Mọi bảng mới: khóa chính uuid, tên snake_case, ngày theo kiểu `timestamptz`, có `COMMENT ON`, bật RLS và không có policy. Sau mỗi file: `db:pull`, `db:generate`, cập nhật `docs/database.md`.

---

## D. Việc theo giai đoạn

### GĐ 1: Điều hướng và khung trang
- FE:
  - [CoupleLayout.tsx](../frontend/src/layouts/CoupleLayout.tsx) bỏ tab "Lập Timeline". Tab "Kế hoạch của tôi" hiện số dịch vụ.
  - [paths.ts](../frontend/src/routes/paths.ts) và [router.tsx](../frontend/src/routes/router.tsx): route con, chuyển hướng `/timeline`.
  - Trang mới `pages/couple/PlanLayoutPage.tsx` gồm đầu trang (P1), thanh subtab và `<Outlet/>`. Nội dung `TimelinePage` và `PlanPage` chuyển vào hai tab Timeline và Dịch vụ. Tổng quan, Ngân sách, Khách mời tạm để khung trống.
  - [WeddingForm.tsx](../frontend/src/features/weddings/components/WeddingForm.tsx) theo đúng thứ tự trường và câu báo lỗi của prototype, form tạo và form sửa dùng chung.
- BE: [weddings.service.ts](../backend/src/modules/weddings/weddings.service.ts) bắt buộc tên cô dâu và chú rể, bỏ nhận `location`.
- Tài liệu: `docs/api/weddings.md`.

### GĐ 2: Thành viên và phân quyền
- `common/decorators/wedding-access.decorator.ts` và `common/guards/wedding-access.guard.ts`. Guard gắn `req.wedding = { id, ownerId, role }` và trả 403 `WEDDING_FORBIDDEN` nếu không đủ quyền.
- Module `modules/wedding-members/`: `GET /weddings/me/members`, `PATCH /weddings/me/members/:userId` (owner), `DELETE /weddings/me/members/:userId` (owner xóa người khác, hoặc thành viên tự rời).
- Thay cách tìm đám cưới theo `user_id` bằng membership ở: weddings, timeline, ai-suggest, `compare.controller.ts:40`, `orders.service.ts:90,147,359`, `chat.service.ts:117-155`, payments. Thông báo và realtime gửi tới mọi thành viên.
- FE: `useWeddingRole`, khóa nút theo quyền (giống `ro()` trong prototype), avatar và thẻ thành viên.

### GĐ 3: Các subtab
- `GET /weddings/me/overview`: một endpoint cho toàn bộ P2.
- Timeline: `PATCH timeline/items/:id` nhận thêm `assignee`, `assigneeUserId`, `note`. Đánh dấu xong thì lưu `completed_by`. Giao diện theo P4.
- Ngân sách: `GET /weddings/me/budget`, `PATCH /weddings/me/budget/categories/:slug`, `POST /weddings/me/budget/reset`. Chi phí khác có `GET/POST/DELETE /weddings/me/expenses`. AI đọc chung số liệu này.
- Khách mời: `GET/POST/PATCH/DELETE /weddings/me/guests`, `POST /weddings/me/guests/bulk`.
- Nhập: `POST /weddings/me/import/{guests|tasks|expenses}` nhận `{ rows, mode, dryRun }`, backend kiểm tra lại từng dòng theo P6. Xuất: `GET /weddings/me/export/{guests|tasks|budget}.csv` và `GET /weddings/me/import/{type}/template.csv`. Phần chuẩn hóa dữ liệu viết thành hàm thuần dùng chung cho FE và BE, có unit test.

### GĐ 4: Giá theo bàn và gợi ý AI
- `modules/weddings/table-math.ts` (hàm thuần, có unit test): `tableCount`, `restaurantEstimate`, `classifySuggestion`.
- `PATCH /weddings/me` nhận `tableCountOverride`. `PATCH /weddings/me/plan-items/:id { packageId | null }` để ghim sảnh.
- [ai-suggest.service.ts](../backend/src/modules/weddings/ai-suggest.service.ts) làm theo P8. Catalog đọc `pricing_unit`, bỏ regex. Trang tạo gói phía NCC thêm trường đơn vị tính.
- FE theo P8. Kết quả AI hiện ở đầu trang Dịch vụ và tự cuộn tới. Nút quay lại về đúng nơi đã bấm.

### GĐ 5: Chia sẻ và lời mời
- `modules/wedding-sharing/` theo P7:
  - Owner: `GET/POST /weddings/me/invites`, `DELETE /weddings/me/invites/:id`.
  - `GET /invites/:token` có giới hạn tần suất. `POST /invites/:token/accept` cho tài khoản cặp đôi.
  - Owner: `GET/PUT /weddings/me/share-link`, `POST /weddings/me/share-link/regenerate`.
  - Công khai: `GET /public/plans/:token[/<tab>]`, dữ liệu lọc ở backend.
  - Mã link 32 byte, DB chỉ lưu SHA-256.
- Dựng link bằng `FRONTEND_URL`. Biến này đã có trong `backend/.env.example`, chỉ cần cập nhật README.
- FE: `/moi/:token` (đăng nhập hoặc đăng ký xong thì tự nhận lời mời và bỏ qua form thiết lập), `/xem/:token/*`, hộp "Chia sẻ kế hoạch".

---

## E. Kiểm thử
- Unit (`node --test`): số bàn, ước tính sảnh (có số bàn tối thiểu theo P8), phân loại AI, chuẩn hóa dữ liệu nhập (CD/CR, ngày tháng/ngày/năm, "5tr"), CSV có BOM.
- Tích hợp trên DB test (Q3):
  - viewer gọi mọi endpoint ghi đều nhận 403. Danh sách endpoint lấy từ metadata của route để không bỏ sót;
  - editor không mời được, không đổi được quyền;
  - link mời hết hạn, đã dùng hoặc đã thu hồi đều bị từ chối;
  - link công khai không trả tab bị tắt, tắt link hoặc tạo lại thì link cũ trả 404;
  - người ngoài đám cưới không đọc được.
- Mỗi giai đoạn chạy typecheck, build và test ở cả hai phía.

## F. Rủi ro
- Sửa các module orders, chat và payments của Chanh: dễ xung đột khi gộp.
- SQL chạy trên Supabase dùng chung ảnh hưởng ngay tới cả nhóm. Mọi cột mới đều cho phép rỗng hoặc có giá trị mặc định.
- Giới hạn tần suất trong bộ nhớ không dùng được khi chạy nhiều tiến trình.
- Repo chưa dựng được DB mới từ đầu.
