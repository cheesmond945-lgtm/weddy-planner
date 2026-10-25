# Cơ sở dữ liệu WebPlan

> Chuyển nguyên văn từ tài liệu CSDL của nhóm (Bản sao của CSDL.docx). Đây là nguồn chuẩn cho tên bảng, tên cột, enum và quy tắc nghiệp vụ.

### 1. Bảng thực thể

  -----------------------------------------------------------------------
  **STT**      **Đối tượng**                    **Tên thực thể**
  ------------ -------------------------------- -------------------------
  1            Người dùng                       Users

  2            Thông tin đám cưới               Weddings

  3            Công việc timeline               TimelineTasks

  4            Lịch sử tìm kiếm                 SearchHistories

  5            Yêu cầu tư vấn                   ConsultationRequests

  6            Hồ sơ nhà cung cấp               VendorProfiles

  7            Giấy tờ hồ sơ nhà cung cấp       VendorDocuments

  8            Xác minh hồ sơ nhà cung cấp      VendorVerifications

  9            Loại dịch vụ                     ServiceCategories

  10           Gói dịch vụ                      ServicePackages

  11           Ảnh gói dịch vụ                  PackageAlbums

  12           Xác minh gói dịch vụ             PackageVerifications

  13           Hội thoại                        Conversations

  14           Tin nhắn                         Messages

  15           Đơn dịch vụ                      Orders

  16           Chi tiết đơn                     OrderItems

  17           Lịch sử chỉnh sửa đơn            OrderRevisions

  18           Thanh toán đặt cọc               Payments

  19           Hóa đơn, giấy xác nhận cọc       Invoices

  20           Hoa hồng của đơn                 Commissions

  21           Bảng kê hoa hồng theo tháng      CommissionStatements

  22           Thông báo                        Notifications
  -----------------------------------------------------------------------

**Ba bảng nối ở mức logic** (tách từ các quan hệ n:n):

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bảng nối**                        **Tách từ quan hệ**                                             **Ý nghĩa**
  ----------------------------------- --------------------------------------------------------------- -------------------------------------------------------------------------------------------
  FavoriteVendors (Id, CreatedDate)   Người dùng -- Yêu thích -- Hồ sơ nhà cung cấp                   Nhà cung cấp khách đã yêu thích, dùng để so sánh

  PlanVendors (Id, CreatedDate)       Thông tin đám cưới -- Thêm vào kế hoạch -- Hồ sơ nhà cung cấp   Nhà cung cấp khách đã thêm vào Kế hoạch của tôi

  WeddingCategories (Id)              Thông tin đám cưới -- Muốn sử dụng -- Loại dịch vụ              Các loại dịch vụ khách tích khi điền thông tin đám cưới, dùng để tạo timeline và kế hoạch
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 2. Bảng thuộc tính

**Users (Người dùng)**

  -----------------------------------------------------------------------
  **Thuộc tính**            **Ý nghĩa**
  ------------------------- ---------------------------------------------
  Id                        Mã người dùng

  Username                  Tên đăng nhập

  Email                     Email, dùng để đăng nhập

  FullName                  Họ và tên

  PasswordHash              Mật khẩu đã mã hóa

  PhoneNumber               Số điện thoại

  Role                      Vai trò

  Status                    Trạng thái tài khoản

  CreatedDate               Ngày tạo tài khoản

  LastLoginAt               Lần đăng nhập gần nhất
  -----------------------------------------------------------------------

**Weddings (Thông tin đám cưới)**

  -----------------------------------------------------------------------
  **Thuộc tính**                  **Ý nghĩa**
  ------------------------------- ---------------------------------------
  Id                              Mã đám cưới

  GroomName, BrideName            Tên chú rể, tên cô dâu

  WeddingDate                     Ngày cưới

  Budget                          Tổng ngân sách

  GuestCount                      Số lượng khách (sức chứa dự kiến)

  City                            Thành phố tổ chức

  Style                           Phong cách

  CreatedDate, UpdatedDate        Ngày tạo, ngày cập nhật
  -----------------------------------------------------------------------

**TimelineTasks (Công việc timeline)**

  -------------------------------------------------------------------------------------------
  **Thuộc tính**         **Ý nghĩa**
  ---------------------- --------------------------------------------------------------------
  Id                     Mã công việc

  Title                  Tên công việc

  ScheduledDate          Ngày dự kiến thực hiện

  Status                 Trạng thái công việc

  CompletedDate          Ngày hoàn thành thực tế

  TaskType               Việc khung hay việc chi tiết (cùng cấp trong một loại dịch vụ)

  TaskCode               Mã mẫu công việc do hệ thống sinh, để trống với việc khách tự thêm

  DisplayOrder           Thứ tự hiển thị trong cùng một loại dịch vụ

  CreatedDate            Ngày tạo
  -------------------------------------------------------------------------------------------

**SearchHistories (Lịch sử tìm kiếm)**

  -----------------------------------------------------------------------
  **Thuộc tính**                       **Ý nghĩa**
  ------------------------------------ ----------------------------------
  Id                                   Mã lượt tìm kiếm

  Keyword                              Từ khóa

  CreatedDate                          Thời điểm tìm
  -----------------------------------------------------------------------

**ConsultationRequests (Yêu cầu tư vấn)**

  -----------------------------------------------------------------------------------------------
  **Thuộc tính**             **Ý nghĩa**
  -------------------------- --------------------------------------------------------------------
  Id                         Mã yêu cầu

  BrandName                  Tên thương hiệu / studio

  ContactName                Người liên hệ

  PhoneNumber                Số điện thoại

  Email                      Email liên hệ, dùng để tạo tài khoản nhanh

  IsContacted                Admin đã liên hệ hay chưa

  ContactedDate              Ngày liên hệ (lấy từ lúc tích đã liên hệ)

  Qualification              Kết quả đánh giá tiêu chuẩn (đạt thì hiện nút tạo tài khoản nhanh)

  AdminNote                  Ghi chú nội bộ của admin

  CreatedDate, UpdatedDate   Ngày gửi yêu cầu, ngày cập nhật
  -----------------------------------------------------------------------------------------------

**VendorProfiles (Hồ sơ nhà cung cấp)**

  -------------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**             **Ý nghĩa**
  -------------------------- ----------------------------------------------------------------------------------------------------
  Id                         Mã hồ sơ

  BusinessName               Tên doanh nghiệp / cửa hàng

  TaxCode                    Mã số thuế

  RepresentativeName         Người đại diện

  Address                    Địa chỉ

  City                       Thành phố

  Ward                       Phường / xã

  GoogleMapsUrl              Liên kết Google Maps do nhà cung cấp dán (tùy chọn). Để trống thì hệ thống tự ghép link từ địa chỉ

  Description                Giới thiệu

  WorkingHours               Giờ làm việc

  Status                     Trạng thái hồ sơ

  CreatedDate, UpdatedDate   Ngày tạo, ngày cập nhật
  -------------------------------------------------------------------------------------------------------------------------------

**VendorDocuments (Giấy tờ hồ sơ nhà cung cấp)**

  -----------------------------------------------------------------------
  **Thuộc tính**                  **Ý nghĩa**
  ------------------------------- ---------------------------------------
  Id                              Mã giấy tờ

  DocumentType                    Loại giấy tờ

  Url                             Đường dẫn file ảnh

  DisplayOrder                    Thứ tự hiển thị

  CreatedDate                     Ngày tải lên
  -----------------------------------------------------------------------

**VendorVerifications (Xác minh hồ sơ nhà cung cấp)**

  -----------------------------------------------------------------------
  **Thuộc tính**       **Ý nghĩa**
  -------------------- --------------------------------------------------
  Id                   Mã lần duyệt (mỗi lần nộp là một dòng)

  Status               Kết quả duyệt

  AdminNote            Lý do yêu cầu chỉnh sửa / bổ sung

  SubmittedDate        Ngày nộp

  ReviewedDate         Ngày duyệt
  -----------------------------------------------------------------------

**ServiceCategories (Loại dịch vụ)**

  -----------------------------------------------------------------------
  **Thuộc tính**            **Ý nghĩa**
  ------------------------- ---------------------------------------------
  Id                        Mã loại dịch vụ

  Name                      Tên loại

  Description               Mô tả

  CommissionRate            Tỷ lệ hoa hồng (%) của loại này
  -----------------------------------------------------------------------

**ServicePackages (Gói dịch vụ)**

  ------------------------------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**             **Ý nghĩa**
  -------------------------- ---------------------------------------------------------------------------------------------------------------------
  Id                         Mã gói

  Name                       Tên gói

  Description                Mô tả gói

  Tags                       Từ khóa, phong cách của gói, dùng để lọc và gợi ý

  Price                      Giá cụ thể của gói. Khoảng giá hiển thị ở nhà cung cấp tính từ giá thấp nhất đến cao nhất của các gói đang hiển thị

  Capacity                   Sức chứa (gói của trung tâm tổ chức sự kiện)

  Status                     Trạng thái gói

  CreatedDate, UpdatedDate   Ngày tạo, ngày cập nhật
  ------------------------------------------------------------------------------------------------------------------------------------------------

**PackageAlbums (Ảnh gói dịch vụ)**

  -----------------------------------------------------------------------
  **Thuộc tính**              **Ý nghĩa**
  --------------------------- -------------------------------------------
  Id                          Mã ảnh

  Url                         Đường dẫn ảnh

  DisplayOrder                Thứ tự hiển thị trong bộ sưu tập

  IsCover                     Ảnh bìa của gói
  -----------------------------------------------------------------------

**PackageVerifications (Xác minh gói dịch vụ)**

  -----------------------------------------------------------------------
  **Thuộc tính**                **Ý nghĩa**
  ----------------------------- -----------------------------------------
  Id                            Mã lần duyệt

  Status                        Kết quả duyệt

  AdminNote                     Lý do yêu cầu chỉnh sửa

  ReviewedDate                  Ngày duyệt

  CreatedDate                   Ngày gửi duyệt
  -----------------------------------------------------------------------

**Conversations (Hội thoại)**

  ------------------------------------------------------------------------------
  **Thuộc tính**    **Ý nghĩa**
  ----------------- ------------------------------------------------------------
  Id                Mã hội thoại (mỗi cặp khách và nhà cung cấp một hội thoại)

  LastMessageDate   Thời điểm tin nhắn gần nhất, để sắp xếp danh sách

  CreatedDate       Ngày bắt đầu hội thoại
  ------------------------------------------------------------------------------

**Messages (Tin nhắn)**

  -----------------------------------------------------------------------
  **Thuộc tính**                **Ý nghĩa**
  ----------------------------- -----------------------------------------
  Id                            Mã tin nhắn

  Content                       Nội dung

  Type                          Loại tin nhắn

  IsRead                        Đã đọc hay chưa

  ReadDate                      Thời điểm đọc

  SentDate                      Thời điểm gửi
  -----------------------------------------------------------------------

**Orders (Đơn dịch vụ)**

  -------------------------------------------------------------------------------------------------------------------------------------------
  **Thuộc tính**   **Ý nghĩa**
  ---------------- --------------------------------------------------------------------------------------------------------------------------
  Id               Mã đơn

  OrderCode        Mã đơn hiển thị. Giữ nguyên dù đơn được sửa nhiều lần

  CustomerName     Tên khách trên đơn, tự điền từ tài khoản khách, sửa không đổi hồ sơ khách

  CustomerPhone    Số điện thoại khách trên đơn, tự điền tương tự

  EventDate        Ngày diễn ra sự kiện

  TotalAmount      Tổng giá trị đơn, bằng tổng Amount của chi tiết đơn, hệ thống tự tính

  DepositPercent   Tỷ lệ cọc (%), nhà cung cấp nhập, khóa sau khi khách cọc

  DepositAmount    Số tiền cọc, bằng TotalAmount × DepositPercent / 100, làm tròn đến 100.000đ, hệ thống tự tính, cố định sau khi khách cọc

  DepositDueDate   Hạn nộp cọc, 1 ngày kể từ lúc gửi đơn hoặc gửi lại

  Status           Trạng thái đơn

  Note             Ghi chú gửi khách

  CompletedDate    Ngày đơn hoàn thành, là mốc tính hoa hồng

  CancelledDate    Ngày khách hủy đơn

  CreatedDate      Ngày tạo đơn
  -------------------------------------------------------------------------------------------------------------------------------------------

**OrderItems (Chi tiết đơn)**

  -------------------------------------------------------------------------------------------
  **Thuộc tính**   **Ý nghĩa**
  ---------------- --------------------------------------------------------------------------
  Id               Mã dòng chi tiết

  ItemName         Tên hạng mục (ví dụ "Tiệc cưới -- Menu A")

  Unit             Đơn vị tính: "Gói" (số lượng mặc định 1) hoặc "Bàn" (số lượng tùy chỉnh)

  Quantity         Số lượng

  UnitPrice        Đơn giá, nhà cung cấp nhập

  Amount           Thành tiền, bằng Quantity × UnitPrice
  -------------------------------------------------------------------------------------------

**OrderRevisions (Lịch sử chỉnh sửa đơn)**

  ---------------------------------------------------------------------------------------
  **Thuộc tính**     **Ý nghĩa**
  ------------------ --------------------------------------------------------------------
  Id                 Mã lần chỉnh sửa

  RevisionType       Sửa trước khi cọc hay sau khi cọc

  RequestedChanges   Nội dung khách muốn đổi ("Đổi số lượng", "Đổi ngày thực hiện"\...)

  RequestNote        Lời nhắn của khách

  OldTotalAmount     Tổng tiền trước khi sửa

  NewTotalAmount     Tổng tiền sau khi sửa

  Status             Đang chờ nhà cung cấp sửa hay đã áp dụng

  CreatedDate        Ngày phát sinh yêu cầu hoặc lần sửa

  AppliedDate        Ngày nhà cung cấp áp dụng
  ---------------------------------------------------------------------------------------

**Payments (Thanh toán đặt cọc)**

  -----------------------------------------------------------------------
  **Thuộc tính**      **Ý nghĩa**
  ------------------- ---------------------------------------------------
  Id                  Mã thanh toán

  TransactionCode     Mã giao dịch từ VNPay, chỉ có khi đã thanh toán

  Status              Trạng thái thanh toán cọc

  PaidDate            Ngày thanh toán

  CreatedDate         Ngày tạo (lúc nhà cung cấp gửi đơn)
  -----------------------------------------------------------------------

**Invoices (Hóa đơn, giấy xác nhận cọc)**

  -----------------------------------------------------------------------
  **Thuộc tính**      **Ý nghĩa**
  ------------------- ---------------------------------------------------
  Id                  Mã chứng từ

  InvoiceCode         Số chứng từ

  Type                Giấy xác nhận cọc hay hóa đơn cuối

  CreatedDate         Ngày phát hành
  -----------------------------------------------------------------------

**Commissions (Hoa hồng của đơn)**

  ---------------------------------------------------------------------------------------
  **Thuộc tính**   **Ý nghĩa**
  ---------------- ----------------------------------------------------------------------
  Id               Mã hoa hồng

  OrderAmount      Giá trị đơn dùng để tính, bằng TotalAmount cuối cùng sau mọi lần sửa

  Rate             Tỷ lệ hoa hồng áp dụng (%), chụp từ loại dịch vụ lúc đơn hoàn thành

  Amount           Số tiền hoa hồng, bằng OrderAmount × Rate / 100

  CreatedDate      Ngày tạo, tức lúc đơn hoàn thành
  ---------------------------------------------------------------------------------------

**CommissionStatements (Bảng kê hoa hồng theo tháng)**

  -----------------------------------------------------------------------------------
  **Thuộc tính**         **Ý nghĩa**
  ---------------------- ------------------------------------------------------------
  Id                     Mã bảng kê (mỗi nhà cung cấp một bảng mỗi tháng)

  PeriodMonth            Tháng đối soát, tức tháng chứa ngày hoàn thành của các đơn

  DueDate                Hạn nộp (ngày 25 tháng sau)

  TotalOrders            Tổng số đơn trong tháng

  TotalAmount            Tổng hoa hồng phải nộp

  TransactionCode        Mã giao dịch nộp hoa hồng, chỉ có khi đã nộp

  Status                 Trạng thái nộp

  PaidDate               Ngày nộp

  CreatedDate            Ngày tạo bảng kê
  -----------------------------------------------------------------------------------

**Notifications (Thông báo)**

  -------------------------------------------------------------------------------------
  **Thuộc tính**                 **Ý nghĩa**
  ------------------------------ ------------------------------------------------------
  Id                             Mã thông báo

  Type                           Loại thông báo

  Title                          Tiêu đề

  Content                        Nội dung đầy đủ, lưu tại lúc tạo

  ReferenceType                  Loại đối tượng liên quan (Order, ServicePackage\...)

  ReferenceId                    Mã đối tượng liên quan, để mở đúng trang khi bấm

  IsRead                         Đã đọc hay chưa

  ReadDate                       Thời điểm đọc

  CreatedDate                    Thời điểm tạo
  -------------------------------------------------------------------------------------

### 3. Bảng giá trị enum

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Cột**                                                   **Giá trị**                                                                                                                                                                                                                                                                                                                 **Ý nghĩa**
  --------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------
  Users.Role                                                Couple, Vendor, Admin                                                                                                                                                                                                                                                                                                       Cặp đôi, Nhà cung cấp, Quản trị viên

  Users.Status                                              Active, Locked                                                                                                                                                                                                                                                                                                              Hoạt động, Bị khóa

  TimelineTasks.Status                                      Todo, Done                                                                                                                                                                                                                                                                                                                  Cần làm, Đã xong

  TimelineTasks.TaskType                                    Frame, Detail                                                                                                                                                                                                                                                                                                               Việc khung (mốc lớn như "Thử món", "Chốt trung tâm"), Việc chi tiết (sinh ra sau khi chốt, như "Điều chỉnh khẩu vị", "Lên vị trí bàn")

  ConsultationRequests.Qualification                        Pending, Qualified, NotQualified                                                                                                                                                                                                                                                                                            Chưa đánh giá, Đạt tiêu chuẩn (hiện nút tạo tài khoản nhanh), Chưa đạt tiêu chuẩn

  VendorProfiles.Status                                     Draft, Pending, NeedRevision, Approved                                                                                                                                                                                                                                                                                      Bản nháp (chưa nộp), Chờ duyệt, Cần chỉnh sửa / bổ sung (kèm lý do), Đã duyệt

  VendorDocuments.DocumentType                              BusinessLicense, StorefrontPhoto, FoodSafety, FireSafety, SkillCertificate                                                                                                                                                                                                                                                  Giấy phép kinh doanh, Ảnh mặt tiền, Giấy an toàn thực phẩm, Giấy phòng cháy chữa cháy, Giấy chứng nhận tay nghề (nếu có)

  VendorVerifications.Status, PackageVerifications.Status   Pending, Approved, NeedRevision                                                                                                                                                                                                                                                                                             Chờ duyệt, Đã duyệt, Cần chỉnh sửa (kèm lý do)

  ServicePackages.Status                                    Draft, Pending, NeedRevision, Approved, Hidden                                                                                                                                                                                                                                                                              Bản nháp, Chờ duyệt, Cần chỉnh sửa, Đã duyệt (hiển thị với khách), Đang ẩn (nhà cung cấp tạm ẩn, khôi phục được)

  Messages.Type                                             Text, Order, DepositReceipt, FinalInvoice                                                                                                                                                                                                                                                                                   Tin nhắn văn bản, Thẻ đơn dịch vụ (đơn mới hoặc đơn sửa gửi lại), Giấy xác nhận cọc, Hóa đơn cuối

  Orders.Status                                             Draft, Pending, NeedRevision, Deposited, Completed, Expired, Cancelled                                                                                                                                                                                                                                                      Xem bảng trạng thái đơn bên dưới

  OrderRevisions.RevisionType                               BeforeDeposit, AfterDeposit                                                                                                                                                                                                                                                                                                 Sửa trước khi cọc, Sửa sau khi cọc

  OrderRevisions.Status                                     Requested, Applied                                                                                                                                                                                                                                                                                                          Khách đã yêu cầu và đang chờ nhà cung cấp sửa, Nhà cung cấp đã sửa và gửi lại

  Payments.Status                                           Unpaid, Paid                                                                                                                                                                                                                                                                                                                Chưa cọc (gồm cả khi lượt thanh toán hết hạn), Đã cọc (VNPay báo thành công)

  Invoices.Type                                             DepositReceipt, FinalInvoice                                                                                                                                                                                                                                                                                                Giấy xác nhận cọc (tự động khi cọc thành công), Hóa đơn cuối (nhà cung cấp xuất khi khách yêu cầu, không bắt buộc)

  CommissionStatements.Status                               Unpaid, Paid                                                                                                                                                                                                                                                                                                                Chưa nộp, Đã nộp. "Quá hạn" không lưu, tính khi truy vấn: Unpaid và DueDate đã qua

  Notifications.Type (gợi ý)                                TaskUpcoming, TaskRescheduled, OrderSent, OrderRevisionRequested, OrderDeposited, OrderExpired, OrderCancelled, OrderCompleted, VendorSubmitted, VendorApproved, VendorNeedRevision, PackageSubmitted, PackageApproved, PackageNeedRevision, NewConsultationRequest, CommissionDueSoon, CommissionOverdue, CommissionPaid   Công việc sắp đến ngày thực hiện, ngày khách đổi lịch, các thay đổi của đơn, kết quả duyệt hồ sơ và gói, yêu cầu tư vấn mới, nhắc nộp hoặc quá hạn hoa hồng
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Trạng thái của đơn dịch vụ (Orders.Status)**

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Giá trị**    **Ý nghĩa**                                                                                                                                                  **Nhãn hiển thị**    **Sửa đơn**
  -------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------ -------------------- ------------------------------------------------------------------------------------------------------------
  Draft          Nhà cung cấp lưu nháp, khách chưa thấy                                                                                                                       Bản nháp             Sửa tự do

  Pending        Đã gửi, chờ khách xác nhận và cọc, còn trong hạn 1 ngày                                                                                                      Chờ thanh toán cọc   Sửa tự do, gửi lại thì đặt lại hạn

  NeedRevision   Khách yêu cầu chỉnh sửa trước khi cọc, chờ nhà cung cấp sửa                                                                                                  Chờ chỉnh sửa        Sửa tự do

  Deposited      Khách đã cọc, dịch vụ đang thực hiện                                                                                                                         Đã đặt cọc           Sửa được hạng mục, ngày, ghi chú. Khóa DepositPercent và DepositAmount. Tổng mới không nhỏ hơn tiền đã cọc

  Completed      Khách đã trả nốt tiền mặt. Nhà cung cấp tích hoàn thành (chỉ khi EventDate đã qua) hoặc hệ thống tự tích sau 7 ngày kể từ EventDate. Bắt đầu tính hoa hồng   Hoàn thành           Khóa

  Expired        Quá hạn cọc mà khách chưa thanh toán, hệ thống tự hết hạn. Không tính hoa hồng                                                                               Đã hết hạn           Khóa

  Cancelled      Khách hủy sau khi đã cọc, mất cọc (xử lý ngoài hệ thống). Không tính hoa hồng                                                                                Đã hủy               Khóa
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  -----------------------------------------------------------------------------------------------------
  **Từ**         **Sự kiện**                                                             **Sang**
  -------------- ----------------------------------------------------------------------- --------------
  Draft          Nhà cung cấp bấm "Gửi đơn cho khách hàng"                               Pending

  Pending        Khách bấm "Yêu cầu chỉnh sửa"                                           NeedRevision

  NeedRevision   Nhà cung cấp sửa và gửi lại                                             Pending

  Pending        VNPay báo cọc thành công                                                Deposited

  Pending        Quá DepositDueDate mà chưa cọc                                          Expired

  Deposited      Nhà cung cấp tích hoàn thành, hoặc tự động sau 7 ngày kể từ EventDate   Completed

  Deposited      Khách hủy đơn                                                           Cancelled
  -----------------------------------------------------------------------------------------------------

Đơn đang NeedRevision không bị hết hạn vì đang chờ nhà cung cấp. Khách yêu cầu sửa **sau khi cọc** thì đơn vẫn ở Deposited, yêu cầu ghi ở OrderRevisions với trạng thái Requested.

**Trạng thái nhà cung cấp trong Kế hoạch của tôi (suy ra, không lưu)**

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Đơn của đám cưới với nhà cung cấp đó**           **Nhãn trên thẻ**                                     **Dữ liệu hiển thị**
  -------------------------------------------------- ----------------------------------------------------- ---------------------------------------------------------------------------------------------------------------------------------
  Không có đơn, hoặc đơn Draft, Expired, Cancelled   Dự kiến (đang cân nhắc)                               Thông tin nhà cung cấp, khoảng giá từ các gói, nút Nhắn tin, nút xóa

  Pending, NeedRevision                              Chờ đặt cọc (nhãn tùy chọn, có thể gộp vào Dự kiến)   Mã đơn, hạn cọc

  Deposited                                          Đã chốt                                               Mã đơn, ngày thực hiện, đã cọc (DepositAmount), còn lại (TotalAmount trừ DepositAmount, thanh toán trực tiếp). Không có nút xóa

  Completed                                          Hoàn thành                                            Như Đã chốt
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Dữ liệu mẫu của ServiceCategories (7 loại, tỷ lệ hoa hồng tạm chấp nhận)**

  ------------------------------------------------------------------------------------------------------------
  **Name**                    **Mô tả**                                                   **CommissionRate**
  --------------------------- ----------------------------------------------------------- --------------------
  Trung tâm tổ chức sự kiện   Sảnh tiệc, thực đơn, cỗ cưới (gộp từ Nhà hàng và Cỗ cưới)   5%

  Decor                       Trang trí tiệc cưới                                         7%

  Hoa cưới                    Hoa cầm tay, hoa trang trí                                  8%

  Trang phục                  Váy cưới, vest                                              8%

  Makeup                      Trang điểm, làm tóc                                         10%

  Chụp ảnh                    Ảnh cưới                                                    8%
  ------------------------------------------------------------------------------------------------------------

### 4. Bảng quan hệ (30 dòng)

  --------------------------------------------------------------------------------------------
  **Thực thể**                  **Quan hệ**         **Thực thể**                  **Bản số**
  ----------------------------- ------------------- ----------------------------- ------------
  Người dùng                    Có                  Thông tin đám cưới            1:1

  Người dùng                    Có                  Hồ sơ nhà cung cấp            1:1

  Người dùng                    Có                  Lịch sử tìm kiếm              1:n

  Người dùng                    Yêu thích           Hồ sơ nhà cung cấp            n:n

  Người dùng                    Nhận                Thông báo                     1:n

  Người dùng                    Tham gia            Hội thoại                     1:n

  Hội thoại                     Có                  Tin nhắn                      1:n

  Người dùng                    Gửi                 Tin nhắn                      1:n

  Đơn dịch vụ                   Hiển thị trong      Tin nhắn                      1:n

  Thông tin đám cưới            Có                  Công việc timeline            1:n

  Thông tin đám cưới            Thêm vào kế hoạch   Hồ sơ nhà cung cấp            n:n

  Thông tin đám cưới            Muốn sử dụng        Loại dịch vụ                  n:n

  Thông tin đám cưới            Gắn với             Đơn dịch vụ                   1:n

  Loại dịch vụ                  Phân loại           Công việc timeline            1:n

  Loại dịch vụ                  Phân loại           Hồ sơ nhà cung cấp            1:n

  Loại dịch vụ                  Phân loại           Yêu cầu tư vấn                1:n

  Loại dịch vụ                  Phân loại           Hội thoại                     1:n

  Hồ sơ nhà cung cấp            Có                  Giấy tờ hồ sơ nhà cung cấp    1:n

  Hồ sơ nhà cung cấp            Có                  Xác minh hồ sơ nhà cung cấp   1:n

  Hồ sơ nhà cung cấp            Sở hữu              Gói dịch vụ                   1:n

  Hồ sơ nhà cung cấp            Có                  Bảng kê hoa hồng theo tháng   1:n

  Gói dịch vụ                   Có                  Ảnh gói dịch vụ               1:n

  Gói dịch vụ                   Có                  Xác minh gói dịch vụ          1:n

  Hồ sơ nhà cung cấp            Nhận                Đơn dịch vụ                   1:n

  Đơn dịch vụ                   Gồm                 Chi tiết đơn                  1:n

  Đơn dịch vụ                   Có                  Lịch sử chỉnh sửa đơn         1:n

  Đơn dịch vụ                   Có                  Thanh toán đặt cọc            1:1

  Đơn dịch vụ                   Có                  Hóa đơn                       1:n

  Đơn dịch vụ                   Phát sinh           Hoa hồng của đơn              1:1

  Bảng kê hoa hồng theo tháng   Gồm                 Hoa hồng của đơn              1:n
  --------------------------------------------------------------------------------------------

### 5. Khóa ngoại (mức logic)

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Bảng**                               **Khóa ngoại**
  -------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------
  Weddings                               UserId → Users (unique)

  WeddingCategories                      WeddingId → Weddings, CategoryId → ServiceCategories. Unique cặp

  TimelineTasks                          WeddingId → Weddings, CategoryId → ServiceCategories

  SearchHistories                        UserId → Users

  ConsultationRequests                   CategoryId → ServiceCategories

  VendorProfiles                         UserId → Users (unique), CategoryId → ServiceCategories

  VendorDocuments, VendorVerifications   VendorId → VendorProfiles

  ServicePackages                        VendorId → VendorProfiles

  PackageAlbums, PackageVerifications    PackageId → ServicePackages

  FavoriteVendors                        UserId → Users, VendorId → VendorProfiles. Unique cặp

  PlanVendors                            WeddingId → Weddings, VendorId → VendorProfiles. Unique cặp

  Conversations                          CoupleId → Users, VendorUserId → Users , CategoryId → ServiceCategories. Unique (CoupleId, VendorId)

  Messages                               ConversationId → Conversations, SenderId → Users, OrderId → Orders (cho phép null, chỉ tin loại Order, DepositReceipt, FinalInvoice)

  Orders                                 VendorId → VendorProfiles, WeddingId → Weddings

  OrderItems, OrderRevisions             OrderId → Orders

  Payments                               OrderId → Orders (unique)

  Invoices                               OrderId → Orders. Unique (OrderId, Type)

  Commissions                            OrderId → Orders (unique), StatementId → CommissionStatements

  CommissionStatements                   VendorId → VendorProfiles. Unique (VendorId, PeriodMonth)

  Notifications                          UserId → Users
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Lưu ý: mọi cột VendorId đều trỏ về VendorProfiles. Riêng Conversations.CoupleId, Messages.SenderId và Notifications.UserId trỏ về Users. Conversations.CategoryId suy ra được từ nhà cung cấp, giữ lại để hiển thị nhãn loại dịch vụ nhanh.

### 

### 

### 6. Quy tắc nghiệp vụ chính

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Luồng**                    **Quy tắc**
  ---------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Tạo đơn                      Nhà cung cấp nhập hạng mục (đơn vị "Gói" thì số lượng mặc định 1, đơn vị "Bàn" thì số lượng tùy chỉnh), tỷ lệ cọc, ngày sự kiện. Tên và số điện thoại khách tự điền từ tài khoản khách trong hội thoại. Hệ thống tính TotalAmount, DepositAmount, DepositDueDate. Gửi đơn thì tạo sẵn dòng Payments (Unpaid) và gửi thẻ đơn vào chat

  Cọc thành công               Trong một giao dịch: Payments thành Paid (ghi PaidDate, TransactionCode), Orders thành Deposited, thêm nhà cung cấp vào PlanVendors nếu chưa có (thay nhà cung cấp "Dự kiến" cùng loại), tạo Invoices loại DepositReceipt rồi gửi vào chat, việc khung "chốt" trong timeline chuyển Done rồi sinh các việc chi tiết, gửi thông báo

  Thanh toán nốt               Bằng tiền mặt ngoài hệ thống, không có dòng nào trong dữ liệu. Số còn lại là TotalAmount trừ DepositAmount. Khách yêu cầu thì nhà cung cấp xuất hóa đơn cuối (Invoices loại FinalInvoice)

  Hoàn thành đơn               Nhà cung cấp tích (chỉ khi EventDate đã qua), hoặc hệ thống tự tích sau 7 ngày kể từ EventDate. Khi đó ghi CompletedDate, tạo Commissions (OrderAmount là TotalAmount cuối cùng, Rate lấy từ loại dịch vụ của nhà cung cấp), gắn vào bảng kê của tháng chứa CompletedDate

  Hoa hồng                     Một bảng kê mỗi nhà cung cấp mỗi tháng, hạn nộp ngày 25 tháng sau, nộp một lần. Thông báo CommissionDueSoon trước hạn, CommissionOverdue khi quá hạn. Luật phạt nằm ngoài hệ thống

  Sửa đơn                      Trước cọc: sửa tự do, gửi lại thì đặt lại hạn 1 ngày. Sau cọc: khóa tỷ lệ và tiền cọc, tiền còn phải trả bằng tổng mới trừ tiền đã cọc. Mọi lần sửa ghi vào OrderRevisions

  Hết hạn, hủy                 Pending quá 1 ngày mà chưa cọc thì thành Expired. Khách hủy sau khi cọc thì thành Cancelled (mất cọc), việc chi tiết do đơn sinh ra bị xóa. Cả hai không tính hoa hồng

  Kế hoạch                     Mỗi loại dịch vụ chỉ một nhà cung cấp trong kế hoạch, kiểm tra bằng code. Không cho xóa khỏi kế hoạch khi có đơn Deposited hoặc Completed

  Duyệt hồ sơ và gói           Admin duyệt hoặc yêu cầu chỉnh sửa kèm lý do. Nhà cung cấp sửa và nộp lại thì tạo dòng xác minh mới. Gói chỉ hiển thị với khách khi gói Approved, hồ sơ Approved và tài khoản Active

  Tạo tài khoản nhà cung cấp   Admin tạo từ yêu cầu tư vấn đạt tiêu chuẩn, tự điền email và số điện thoại, mật khẩu hệ thống sinh ngẫu nhiên và gửi qua email

  Giấy tờ bắt buộc             Kiểm tra trong code lúc nộp hồ sơ: mọi loại cần BusinessLicense, StorefrontPhoto. FoodSafety và FireSafety áp dụng cho trung tâm tổ chức sự kiện, SkillCertificate cho makeup
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### 7. Thiết kế mức logic 

1.  Users (**Id**, Username, Email, FullName, PasswordHash, PhoneNumber, Role, Status, CreatedDate, LastLoginAt)

2.  Weddings (**Id**, *UserId*, GroomName, BrideName, WeddingDate, Budget, GuestCount, City, Style, CreatedDate, UpdatedDate)

3.  WeddingCategories (***WeddingId, CategoryId***)

4.  TimelineTasks (**Id**, *WeddingId*, *CategoryId*, Title, ScheduledDate, Status, CompletedDate, TaskType, TaskCode, DisplayOrder, CreatedDate)

5.  SearchHistories (**Id**, *UserId*, *CategoryId*, Keyword, CreatedDate)

6.  ConsultationRequests (**Id**, *CategoryId*, BrandName, ContactName, PhoneNumber, Email, IsContacted, ContactedDate, Qualification, AdminNote, CreatedDate, UpdatedDate)

7.  VendorProfiles (**Id**, *UserId*, *CategoryId*, BusinessName, TaxCode, RepresentativeName, Address, Ward, City, GoogleMapsUrl, Description, OpenTime, CloseTime, Status, CreatedDate, UpdatedDate)

8.  VendorDocuments (**Id**, *VendorId*, DocumentType, Url, DisplayOrder, CreatedDate)

9.  VendorVerifications (**Id**, *VendorId*, Status, AdminNote, SubmittedDate, ReviewedDate)

10. ServiceCategories (**Id**, Name, Description, CommissionRate)

11. ServicePackages (**Id**, *VendorId*, Name, Description, Price, Capacity, Status, CreatedDate, UpdatedDate)

12. PackageTags (***PackageId***, **Tag**)

13. PackageAlbums (**Id**, *PackageId*, Url, DisplayOrder, IsCover)

14. PackageVerifications (**Id**, *PackageId*, Status, AdminNote, ReviewedDate, CreatedDate)

15. FavoriteVendors (***UserId, VendorId***, CreatedDate)

16. PlanVendors (***WeddingId, VendorId***, CreatedDate)

17. Conversations (**Id**, *CoupleId*, *VendorId*, *CategoryId*, LastMessageDate, CreatedDate)

18. Messages (**Id**, *ConversationId*, *SenderId*, *OrderId*, Content, Type, IsRead, ReadDate, SentDate)

19. Orders (**Id**, *VendorId*, *WeddingId*, OrderCode, CustomerName, CustomerPhone, EventDate, TotalAmount, DepositPercent, DepositAmount, DepositDueDate, Status, Note, CompletedDate, CancelledDate, CreatedDate)

20. OrderItems (**Id**, *OrderId*, ItemName, Unit, Quantity, UnitPrice, Amount)

21. OrderRevisions (**Id**, *OrderId*, RevisionType, RequestNote, OldTotalAmount, NewTotalAmount, Status, CreatedDate, AppliedDate)

22. OrderRevisionChanges (***RevisionId***, **ChangeType**)

23. Payments (**Id**, *OrderId*, TransactionCode, Status, PaidDate, CreatedDate)

24. Invoices (**Id**, *OrderId*, InvoiceCode, Type, CreatedDate)

25. CommissionStatements (**Id**, *VendorId*, PeriodMonth, DueDate, TotalOrders, TotalAmount, TransactionCode, Status, PaidDate, CreatedDate)

26. Commissions (**Id**, *OrderId*, *StatementId*, OrderAmount, Rate, Amount, CreatedDate)

27. Notifications (**Id**, *UserId*, Type, Title, Content, ReferenceType, ReferenceId, IsRead, ReadDate, CreatedDate)

### 8. Thiết kế mức vật lý

  ------------------------------------------------------------------------------------
  **STT**   **Bảng dữ liệu**          **Mô tả ngắn gọn**
  --------- ------------------------- ------------------------------------------------
  1         Users                     Thông tin người dùng

  2         Weddings                  Thông tin đám cưới

  3         WeddingCategories         Liên kết đám cưới -- loại dịch vụ muốn sử dụng

  4         TimelineTasks             Công việc timeline

  5         SearchHistories           Lịch sử tìm kiếm

  6         ConsultationRequests      Yêu cầu tư vấn của nhà cung cấp

  7         VendorProfiles            Hồ sơ nhà cung cấp

  8         VendorDocuments           Giấy tờ hồ sơ nhà cung cấp

  9         VendorVerifications       Lần xác minh hồ sơ nhà cung cấp

  10        ServiceCategories         Loại dịch vụ

  11        ServicePackages           Gói dịch vụ

  12        PackageTags               Từ khóa của gói dịch vụ

  13        PackageAlbums             Ảnh của gói dịch vụ

  14        PackageVerifications      Lần xác minh gói dịch vụ

  15        FavoriteVendors           Nhà cung cấp yêu thích

  16        PlanVendors               Nhà cung cấp trong kế hoạch

  17        Conversations             Hội thoại

  18        Messages                  Tin nhắn

  19        Orders                    Đơn dịch vụ

  20        OrderItems                Chi tiết đơn

  21        OrderRevisions            Lịch sử chỉnh sửa đơn

  22        OrderRevisionChanges      Nội dung thay đổi của lần chỉnh sửa đơn

  23        Payments                  Thanh toán đặt cọc

  24        Invoices                  Hóa đơn, giấy xác nhận cọc

  25        CommissionStatements      Bảng kê hoa hồng theo tháng

  26        Commissions               Hoa hồng của đơn

  27        Notifications             Thông báo
  ------------------------------------------------------------------------------------

**Quy ước chung cho các bảng bên dưới:**

-   Khóa chính kiểu UUID, giá trị mặc định gen_random_uuid(). Các cột CreatedDate, UpdatedDate có giá trị mặc định now().

-   Cột trạng thái và loại dùng CHARACTER VARYING kèm ràng buộc CHECK. Trong cột ràng buộc, "CHECK:" đi kèm danh sách giá trị được phép.

-   Khóa ngoại mặc định chặn xóa dòng cha khi còn dòng con. Chỉ các bảng con của đơn (OrderItems, OrderRevisions, OrderRevisionChanges) dùng ON DELETE CASCADE.

**1. Bảng biểu diễn liên kết (Bước 2)**

  ------------------------------------------------------------------------------------------------------------------------------------------
  **Quan hệ (mức khái niệm)**                                     **Bản số**   **Cách biểu diễn ở mức logic**
  --------------------------------------------------------------- ------------ -------------------------------------------------------------
  Người dùng -- Thông tin đám cưới                                1:1          Weddings.UserId (duy nhất)

  Người dùng -- Hồ sơ nhà cung cấp                                1:1          VendorProfiles.UserId (duy nhất)

  Người dùng -- Lịch sử tìm kiếm                                  1:n          SearchHistories.UserId

  Người dùng -- Yêu thích -- Hồ sơ nhà cung cấp                   n:n          Quan hệ mới FavoriteVendors (UserId, VendorId, CreatedDate)

  Người dùng -- Thông báo                                         1:n          Notifications.UserId

  Người dùng -- Hội thoại                                         1:n          Conversations.CoupleId và Conversations.VendorId

  Hội thoại -- Tin nhắn                                           1:n          Messages.ConversationId

  Người dùng -- Tin nhắn                                          1:n          Messages.SenderId

  Đơn dịch vụ -- Tin nhắn                                         1:n          Messages.OrderId (cho phép rỗng)

  Thông tin đám cưới -- Công việc timeline                        1:n          TimelineTasks.WeddingId

  Thông tin đám cưới -- Thêm vào kế hoạch -- Hồ sơ nhà cung cấp   n:n          Quan hệ mới PlanVendors (WeddingId, VendorId, CreatedDate)

  Thông tin đám cưới -- Muốn sử dụng -- Loại dịch vụ              n:n          Quan hệ mới WeddingCategories (WeddingId, CategoryId)

  Thông tin đám cưới -- Đơn dịch vụ                               1:n          Orders.WeddingId

  Loại dịch vụ -- Công việc timeline                              1:n          TimelineTasks.CategoryId

  Loại dịch vụ -- Hồ sơ nhà cung cấp                              1:n          VendorProfiles.CategoryId

  Loại dịch vụ -- Yêu cầu tư vấn                                  1:n          ConsultationRequests.CategoryId

  Loại dịch vụ -- Hội thoại                                       1:n          Conversations.CategoryId

  Hồ sơ nhà cung cấp -- Giấy tờ                                   1:n          VendorDocuments.VendorId

  Hồ sơ nhà cung cấp -- Xác minh hồ sơ                            1:n          VendorVerifications.VendorId

  Hồ sơ nhà cung cấp -- Gói dịch vụ                               1:n          ServicePackages.VendorId

  Hồ sơ nhà cung cấp -- Bảng kê hoa hồng                          1:n          CommissionStatements.VendorId

  Hồ sơ nhà cung cấp -- Đơn dịch vụ                               1:n          Orders.VendorId

  Gói dịch vụ -- Ảnh                                              1:n          PackageAlbums.PackageId

  Gói dịch vụ -- Xác minh gói                                     1:n          PackageVerifications.PackageId

  Đơn dịch vụ -- Chi tiết đơn                                     1:n          OrderItems.OrderId

  Đơn dịch vụ -- Lịch sử chỉnh sửa                                1:n          OrderRevisions.OrderId

  Đơn dịch vụ -- Thanh toán đặt cọc                               1:1          Payments.OrderId (duy nhất)

  Đơn dịch vụ -- Hóa đơn                                          1:n          Invoices.OrderId

                                                                               

  Đơn dịch vụ -- Hoa hồng của đơn                                 1:1          Commissions.OrderId (duy nhất)

  Bảng kê hoa hồng -- Hoa hồng của đơn                            1:n          Commissions.StatementId

  *(từ Bước 1)* Gói dịch vụ -- Từ khóa                            1:n          PackageTags.PackageId

  *(từ Bước 1)* Lịch sử chỉnh sửa -- Nội dung đổi                 1:n          OrderRevisionChanges.RevisionId
  ------------------------------------------------------------------------------------------------------------------------------------------

**2. Điểm cần lưu ý: khẳng định "đạt 3NF"**

Chuẩn 3NF nghĩa là không có thuộc tính không khóa nào phụ thuộc vào một thuộc tính không khóa khác. Một số cột của bạn là **giá trị dẫn xuất** nên trên nghiêm ngặt là vi phạm 3NF. Nếu báo cáo ghi "tất cả các bảng đạt 3NF", thầy cô có thể chỉ ra những cột này:

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Cột**                                         **Tính từ**                                  **Nhận xét**
  ----------------------------------------------- -------------------------------------------- ----------------------------------------------------------------------
  Orders.DepositAmount                            TotalAmount × DepositPercent                 Sau khi khách cọc thì số tiền cọc bị khóa, trở thành dữ liệu độc lập

  Orders.TotalAmount                              Tổng OrderItems.Amount                       Cột tổng hợp

  OrderItems.Amount                               Quantity × UnitPrice                         Cột tích

  Commissions.Amount                              OrderAmount × Rate                           Cột tích

  CommissionStatements.TotalOrders, TotalAmount   Đếm và cộng các Commissions                  Cột tổng hợp

  Conversations.CategoryId                        Qua VendorId rồi VendorProfiles.CategoryId   Phụ thuộc bắc cầu
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------

Có hai cách xử lý:

-   **Giữ các cột này và ghi rõ trong báo cáo** rằng đây là dẫn xuất lưu sẵn có chủ đích (phi chuẩn hóa có kiểm soát) để tăng tốc truy vấn và chụp lại giá trị tại thời điểm giao dịch, còn các bảng còn lại đạt 3NF. Đây là cách mình khuyên, vì khớp với những gì bạn đã chốt.

-   **Bỏ các cột này** và tính khi truy vấn, khi đó khẳng định "đạt 3NF" đúng hoàn toàn nhưng truy vấn phức tạp hơn.

Commissions.OrderAmount và Commissions.Rate thì **không phải vi phạm**: chúng là bản chụp giá trị tại thời điểm tính (tỷ lệ hoa hồng và tổng đơn có thể đổi sau đó), nên là dữ liệu riêng của dòng hoa hồng.

**4.4.1. Bảng Users**

Bảng Users lưu thông tin tài khoản đăng nhập của cặp đôi, nhà cung cấp và quản trị viên.

  ---------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính     Kiểu dữ liệu               Ràng buộc                                           Mô tả thuộc tính
  ----- -------------- -------------------------- --------------------------------------------------- -----------------------------------------------
  1     Id             UUID                       PK                                                  Khóa chính, định danh duy nhất của người dùng

  2     Username       CHARACTER VARYING(50)      UNIQUE, NOT NULL                                    Tên đăng nhập

  3     Email          CHARACTER VARYING(255)     UNIQUE, NOT NULL                                    Email, dùng để đăng nhập

  4     FullName       CHARACTER VARYING(150)     NOT NULL                                            Họ và tên

  5     PasswordHash   CHARACTER VARYING(255)     NOT NULL                                            Mật khẩu đã mã hóa

  6     PhoneNumber    CHARACTER VARYING(20)                                                          Số điện thoại

  7     Role           CHARACTER VARYING(20)      NOT NULL, CHECK: Couple, Vendor, Admin              Vai trò

  8     Status         CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Active', CHECK: Active, Locked   Trạng thái tài khoản

  9     CreatedDate    TIMESTAMP WITH TIME ZONE   NOT NULL                                            Ngày tạo tài khoản

  10    LastLoginAt    TIMESTAMP WITH TIME ZONE                                                       Lần đăng nhập gần nhất
  ---------------------------------------------------------------------------------------------------------------------------------------------------

**4.2. Bảng Weddings**

Bảng Weddings lưu thông tin đám cưới do cặp đôi nhập, dùng để gợi ý dịch vụ và sinh timeline.

  -----------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính      Kiểu dữ liệu               Ràng buộc                          Mô tả thuộc tính
  ----- --------------- -------------------------- ---------------------------------- -----------------------------------
  1     Id              UUID                       PK                                 Khóa chính, định danh đám cưới

  2     UserId          UUID                       FK → Users(Id), UNIQUE, NOT NULL   Tài khoản cặp đôi sở hữu đám cưới

  3     GroomName       CHARACTER VARYING(100)     NOT NULL                           Tên chú rể

  4     BrideName       CHARACTER VARYING(100)     NOT NULL                           Tên cô dâu

  5     WeddingDate     DATE                       NOT NULL                           Ngày cưới

  6     Budget          NUMERIC(18,2)              NOT NULL, CHECK: ≥ 0               Tổng ngân sách

  7     GuestCount      INTEGER                    NOT NULL, CHECK: \> 0              Số lượng khách dự kiến

  8     City            CHARACTER VARYING(100)     NOT NULL                           Thành phố tổ chức

  9     Style           CHARACTER VARYING(100)                                        Phong cách đám cưới

  10    CreatedDate     TIMESTAMP WITH TIME ZONE   NOT NULL                           Ngày tạo

  11    UpdatedDate     TIMESTAMP WITH TIME ZONE   NOT NULL                           Ngày cập nhật
  -----------------------------------------------------------------------------------------------------------------------

**4.3. Bảng WeddingCategories**

Bảng WeddingCategories là bảng nối, lưu các loại dịch vụ cặp đôi tích chọn khi điền thông tin đám cưới.

  ----------------------------------------------------------------------------------------------
  STT   Thuộc tính   Kiểu dữ liệu   Ràng buộc                        Mô tả thuộc tính
  ----- ------------ -------------- -------------------------------- ---------------------------
  1     WeddingId    UUID           PK, FK → Weddings(Id)            Đám cưới

  2     CategoryId   UUID           PK, FK → ServiceCategories(Id)   Loại dịch vụ muốn sử dụng
  ----------------------------------------------------------------------------------------------

**4.4. Bảng TimelineTasks**

Bảng TimelineTasks lưu các công việc trong timeline của đám cưới, gồm việc khung, việc chi tiết và việc khách tự thêm.

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính      Kiểu dữ liệu               Ràng buộc                                     Mô tả thuộc tính
  ----- --------------- -------------------------- --------------------------------------------- ----------------------------------------------------------------
  1     Id              UUID                       PK                                            Khóa chính, định danh công việc

  2     WeddingId       UUID                       FK → Weddings(Id), NOT NULL                   Đám cưới sở hữu công việc

  3     CategoryId      UUID                       FK → ServiceCategories(Id)                    Loại dịch vụ của công việc, rỗng nếu việc không thuộc loại nào

  4     Title           CHARACTER VARYING(255)     NOT NULL                                      Tên công việc

  5     ScheduledDate   DATE                       NOT NULL                                      Ngày dự kiến thực hiện

  6     Status          CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Todo', CHECK: Todo, Done   Trạng thái công việc

  7     CompletedDate   TIMESTAMP WITH TIME ZONE                                                 Ngày hoàn thành thực tế

  8     TaskType        CHARACTER VARYING(20)      NOT NULL, CHECK: Frame, Detail                Việc khung hoặc việc chi tiết

  9     TaskCode        CHARACTER VARYING(50)      UNIQUE cùng WeddingId                         Mã mẫu công việc do hệ thống sinh, rỗng với việc khách tự thêm

  10    DisplayOrder    INTEGER                    NOT NULL, DEFAULT 0                           Thứ tự hiển thị trong cùng loại dịch vụ

  11    CreatedDate     TIMESTAMP WITH TIME ZONE   NOT NULL                                      Ngày tạo
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.5. Bảng SearchHistories**

Bảng SearchHistories lưu lịch sử tìm kiếm dịch vụ của người dùng.

  ---------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính    Kiểu dữ liệu               Ràng buộc                  Mô tả thuộc tính
  ----- ------------- -------------------------- -------------------------- -------------------------------------
  1     Id            UUID                       PK                         Khóa chính, định danh lượt tìm kiếm

  2     UserId        UUID                       FK → Users(Id), NOT NULL   Người dùng tìm kiếm

  3     Keyword       CHARACTER VARYING(255)                                Từ khóa

  4     CreatedDate   TIMESTAMP WITH TIME ZONE   NOT NULL                   Thời điểm tìm
  ---------------------------------------------------------------------------------------------------------------

**4.6. Bảng ConsultationRequests**

Bảng ConsultationRequests lưu yêu cầu tư vấn mà nhà cung cấp để lại ở form đăng ký hợp tác, để admin liên hệ và đánh giá.

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính      Kiểu dữ liệu               Ràng buộc                                                              Mô tả thuộc tính
  ----- --------------- -------------------------- ---------------------------------------------------------------------- --------------------------------------------
  1     Id              UUID                       PK                                                                     Khóa chính, định danh yêu cầu

  2     CategoryId      UUID                       FK → ServiceCategories(Id), NOT NULL                                   Lĩnh vực hoạt động

  3     BrandName       CHARACTER VARYING(150)     NOT NULL                                                               Tên thương hiệu / studio

  4     ContactName     CHARACTER VARYING(100)     NOT NULL                                                               Người liên hệ

  5     PhoneNumber     CHARACTER VARYING(20)      NOT NULL                                                               Số điện thoại

  6     Email           CHARACTER VARYING(255)     NOT NULL                                                               Email liên hệ, dùng để tạo tài khoản nhanh

  7     IsContacted     BOOLEAN                    NOT NULL, DEFAULT false                                                Admin đã liên hệ hay chưa

  8     ContactedDate   TIMESTAMP WITH TIME ZONE                                                                          Ngày liên hệ

  9     Qualification   CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Pending', CHECK: Pending, Qualified, NotQualified   Kết quả đánh giá tiêu chuẩn

  10    AdminNote       TEXT                                                                                              Ghi chú nội bộ của admin

  11    CreatedDate     TIMESTAMP WITH TIME ZONE   NOT NULL                                                               Ngày gửi yêu cầu

  12    UpdatedDate     TIMESTAMP WITH TIME ZONE   NOT NULL                                                               Ngày cập nhật
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.7. Bảng VendorProfiles**

Bảng VendorProfiles lưu hồ sơ pháp lý và thông tin hiển thị của nhà cung cấp. Các cột từ TaxCode đến CloseTime cho phép rỗng khi hồ sơ còn là bản nháp, backend kiểm tra bắt buộc lúc nộp.

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính           Kiểu dữ liệu               Ràng buộc                                                                  Mô tả thuộc tính
  ----- -------------------- -------------------------- -------------------------------------------------------------------------- --------------------------------------------------------------
  1     Id                   UUID                       PK                                                                         Khóa chính, định danh hồ sơ

  2     UserId               UUID                       FK → Users(Id), UNIQUE, NOT NULL                                           Tài khoản nhà cung cấp sở hữu hồ sơ

  3     CategoryId           UUID                       FK → ServiceCategories(Id), NOT NULL                                       Loại dịch vụ duy nhất của nhà cung cấp

  4     BusinessName         CHARACTER VARYING(200)     NOT NULL                                                                   Tên doanh nghiệp / cửa hàng

  5     TaxCode              CHARACTER VARYING(20)      UNIQUE                                                                     Mã số thuế

  6     RepresentativeName   CHARACTER VARYING(100)                                                                                Người đại diện

  7     Address              CHARACTER VARYING(255)                                                                                Địa chỉ

  8     Ward                 CHARACTER VARYING(100)                                                                                Phường / xã

  9     City                 CHARACTER VARYING(100)                                                                                Thành phố, dùng để lọc và gợi ý

  10    GoogleMapsUrl        CHARACTER VARYING(500)                                                                                Liên kết Google Maps do nhà cung cấp dán (tùy chọn)

  11    Description          TEXT                                                                                                  Giới thiệu

  12    WorkingHours         CHARACTER VARYING(100)                                                                                Giờ làm việc dạng chuỗi mô tả, ví dụ "T2 - T6: 8:00 - 22:00"

  13    Status               CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Draft', CHECK: Draft, Pending, NeedRevision, Approved   Trạng thái hồ sơ

  14    CreatedDate          TIMESTAMP WITH TIME ZONE   NOT NULL                                                                   Ngày tạo

  15    UpdatedDate          TIMESTAMP WITH TIME ZONE   NOT NULL                                                                   Ngày cập nhật
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

1.  GoogleMapsUrl có giá trị thì dùng link đó.

2.  Để trống thì ghép: https://www.google.com/maps/search/?api=1&query= cộng với phần mã hóa URL của BusinessName, Address, Ward, City.

3.  Khi nhà cung cấp lưu link, backend chỉ nhận đường dẫn https của Google Maps (tên miền như google.com/maps, maps.google.com, maps.app.goo.gl) và từ chối tên miền khác. Khi hiển thị, mở bằng tab mới với rel=\"noopener noreferrer\". Việc kiểm tra này tránh để nhà cung cấp dán một liên kết độc hại lên trang của họ.

**4.8. Bảng VendorDocuments**

Bảng VendorDocuments lưu các giấy tờ và ảnh pháp lý của hồ sơ. Cột Url lưu đường dẫn file trong bucket riêng tư của Supabase Storage.

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính     Kiểu dữ liệu               Ràng buộc                                                                                                     Mô tả thuộc tính
  ----- -------------- -------------------------- ------------------------------------------------------------------------------------------------------------- -------------------------------
  1     Id             UUID                       PK                                                                                                            Khóa chính, định danh giấy tờ

  2     VendorId       UUID                       FK → VendorProfiles(Id), NOT NULL                                                                             Hồ sơ nhà cung cấp

  3     DocumentType   CHARACTER VARYING(30)      NOT NULL, CHECK: BusinessLicense, StorefrontPhoto, SignboardPhoto, FoodSafety, FireSafety, SkillCertificate   Loại giấy tờ

  4     Url            CHARACTER VARYING(500)     NOT NULL                                                                                                      Đường dẫn file ảnh

  5     DisplayOrder   INTEGER                    NOT NULL, DEFAULT 0                                                                                           Thứ tự hiển thị

  6     CreatedDate    TIMESTAMP WITH TIME ZONE   NOT NULL                                                                                                      Ngày tải lên
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.9. Bảng VendorVerifications**

Bảng VendorVerifications lưu mỗi lần nhà cung cấp nộp hồ sơ và kết quả duyệt của admin.

  ----------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính      Kiểu dữ liệu               Ràng buộc                                                             Mô tả thuộc tính
  ----- --------------- -------------------------- --------------------------------------------------------------------- -----------------------------------
  1     Id              UUID                       PK                                                                    Khóa chính, định danh lần duyệt

  2     VendorId        UUID                       FK → VendorProfiles(Id), NOT NULL                                     Hồ sơ được duyệt

  3     Status          CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Pending', CHECK: Pending, Approved, NeedRevision   Kết quả duyệt

  4     AdminNote       TEXT                       CHECK: bắt buộc khi Status = NeedRevision                             Lý do yêu cầu chỉnh sửa / bổ sung

  5     SubmittedDate   TIMESTAMP WITH TIME ZONE   NOT NULL                                                              Ngày nộp

  6     ReviewedDate    TIMESTAMP WITH TIME ZONE                                                                         Ngày duyệt
  ----------------------------------------------------------------------------------------------------------------------------------------------------------

**4.10. Bảng ServiceCategories**

Bảng ServiceCategories lưu danh mục loại dịch vụ và tỷ lệ hoa hồng của từng loại.

  --------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính       Kiểu dữ liệu             Ràng buộc                       Mô tả thuộc tính
  ----- ---------------- ------------------------ ------------------------------- ------------------------------------
  1     Id               UUID                     PK                              Khóa chính, định danh loại dịch vụ

  2     Name             CHARACTER VARYING(100)   UNIQUE, NOT NULL                Tên loại dịch vụ

  3     Description      CHARACTER VARYING(500)                                   Mô tả

  4     CommissionRate   NUMERIC(5,2)             NOT NULL, CHECK: từ 0 đến 100   Tỷ lệ hoa hồng (%) của loại này
  --------------------------------------------------------------------------------------------------------------------

**4.11. Bảng ServicePackages**

Bảng ServicePackages lưu các gói dịch vụ do nhà cung cấp đăng, hiển thị trên trang nhà cung cấp.

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính    Kiểu dữ liệu               Ràng buộc                                                                          Mô tả thuộc tính
  ----- ------------- -------------------------- ---------------------------------------------------------------------------------- ----------------------------------------------
  1     Id            UUID                       PK                                                                                 Khóa chính, định danh gói

  2     VendorId      UUID                       FK → VendorProfiles(Id), NOT NULL                                                  Nhà cung cấp sở hữu gói

  3     Name          CHARACTER VARYING(200)     NOT NULL                                                                           Tên gói

  4     Description   TEXT                                                                                                          Mô tả gói

  5     Price         NUMERIC(18,2)              NOT NULL, CHECK: ≥ 0                                                               Giá cụ thể của gói

  6     Capacity      INTEGER                    CHECK: \> 0                                                                        Sức chứa (gói của trung tâm tổ chức sự kiện)

  7     Status        CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Draft', CHECK: Draft, Pending, NeedRevision, Approved, Hidden   Trạng thái gói

  8     CreatedDate   TIMESTAMP WITH TIME ZONE   NOT NULL                                                                           Ngày tạo

  9     UpdatedDate   TIMESTAMP WITH TIME ZONE   NOT NULL                                                                           Ngày cập nhật
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.12. Bảng PackageTags**

Bảng PackageTags lưu các từ khóa và phong cách của gói dịch vụ, dùng để lọc và gợi ý.

  ---------------------------------------------------------------------------------------------------
  STT   Thuộc tính   Kiểu dữ liệu            Ràng buộc                      Mô tả thuộc tính
  ----- ------------ ----------------------- ------------------------------ -------------------------
  1     PackageId    UUID                    PK, FK → ServicePackages(Id)   Gói dịch vụ

  2     Tag          CHARACTER VARYING(50)   PK                             Từ khóa hoặc phong cách
  ---------------------------------------------------------------------------------------------------

**4.13. Bảng PackageAlbum**s

Bảng PackageAlbums lưu ảnh của từng gói dịch vụ, mỗi ảnh một dòng. Cột Url lưu đường dẫn file trong bucket công khai của Supabase Storage.

  ---------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính     Kiểu dữ liệu             Ràng buộc                            Mô tả thuộc tính
  ----- -------------- ------------------------ ------------------------------------ ----------------------------------------------
  1     Id             UUID                     PK                                   Khóa chính, định danh ảnh

  2     PackageId      UUID                     FK → ServicePackages(Id), NOT NULL   Gói dịch vụ

  3     Url            CHARACTER VARYING(500)   NOT NULL                             Đường dẫn ảnh

  4     DisplayOrder   INTEGER                  NOT NULL, DEFAULT 0                  Thứ tự hiển thị trong bộ sưu tập

  5     IsCover        BOOLEAN                  NOT NULL, DEFAULT false              Ảnh bìa của gói (mỗi gói tối đa một ảnh bìa)
  ---------------------------------------------------------------------------------------------------------------------------------

**4.14. Bảng PackageVerifications**

Bảng PackageVerifications lưu mỗi lần nhà cung cấp gửi gói để admin duyệt.

  -------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính     Kiểu dữ liệu               Ràng buộc                                                             Mô tả thuộc tính
  ----- -------------- -------------------------- --------------------------------------------------------------------- ---------------------------------
  1     Id             UUID                       PK                                                                    Khóa chính, định danh lần duyệt

  2     PackageId      UUID                       FK → ServicePackages(Id), NOT NULL                                    Gói được duyệt

  3     Status         CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Pending', CHECK: Pending, Approved, NeedRevision   Kết quả duyệt

  4     AdminNote      TEXT                       CHECK: bắt buộc khi Status = NeedRevision                             Lý do yêu cầu chỉnh sửa

  5     ReviewedDate   TIMESTAMP WITH TIME ZONE                                                                         Ngày duyệt

  6     CreatedDate    TIMESTAMP WITH TIME ZONE   NOT NULL                                                              Ngày gửi duyệt
  -------------------------------------------------------------------------------------------------------------------------------------------------------

**4.15. Bảng FavoriteVendors**

Bảng FavoriteVendors là bảng nối, lưu các nhà cung cấp mà người dùng đã yêu thích để so sánh.

  ----------------------------------------------------------------------------------------------------------
  STT   Thuộc tính    Kiểu dữ liệu               Ràng buộc                     Mô tả thuộc tính
  ----- ------------- -------------------------- ----------------------------- -----------------------------
  1     UserId        UUID                       PK, FK → Users(Id)            Người dùng

  2     VendorId      UUID                       PK, FK → VendorProfiles(Id)   Nhà cung cấp được yêu thích

  3     CreatedDate   TIMESTAMP WITH TIME ZONE   NOT NULL                      Ngày thêm vào yêu thích
  ----------------------------------------------------------------------------------------------------------

**4.16. Bảng PlanVendors**

Bảng PlanVendors là bảng nối, lưu các nhà cung cấp mà cặp đôi đã thêm vào "Kế hoạch của tôi".

  ----------------------------------------------------------------------------------------------------------
  STT   Thuộc tính    Kiểu dữ liệu               Ràng buộc                     Mô tả thuộc tính
  ----- ------------- -------------------------- ----------------------------- -----------------------------
  1     WeddingId     UUID                       PK, FK → Weddings(Id)         Đám cưới

  2     VendorId      UUID                       PK, FK → VendorProfiles(Id)   Nhà cung cấp trong kế hoạch

  3     CreatedDate   TIMESTAMP WITH TIME ZONE   NOT NULL                      Ngày thêm vào kế hoạch
  ----------------------------------------------------------------------------------------------------------

**4.17. Bảng Conversations**

Bảng Conversations lưu hội thoại giữa một cặp đôi và một nhà cung cấp, mỗi cặp có một hội thoại.

  ------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính        Kiểu dữ liệu               Ràng buộc                              Mô tả thuộc tính
  ----- ----------------- -------------------------- -------------------------------------- ------------------------------------------------------
  1     Id                UUID                       PK                                     Khóa chính, định danh hội thoại

  2     CoupleId          UUID                       FK → Users(Id), NOT NULL               Tài khoản cặp đôi

  3     VendorId          UUID                       FK → Users(Id), NOT NULL               Tài khoản nhà cung cấp

  4     CategoryId        UUID                       FK → ServiceCategories(Id), NOT NULL   Loại dịch vụ của nhà cung cấp, dùng để hiển thị nhãn

  5     LastMessageDate   TIMESTAMP WITH TIME ZONE                                          Thời điểm tin nhắn gần nhất, để sắp xếp danh sách

  6     CreatedDate       TIMESTAMP WITH TIME ZONE   NOT NULL                               Ngày bắt đầu hội thoại
  ------------------------------------------------------------------------------------------------------------------------------------------------

Ràng buộc bảng: UNIQUE (CoupleId, VendorId); CHECK (CoupleId \<\> VendorId).

**4.18. Bảng Messages**

Bảng Messages lưu tin nhắn trong hội thoại, kể cả thẻ đơn dịch vụ, giấy xác nhận cọc và hóa đơn.

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính       Kiểu dữ liệu               Ràng buộc                                                                    Mô tả thuộc tính
  ----- ---------------- -------------------------- ---------------------------------------------------------------------------- ------------------------------------------------------------------------
  1     Id               UUID                       PK                                                                           Khóa chính, định danh tin nhắn

  2     ConversationId   UUID                       FK → Conversations(Id), NOT NULL                                             Hội thoại chứa tin nhắn

  3     SenderId         UUID                       FK → Users(Id)                                                               Người gửi, rỗng với tin nhắn hệ thống

  4     OrderId          UUID                       FK → Orders(Id)                                                              Đơn liên quan, chỉ có với tin loại Order, DepositReceipt, FinalInvoice

  5     Content          TEXT                       NOT NULL                                                                     Nội dung

  6     Type             CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Text', CHECK: Text, Order, DepositReceipt, FinalInvoice   Loại tin nhắn

  7     IsRead           BOOLEAN                    NOT NULL, DEFAULT false                                                      Đã đọc hay chưa

  8     ReadDate         TIMESTAMP WITH TIME ZONE                                                                                Thời điểm đọc

  9     SentDate         TIMESTAMP WITH TIME ZONE   NOT NULL                                                                     Thời điểm gửi
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.19. Bảng Orders**

Bảng Orders lưu đơn dịch vụ do nhà cung cấp tạo cho khách, gồm trạng thái và các khoản tiền cọc.

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính       Kiểu dữ liệu               Ràng buộc                                                                                                  Mô tả thuộc tính
  ----- ---------------- -------------------------- ---------------------------------------------------------------------------------------------------------- -----------------------------------------------------
  1     Id               UUID                       PK                                                                                                         Khóa chính, định danh đơn

  2     VendorId         UUID                       FK → VendorProfiles(Id), NOT NULL                                                                          Nhà cung cấp nhận đơn

  3     WeddingId        UUID                       FK → Weddings(Id), NOT NULL                                                                                Đám cưới của khách

  4     OrderCode        CHARACTER VARYING(30)      UNIQUE, NOT NULL                                                                                           Mã đơn hiển thị, giữ nguyên khi đơn được sửa

  5     CustomerName     CHARACTER VARYING(150)     NOT NULL                                                                                                   Tên khách trên đơn

  6     CustomerPhone    CHARACTER VARYING(20)      NOT NULL                                                                                                   Số điện thoại khách trên đơn

  7     EventDate        DATE                       NOT NULL                                                                                                   Ngày diễn ra sự kiện

  8     TotalAmount      NUMERIC(18,2)              NOT NULL, DEFAULT 0, CHECK: ≥ 0                                                                            Tổng giá trị đơn, bằng tổng Amount của chi tiết đơn

  9     DepositPercent   NUMERIC(5,2)               NOT NULL, CHECK: lớn hơn 0 và nhỏ hơn 100                                                                  Tỷ lệ cọc (%), nhà cung cấp nhập

  10    DepositAmount    NUMERIC(18,2)              NOT NULL, CHECK: ≤ TotalAmount                                                                             Số tiền cọc, hệ thống tự tính

  11    DepositDueDate   TIMESTAMP WITH TIME ZONE                                                                                                              Hạn nộp cọc, 1 ngày kể từ lúc gửi đơn

  12    Status           CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Draft', CHECK: Draft, Pending, NeedRevision, Deposited, Completed, Expired, Cancelled   Trạng thái đơn

  13    Note             TEXT                                                                                                                                  Ghi chú gửi khách

  14    CompletedDate    TIMESTAMP WITH TIME ZONE                                                                                                              Ngày hoàn thành đơn, mốc tính hoa hồng

  15    CancelledDate    TIMESTAMP WITH TIME ZONE                                                                                                              Ngày khách hủy đơn

  16    CreatedDate      TIMESTAMP WITH TIME ZONE   NOT NULL                                                                                                   Ngày tạo đơn
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.20. Bảng OrderItems**

Bảng OrderItems lưu các hạng mục báo giá chi tiết của đơn.

  ---------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính   Kiểu dữ liệu             Ràng buộc                                 Mô tả thuộc tính
  ----- ------------ ------------------------ ----------------------------------------- -------------------------------------
  1     Id           UUID                     PK                                        Khóa chính, định danh dòng chi tiết

  2     OrderId      UUID                     FK → Orders(Id), NOT NULL                 Đơn chứa hạng mục

  3     ItemName     CHARACTER VARYING(255)   NOT NULL                                  Tên hạng mục

  4     Unit         CHARACTER VARYING(30)    NOT NULL, DEFAULT 'Gói'                   Đơn vị tính: Gói, Bàn\...

  5     Quantity     INTEGER                  NOT NULL, DEFAULT 1, CHECK: \> 0          Số lượng

  6     UnitPrice    NUMERIC(18,2)            NOT NULL, CHECK: ≥ 0                      Đơn giá, nhà cung cấp nhập

  7     Amount       NUMERIC(18,2)            NOT NULL, CHECK: = Quantity × UnitPrice   Thành tiền
  ---------------------------------------------------------------------------------------------------------------------------

**4.21. Bảng OrderRevisions**

Bảng OrderRevisions lưu lịch sử yêu cầu và các lần chỉnh sửa của đơn, cả trước lẫn sau khi cọc.

  -----------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính       Kiểu dữ liệu               Ràng buộc                                                  Mô tả thuộc tính
  ----- ---------------- -------------------------- ---------------------------------------------------------- ----------------------------------------------
  1     Id               UUID                       PK                                                         Khóa chính, định danh lần chỉnh sửa

  2     OrderId          UUID                       FK → Orders(Id), NOT NULL                                  Đơn được chỉnh sửa

  3     RevisionType     CHARACTER VARYING(20)      NOT NULL, CHECK: BeforeDeposit, AfterDeposit               Sửa trước hay sau khi cọc

  4     RequestNote      TEXT                                                                                  Lời nhắn của khách

  5     OldTotalAmount   NUMERIC(18,2)              NOT NULL                                                   Tổng tiền trước khi sửa

  6     NewTotalAmount   NUMERIC(18,2)                                                                         Tổng tiền sau khi sửa, rỗng khi chưa áp dụng

  7     Status           CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Requested', CHECK: Requested, Applied   Đang chờ nhà cung cấp sửa hay đã áp dụng

  8     CreatedDate      TIMESTAMP WITH TIME ZONE   NOT NULL                                                   Ngày phát sinh yêu cầu hoặc lần sửa

  9     AppliedDate      TIMESTAMP WITH TIME ZONE                                                              Ngày nhà cung cấp áp dụng
  -----------------------------------------------------------------------------------------------------------------------------------------------------------

**4.22. Bảng OrderRevisionChanges**

Bảng OrderRevisionChanges lưu từng nội dung khách muốn đổi trong một lần chỉnh sửa (thuộc tính đa trị tách từ OrderRevisions).

  ------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính   Kiểu dữ liệu            Ràng buộc                     Mô tả thuộc tính
  ----- ------------ ----------------------- ----------------------------- -----------------------------------------------------------------------------
  1     RevisionId   UUID                    PK, FK → OrderRevisions(Id)   Lần chỉnh sửa

  2     ChangeType   CHARACTER VARYING(30)   PK                            Nội dung đổi, ví dụ Quantity (đổi số lượng), EventDate (đổi ngày thực hiện)
  ------------------------------------------------------------------------------------------------------------------------------------------------------

**4.23. Bảng Payments**

Bảng Payments lưu khoản thanh toán đặt cọc của đơn qua VNPay. Số tiền cọc lấy từ Orders.DepositAmount nên không lưu lại ở đây.

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính        Kiểu dữ liệu               Ràng buộc                                                                                               Mô tả thuộc tính
  ----- ----------------- -------------------------- ------------------------------------------------------------------------------------------------------- -------------------------------------------------
  1     Id                UUID                       PK                                                                                                      Khóa chính, định danh thanh toán

  2     OrderId           UUID                       FK → Orders(Id), UNIQUE, NOT NULL                                                                       Đơn được thanh toán

  3     TransactionCode   CHARACTER VARYING(100)     UNIQUE                                                                                                  Mã giao dịch từ VNPay, chỉ có khi đã thanh toán

  4     Status            CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Unpaid', CHECK: Unpaid, Paid. Khi Paid thì TransactionCode và PaidDate bắt buộc có   Trạng thái thanh toán

  5     PaidDate          TIMESTAMP WITH TIME ZONE                                                                                                           Ngày thanh toán

  6     CreatedDate       TIMESTAMP WITH TIME ZONE   NOT NULL                                                                                                Ngày tạo, tức lúc nhà cung cấp gửi đơn
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.24. Bảng Invoices**

Bảng Invoices lưu giấy xác nhận cọc và hóa đơn cuối của đơn, mỗi loại tối đa một chứng từ cho mỗi đơn.

  -------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính     Kiểu dữ liệu               Ràng buộc                                       Mô tả thuộc tính
  ----- -------------- -------------------------- ----------------------------------------------- -------------------------------------
  1     Id             UUID                       PK                                              Khóa chính, định danh chứng từ

  2     OrderId        UUID                       FK → Orders(Id), NOT NULL                       Đơn liên quan

  3     InvoiceCode    CHARACTER VARYING(30)      UNIQUE, NOT NULL                                Số chứng từ

  4     Type           CHARACTER VARYING(20)      NOT NULL, CHECK: DepositReceipt, FinalInvoice   Giấy xác nhận cọc hoặc hóa đơn cuối

  5     CreatedDate    TIMESTAMP WITH TIME ZONE   NOT NULL                                        Ngày phát hành
  -------------------------------------------------------------------------------------------------------------------------------------

Ràng buộc bảng: UNIQUE (OrderId, Type).

**4.25. Bảng CommissionStatements**

Bảng CommissionStatements lưu bảng kê hoa hồng theo tháng của từng nhà cung cấp, nộp một lần vào ngày 25 tháng sau.

  ---------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính        Kiểu dữ liệu               Ràng buộc                                         Mô tả thuộc tính
  ----- ----------------- -------------------------- ------------------------------------------------- ----------------------------------------------
  1     Id                UUID                       PK                                                Khóa chính, định danh bảng kê

  2     VendorId          UUID                       FK → VendorProfiles(Id), NOT NULL                 Nhà cung cấp phải nộp

  3     PeriodMonth       DATE                       NOT NULL                                          Tháng đối soát (lưu ngày đầu tháng)

  4     DueDate           DATE                       NOT NULL                                          Hạn nộp, ngày 25 tháng sau

  5     TotalOrders       INTEGER                    NOT NULL, DEFAULT 0                               Tổng số đơn trong tháng

  6     TotalAmount       NUMERIC(18,2)              NOT NULL, DEFAULT 0                               Tổng hoa hồng phải nộp

  7     TransactionCode   CHARACTER VARYING(100)     UNIQUE                                            Mã giao dịch nộp hoa hồng, chỉ có khi đã nộp

  8     Status            CHARACTER VARYING(20)      NOT NULL, DEFAULT 'Unpaid', CHECK: Unpaid, Paid   Trạng thái nộp

  9     PaidDate          TIMESTAMP WITH TIME ZONE                                                     Ngày nộp

  10    CreatedDate       TIMESTAMP WITH TIME ZONE   NOT NULL                                          Ngày tạo bảng kê
  ---------------------------------------------------------------------------------------------------------------------------------------------------

Ràng buộc bảng: UNIQUE (VendorId, PeriodMonth).

**4.26. Bảng Commissions**

Bảng Commissions lưu hoa hồng của từng đơn đã hoàn thành, thuộc về một bảng kê theo tháng.

  --------------------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính    Kiểu dữ liệu               Ràng buộc                                               Mô tả thuộc tính
  ----- ------------- -------------------------- ------------------------------------------------------- -------------------------------------------------------
  1     Id            UUID                       PK                                                      Khóa chính, định danh hoa hồng

  2     OrderId       UUID                       FK → Orders(Id), UNIQUE, NOT NULL                       Đơn phát sinh hoa hồng

  3     StatementId   UUID                       FK → CommissionStatements(Id), NOT NULL                 Bảng kê chứa hoa hồng

  4     OrderAmount   NUMERIC(18,2)              NOT NULL                                                Giá trị đơn dùng để tính, chụp tại lúc đơn hoàn thành

  5     Rate          NUMERIC(5,2)               NOT NULL                                                Tỷ lệ hoa hồng áp dụng (%), chụp từ loại dịch vụ

  6     Amount        NUMERIC(18,2)              NOT NULL, CHECK: làm tròn từ OrderAmount × Rate / 100   Số tiền hoa hồng

  7     CreatedDate   TIMESTAMP WITH TIME ZONE   NOT NULL                                                Ngày tạo, tức lúc đơn hoàn thành
  --------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.27. Bảng Notifications**

Bảng Notifications lưu thông báo gửi tới người dùng. Cặp ReferenceType và ReferenceId cho biết đối tượng liên quan để mở đúng trang khi người dùng bấm vào.

  -------------------------------------------------------------------------------------------------------------------------------------------------
  STT   Thuộc tính      Kiểu dữ liệu               Ràng buộc                  Mô tả thuộc tính
  ----- --------------- -------------------------- -------------------------- ---------------------------------------------------------------------
  1     Id              UUID                       PK                         Khóa chính, định danh thông báo

  2     UserId          UUID                       FK → Users(Id), NOT NULL   Người nhận

  3     Type            CHARACTER VARYING(50)      NOT NULL                   Loại thông báo, danh sách giá trị định nghĩa trong code

  4     Title           CHARACTER VARYING(255)     NOT NULL                   Tiêu đề

  5     Content         TEXT                       NOT NULL                   Nội dung đầy đủ, lưu tại lúc tạo

  6     ReferenceType   CHARACTER VARYING(50)                                 Loại đối tượng liên quan (Order, ServicePackage\...)

  7     ReferenceId     UUID                                                  Mã đối tượng liên quan, không phải khóa ngoại vì trỏ tới nhiều bảng

  8     IsRead          BOOLEAN                    NOT NULL, DEFAULT false    Đã đọc hay chưa

  9     ReadDate        TIMESTAMP WITH TIME ZONE                              Thời điểm đọc

  10    CreatedDate     TIMESTAMP WITH TIME ZONE   NOT NULL                   Thời điểm tạo
  -------------------------------------------------------------------------------------------------------------------------------------------------

**Chỉ mục đề xuất**

  -----------------------------------------------------------------------------------------------------------------------------------------
  Bảng                   Chỉ mục                                                              Phục vụ
  ---------------------- -------------------------------------------------------------------- ---------------------------------------------
  Notifications          (UserId, IsRead, CreatedDate)                                        Đếm và liệt kê thông báo chưa đọc

  Messages               (ConversationId, SentDate)                                           Tải khung chat theo thời gian

  Conversations          (CoupleId), (VendorId)                                               Danh sách hội thoại của mỗi bên

  ServicePackages        (VendorId, Status)                                                   Các gói đang hiển thị của nhà cung cấp

  PackageAlbums          (PackageId, DisplayOrder); duy nhất (PackageId) khi IsCover = true   Bộ sưu tập ảnh và đúng một ảnh bìa

  Orders                 (VendorId, Status), (WeddingId, VendorId)                            Danh sách đơn và thẻ trong Kế hoạch của tôi

  TimelineTasks          (WeddingId, ScheduledDate)                                           Hiển thị timeline và nhắc việc

  CommissionStatements   (Status, DueDate)                                                    Tìm bảng kê sắp đến hạn hoặc quá hạn
  -----------------------------------------------------------------------------------------------------------------------------------------

**Những giả định mình đã đặt**

Bạn chưa nói rõ các điểm này, nên bạn xem có cần sửa không:

1.  **Khóa chính UUID** (theo ví dụ Listings trong ảnh của bạn) và các chuỗi có độ dài do mình tự chọn.

2.  **VendorProfiles** cho phép rỗng ở các cột từ TaxCode đến CloseTime, vì hồ sơ nháp điền dần. Bạn muốn ép NOT NULL thì sửa lại và bỏ trạng thái Draft cho các cột đó.

3.  **TimelineTasks.CategoryId** cho phép rỗng và **Messages.SenderId** cho phép rỗng (tin nhắn hệ thống).

4.  **Conversations.VendorId** vẫn trỏ về Users, đúng như bạn quyết giữ nguyên.

5.  **Payments** không có cột số tiền, vì số tiền cọc nằm ở Orders.DepositAmount.

6.  **ChangeType** của OrderRevisionChanges không có ràng buộc CHECK vì bạn chưa chốt đủ danh sách giá trị.

**BỐI CẢNH CƠ SỞ DỮ LIỆU NỀN TẢNG WEDDY (tài liệu bàn giao)**

> Tài liệu này tổng hợp toàn bộ quyết định thiết kế CSDL đã chốt qua quá trình làm việc với người dùng (sinh viên làm đồ án tốt nghiệp). Mục đích: để một trợ lý khác đọc xong là hiểu đúng nghiệp vụ và tạo được cơ sở dữ liệu thật trên PostgreSQL (Supabase) đúng với thiết kế. Khi tài liệu mâu thuẫn với trí nhớ hoặc thói quen của bạn, tài liệu này là nguồn đúng. Những điểm chưa chốt nằm ở mục 15, hãy hỏi người dùng thay vì tự quyết.

**0. Cách dùng và lời nhắc mở đầu gợi ý**

Người dùng dán hoặc đính kèm tài liệu này vào cuộc trò chuyện mới, kèm lời nhắc:

Bạn là chuyên gia thiết kế PostgreSQL/Supabase. Hãy đọc kỹ tài liệu bối cảnh đính kèm về CSDL

của nền tảng Weddy rồi tạo cơ sở dữ liệu thật đúng theo thiết kế: script SQL tạo 27 bảng (đúng thứ tự

phụ thuộc), ràng buộc, chỉ mục, dữ liệu mẫu của ServiceCategories, bật RLS, và script kiểm thử.

Không tự thêm hoặc bớt bảng/cột so với tài liệu. Chỗ nào ở mục 15 chưa chốt thì hỏi tôi trước khi làm.

Việc cần làm (sản phẩm bàn giao):

1.  Một script SQL (hoặc nhiều file theo thứ tự) tạo toàn bộ 27 bảng, khóa chính, khóa ngoại, UNIQUE, CHECK, DEFAULT, chỉ mục.

2.  Trigger cập nhật UpdatedDate ở các bảng có cột này.

3.  Dữ liệu mẫu cho ServiceCategories (mục 11).

4.  Bật Row Level Security cho mọi bảng (mục 13) và tạo 2 bucket Storage (mục 12).

5.  Script kiểm thử: chèn dữ liệu mẫu theo luồng đặt hàng và kiểm tra các ràng buộc (mục 16).

6.  Trước khi viết SQL, hỏi người dùng 2 câu: (a) backend dùng gì (ví dụ .NET + EF Core, hay Node), có định dùng migration của ORM không; (b) đặt tên bảng/cột theo PascalCase có nháy kép hay snake_case (mục 3).

**1. Tổng quan dự án**

Weddy là nền tảng hỗ trợ lập kế hoạch cưới và kết nối cặp đôi với nhà cung cấp dịch vụ cưới. Ba loại người dùng:

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Vai trò (Users.Role)           Việc chính
  ------------------------------ ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Couple (cặp đôi, khách hàng)   Nhập thông tin đám cưới và tích các loại dịch vụ muốn dùng; hệ thống sinh timeline công việc; xem và so sánh nhà cung cấp, yêu thích, thêm vào Kế hoạch của tôi; nhắn tin với nhà cung cấp; nhận đơn dịch vụ, yêu cầu chỉnh sửa, thanh toán đặt cọc qua VNPay

  Vendor (nhà cung cấp)          Có hồ sơ pháp lý được admin duyệt; đăng gói dịch vụ (cũng được duyệt) kèm ảnh; nhắn tin với khách; tạo đơn gửi khách; nhận cọc; tích hoàn thành đơn; nộp hoa hồng theo tháng

  Admin (chỉ có một admin)       Quản lý yêu cầu tư vấn và tạo tài khoản nhà cung cấp; duyệt hồ sơ và gói; quản lý người dùng (khóa, mở khóa); xem giao dịch đơn hàng và hoa hồng
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Công nghệ:

-   CSDL: PostgreSQL trên Supabase. File ảnh và giấy tờ lưu ở Supabase Storage, CSDL chỉ lưu đường dẫn.

-   Đăng nhập tự làm (bảng Users có PasswordHash, không dùng Supabase Auth). Backend truy cập Supabase bằng khóa service_role; trình duyệt không truy cập CSDL trực tiếp.

-   Thanh toán đặt cọc qua VNPay.

-   Ngôn ngữ giao diện: tiếng Việt. Múi giờ nghiệp vụ: Asia/Ho_Chi_Minh (UTC+7), các cột thời điểm lưu TIMESTAMP WITH TIME ZONE.

Phạm vi (quan trọng):

-   Thanh toán trong hệ thống chỉ có tiền cọc (qua VNPay). Phần còn lại khách trả tiền mặt trực tiếp cho nhà cung cấp, ngoài hệ thống, không có dòng dữ liệu nào.

-   Mất cọc khi khách hủy, luật phạt khi nhà cung cấp nộp hoa hồng trễ, khóa tài khoản vì nộp trễ: ngoài hệ thống, không lưu.

-   Không có đánh giá sao, không có hoàn tiền, không có nhiều đợt thanh toán.

2\. Quy tắc mô hình hóa đã chốt (đừng đề xuất lại)

1.  Mỗi nhà cung cấp chỉ có MỘT loại dịch vụ (VendorProfiles.CategoryId). Một studio vừa chụp ảnh vừa quay phóng sự phải mở hai tài khoản (hạn chế đã ghi nhận).

2.  Mỗi nhà cung cấp có nhiều gói dịch vụ (ServicePackages). Gói chỉ để trưng bày (tên, mô tả, giá, ảnh) trên trang nhà cung cấp. Đơn hàng không nối với gói, mà nối thẳng với nhà cung cấp.

3.  Hạng mục trong đơn nhập tự do (OrderItems: tên, đơn vị \"Gói\" hoặc \"Bàn\", số lượng, đơn giá). Không có khóa ngoại tới gói.

4.  Yêu thích và Kế hoạch của tôi đều làm việc với nhà cung cấp, không phải gói.

5.  Mọi VendorId trỏ về VendorProfiles, trừ Conversations.VendorId trỏ về Users (tài khoản nhà cung cấp). Đây là quyết định chủ đích của người dùng, giữ nguyên.

6.  Quan hệ n:n tách bảng nối với khóa chính ghép (không có cột Id). Thuộc tính đa trị tách bảng riêng. Thuộc tính phức hợp tách thành thuộc tính đơn.

7.  Dữ liệu dẫn xuất (tổng tiền, tiền cọc\...) được lưu sẵn có chủ đích (mục 10), cập nhật cùng giao dịch với dữ liệu gốc.

3\. Quy ước kỹ thuật cho PostgreSQL / Supabase

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Hạng mục           Quy ước
  ------------------ --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Khóa chính         UUID, mặc định gen_random_uuid(). Riêng bảng nối và bảng tách đa trị dùng khóa chính ghép (ghi rõ ở mục 5)

  Thời điểm          TIMESTAMP WITH TIME ZONE, CreatedDate và UpdatedDate mặc định now(). Ngày thuần (ngày cưới, ngày sự kiện, tháng đối soát) dùng DATE

  Tiền               NUMERIC(18,2), đơn vị VND

  Phần trăm          NUMERIC(5,2)

  Trạng thái, loại   CHARACTER VARYING kèm CHECK (\... IN (\...)). Không dùng kiểu enum của Postgres để dễ đổi giá trị

  Khóa ngoại         Mặc định chặn xóa dòng cha (ON DELETE RESTRICT). Riêng OrderItems, OrderRevisions, OrderRevisionChanges dùng ON DELETE CASCADE

  Xóa dữ liệu        Không xóa cứng gói, người dùng, hồ sơ: \"xóa\" nghĩa là chuyển Hidden (gói) hoặc Locked (người dùng)

  Đặt tên            Tên bảng và cột PascalCase đúng như tài liệu (giống báo cáo). Trong PostgreSQL phải đặt trong dấu nháy kép (\"Users\", \"VendorProfiles\") nếu viết SQL thủ công; ORM như EF Core/Npgsql tự xử lý. Hỏi người dùng nếu họ muốn đổi sang snake_case để tránh phải nháy kép
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

4\. Danh sách 27 bảng (tổng quát)

Thứ tự bên dưới cũng là thứ tự tạo bảng hợp lệ khi viết script, với lưu ý: Conversations, Messages, Orders có phụ thuộc chéo nhẹ (Messages tham chiếu Orders), nên tạo Orders trước Messages.

  ------------------------------------------------------------------------
  STT    Bảng                     Mô tả ngắn
  ------ ------------------------ ----------------------------------------
  1      Users                    Tài khoản người dùng

  2      ServiceCategories        Loại dịch vụ và tỷ lệ hoa hồng

  3      Weddings                 Thông tin đám cưới

  4      WeddingCategories        (nối) Loại dịch vụ đám cưới muốn dùng

  5      TimelineTasks            Công việc timeline

  6      SearchHistories          Lịch sử tìm kiếm

  7      ConsultationRequests     Yêu cầu tư vấn từ form đăng ký hợp tác

  8      VendorProfiles           Hồ sơ nhà cung cấp

  9      VendorDocuments          Giấy tờ và ảnh pháp lý của hồ sơ

  10     VendorVerifications      Mỗi lần nộp và duyệt hồ sơ

  11     ServicePackages          Gói dịch vụ

  12     PackageTags              (tách đa trị) Từ khóa của gói

  13     PackageAlbums            Ảnh của gói

  14     PackageVerifications     Mỗi lần nộp và duyệt gói

  15     FavoriteVendors          (nối) Nhà cung cấp yêu thích

  16     PlanVendors              (nối) Nhà cung cấp trong kế hoạch

  17     Conversations            Hội thoại khách và nhà cung cấp

  18     Orders                   Đơn dịch vụ

  19     OrderItems               Hạng mục báo giá của đơn

  20     OrderRevisions           Lịch sử yêu cầu và chỉnh sửa đơn

  21     OrderRevisionChanges     (tách đa trị) Nội dung thay đổi

  22     Payments                 Thanh toán đặt cọc

  23     Invoices                 Giấy xác nhận cọc, hóa đơn cuối

  24     Messages                 Tin nhắn

  25     CommissionStatements     Bảng kê hoa hồng theo tháng

  26     Commissions              Hoa hồng của từng đơn

  27     Notifications            Thông báo
  ------------------------------------------------------------------------

(22 thực thể ở mức khái niệm + 3 bảng nối n:n WeddingCategories, FavoriteVendors, PlanVendors + 2 bảng tách từ thuộc tính đa trị PackageTags, OrderRevisionChanges = 27.)

5\. Đặc tả từng bảng

Ký hiệu: PK khóa chính, FK khóa ngoại, ? cho phép rỗng (NULL). Cột không ghi ? là NOT NULL.

5.1. Users

  ---------------------------------------------------------------------------
  Cột            Kiểu             Ràng buộc / ghi chú
  -------------- ---------------- -------------------------------------------
  Id             UUID             PK

  Username       VARCHAR(50)      UNIQUE

  Email          VARCHAR(255)     UNIQUE (dùng để đăng nhập)

  FullName       VARCHAR(150)     

  PasswordHash   VARCHAR(255)     Mật khẩu đã mã hóa

  PhoneNumber?   VARCHAR(20)      

  Role           VARCHAR(20)      CHECK: Couple, Vendor, Admin

  Status         VARCHAR(20)      DEFAULT \'Active\', CHECK: Active, Locked

  CreatedDate    TIMESTAMPTZ      

  LastLoginAt?   TIMESTAMPTZ      
  ---------------------------------------------------------------------------

5.2. ServiceCategories

  ------------------------------------------------------------------------
  Cột                 Kiểu                Ràng buộc / ghi chú
  ------------------- ------------------- --------------------------------
  Id                  UUID                PK

  Name                VARCHAR(100)        UNIQUE

  Description?        VARCHAR(500)        

  CommissionRate      NUMERIC(5,2)        CHECK 0 đến 100 (đơn vị %)
  ------------------------------------------------------------------------

5.3. Weddings

  ----------------------------------------------------------------------------------------------
  Cột                        Kiểu            Ràng buộc / ghi chú
  -------------------------- --------------- ---------------------------------------------------
  Id                         UUID            PK

  UserId                     UUID            FK → Users(Id), UNIQUE (mỗi cặp đôi một đám cưới)

  GroomName                  VARCHAR(100)    

  BrideName                  VARCHAR(100)    

  WeddingDate                DATE            

  Budget                     NUMERIC(18,2)   CHECK ≥ 0. Tổng ngân sách

  GuestCount                 INTEGER         CHECK \> 0

  City                       VARCHAR(100)    

  Style?                     VARCHAR(100)    Phong cách

  CreatedDate, UpdatedDate   TIMESTAMPTZ     
  ----------------------------------------------------------------------------------------------

5.4. WeddingCategories (bảng nối)

  -----------------------------------------------------------------------
  Cột            Kiểu      Ràng buộc
  -------------- --------- ----------------------------------------------
  WeddingId      UUID      PK (ghép), FK → Weddings(Id)

  CategoryId     UUID      PK (ghép), FK → ServiceCategories(Id)
  -----------------------------------------------------------------------

5.5. TimelineTasks

  ------------------------------------------------------------------------------------------------------------------------------
  Cột              Kiểu           Ràng buộc / ghi chú
  ---------------- -------------- ----------------------------------------------------------------------------------------------
  Id               UUID           PK

  WeddingId        UUID           FK → Weddings(Id)

  CategoryId?      UUID           FK → ServiceCategories(Id). Rỗng nếu việc không thuộc loại nào

  Title            VARCHAR(255)   

  ScheduledDate    DATE           Ngày dự kiến thực hiện công việc (không phải hạn chót). Khách được sửa

  Status           VARCHAR(20)    DEFAULT \'Todo\', CHECK: Todo, Done

  CompletedDate?   TIMESTAMPTZ    Ngày hoàn thành thực tế

  TaskType         VARCHAR(20)    CHECK: Frame (việc khung), Detail (việc chi tiết). Hai loại cùng cấp, không có cha con

  TaskCode?        VARCHAR(50)    Mã mẫu công việc do hệ thống sinh; rỗng với việc khách tự thêm. UNIQUE (WeddingId, TaskCode)

  DisplayOrder     INTEGER        DEFAULT 0. Thứ tự trong cùng loại dịch vụ

  CreatedDate      TIMESTAMPTZ    
  ------------------------------------------------------------------------------------------------------------------------------

5.6. SearchHistories

  ------------------------------------------------------------------------
  Cột                 Kiểu                      Ghi chú
  ------------------- ------------------------- --------------------------
  Id                  UUID                      PK

  UserId              UUID                      FK → Users(Id)

  Keyword             VARCHAR(255)              Từ khóa tìm kiếm

  CreatedDate         TIMESTAMPTZ               Thời điểm tìm
  ------------------------------------------------------------------------

Chỉ lưu từ khóa. Người dùng đã xóa cột Filters và City khỏi bảng này (không tách thành cột khác).

5.7. ConsultationRequests

  --------------------------------------------------------------------------------------------------------
  Cột                        Kiểu           Ghi chú
  -------------------------- -------------- --------------------------------------------------------------
  Id                         UUID           PK

  CategoryId                 UUID           FK → ServiceCategories(Id). Lĩnh vực hoạt động

  BrandName                  VARCHAR(150)   Tên thương hiệu / studio

  ContactName                VARCHAR(100)   

  PhoneNumber                VARCHAR(20)    

  Email                      VARCHAR(255)   Dùng để tạo tài khoản nhanh

  IsContacted                BOOLEAN        DEFAULT false

  ContactedDate?             TIMESTAMPTZ    

  Qualification              VARCHAR(20)    DEFAULT \'Pending\', CHECK: Pending, Qualified, NotQualified

  AdminNote?                 TEXT           

  CreatedDate, UpdatedDate   TIMESTAMPTZ    
  --------------------------------------------------------------------------------------------------------

Không có cột \"người xử lý\" (chỉ một admin) và không có cột \"lời nhắn\". Không có UserId: \"đã tạo tài khoản\" suy ra bằng cách tra Users.Email.

5.8. VendorProfiles

  ------------------------------------------------------------------------------------------------------------------------------------------------------------
  Cột                        Kiểu           Ghi chú
  -------------------------- -------------- ------------------------------------------------------------------------------------------------------------------
  Id                         UUID           PK

  UserId                     UUID           FK → Users(Id), UNIQUE

  CategoryId                 UUID           FK → ServiceCategories(Id). Loại dịch vụ duy nhất

  BusinessName               VARCHAR(200)   

  TaxCode?                   VARCHAR(20)    UNIQUE

  RepresentativeName?        VARCHAR(100)   

  Address?, Ward?, City?     VARCHAR        City dùng để lọc và gợi ý

  Description?               TEXT           

  WorkingHours?              VARCHAR(100)   Giờ làm việc dạng chuỗi mô tả hiển thị, ví dụ T2 - T6: 8:00 - 22:00. Không dùng để lọc hay tính toán

  GoogleMapsUrl?             VARCHAR(500)   Liên kết Google Maps do nhà cung cấp dán (tùy chọn). Để trống thì hệ thống tự ghép link từ địa chỉ (xem mục 9.2)

  Status                     VARCHAR(20)    DEFAULT \'Draft\', CHECK: Draft, Pending, NeedRevision, Approved

  CreatedDate, UpdatedDate   TIMESTAMPTZ    
  ------------------------------------------------------------------------------------------------------------------------------------------------------------

Các cột từ TaxCode đến GoogleMapsUrl cho phép rỗng vì hồ sơ nháp điền dần; backend kiểm tra bắt buộc lúc nộp.

5.9. VendorDocuments

  ---------------------------------------------------------------------------------------------------------------------------------
  Cột            Kiểu           Ghi chú
  -------------- -------------- ---------------------------------------------------------------------------------------------------
  Id             UUID           PK

  VendorId       UUID           FK → VendorProfiles(Id)

  DocumentType   VARCHAR(30)    CHECK: BusinessLicense, StorefrontPhoto, SignboardPhoto, FoodSafety, FireSafety, SkillCertificate

  Url            VARCHAR(500)   Đường dẫn tương đối trong bucket riêng tư vendor-documents

  DisplayOrder   INTEGER        DEFAULT 0

  CreatedDate    TIMESTAMPTZ    
  ---------------------------------------------------------------------------------------------------------------------------------

5.10. VendorVerifications

  --------------------------------------------------------------------------------------------
  Cột             Kiểu           Ghi chú
  --------------- -------------- -------------------------------------------------------------
  Id              UUID           PK. Mỗi lần nộp là một dòng

  VendorId        UUID           FK → VendorProfiles(Id)

  Status          VARCHAR(20)    DEFAULT \'Pending\', CHECK: Pending, Approved, NeedRevision

  AdminNote?      TEXT           CHECK: bắt buộc khi Status = \'NeedRevision\'

  SubmittedDate   TIMESTAMPTZ    

  ReviewedDate?   TIMESTAMPTZ    
  --------------------------------------------------------------------------------------------

5.11. ServicePackages

  ---------------------------------------------------------------------------------------------------------------------
  Cột                        Kiểu            Ghi chú
  -------------------------- --------------- --------------------------------------------------------------------------
  Id                         UUID            PK

  VendorId                   UUID            FK → VendorProfiles(Id)

  Name                       VARCHAR(200)    

  Description?               TEXT            

  Price                      NUMERIC(18,2)   CHECK ≥ 0. Giá cụ thể của gói (không có min/max)

  Capacity?                  INTEGER         CHECK \> 0. Sức chứa (gói trung tâm tổ chức sự kiện)

  Status                     VARCHAR(20)     DEFAULT \'Draft\', CHECK: Draft, Pending, NeedRevision, Approved, Hidden

  CreatedDate, UpdatedDate   TIMESTAMPTZ     
  ---------------------------------------------------------------------------------------------------------------------

5.12. PackageTags (tách đa trị)

  ------------------------------------------------------------------------
  Cột          Kiểu               Ràng buộc
  ------------ ------------------ ----------------------------------------
  PackageId    UUID               PK (ghép), FK → ServicePackages(Id)

  Tag          VARCHAR(50)        PK (ghép). Từ khóa hoặc phong cách
  ------------------------------------------------------------------------

5.13. PackageAlbums

  ----------------------------------------------------------------------------------------------------------------------------------
  Cột            Kiểu           Ghi chú
  -------------- -------------- ----------------------------------------------------------------------------------------------------
  Id             UUID           PK

  PackageId      UUID           FK → ServicePackages(Id)

  Url            VARCHAR(500)   Đường dẫn tương đối trong bucket công khai package-albums

  DisplayOrder   INTEGER        DEFAULT 0

  IsCover        BOOLEAN        DEFAULT false. Chỉ một ảnh bìa mỗi gói: chỉ mục duy nhất một phần (PackageId) WHERE IsCover = true
  ----------------------------------------------------------------------------------------------------------------------------------

5.14. PackageVerifications

  --------------------------------------------------------------------------------------------
  Cột             Kiểu           Ghi chú
  --------------- -------------- -------------------------------------------------------------
  Id              UUID           PK. Mỗi lần gửi duyệt là một dòng

  PackageId       UUID           FK → ServicePackages(Id)

  Status          VARCHAR(20)    DEFAULT \'Pending\', CHECK: Pending, Approved, NeedRevision

  AdminNote?      TEXT           CHECK: bắt buộc khi NeedRevision

  ReviewedDate?   TIMESTAMPTZ    

  CreatedDate     TIMESTAMPTZ    Ngày gửi duyệt
  --------------------------------------------------------------------------------------------

5.15. FavoriteVendors (nối)

  -----------------------------------------------------------------------
  Cột            Kiểu               Ràng buộc
  -------------- ------------------ -------------------------------------
  UserId         UUID               PK (ghép), FK → Users(Id)

  VendorId       UUID               PK (ghép), FK → VendorProfiles(Id)

  CreatedDate    TIMESTAMPTZ        Thuộc tính của quan hệ
  -----------------------------------------------------------------------

5.16. PlanVendors (nối)

  -----------------------------------------------------------------------
  Cột            Kiểu               Ràng buộc
  -------------- ------------------ -------------------------------------
  WeddingId      UUID               PK (ghép), FK → Weddings(Id)

  VendorId       UUID               PK (ghép), FK → VendorProfiles(Id)

  CreatedDate    TIMESTAMPTZ        Thuộc tính của quan hệ
  -----------------------------------------------------------------------

5.17. Conversations

  --------------------------------------------------------------------------------------------------------------------------------
  Cột                Kiểu           Ghi chú
  ------------------ -------------- ----------------------------------------------------------------------------------------------
  Id                 UUID           PK

  CoupleId           UUID           FK → Users(Id)

  VendorId           UUID           FK → Users(Id) (tài khoản nhà cung cấp, KHÔNG phải VendorProfiles)

  CategoryId         UUID           FK → ServiceCategories(Id). Loại dịch vụ của nhà cung cấp, dẫn xuất lưu sẵn để hiển thị nhãn

  LastMessageDate?   TIMESTAMPTZ    Sắp xếp danh sách hội thoại

  CreatedDate        TIMESTAMPTZ    
  --------------------------------------------------------------------------------------------------------------------------------

Ràng buộc bảng: UNIQUE (CoupleId, VendorId); CHECK (CoupleId \<\> VendorId). Backend kiểm tra tài khoản trong VendorId có Role = \'Vendor\'.

5.18. Orders

  -------------------------------------------------------------------------------------------------------------------------------------------------------
  Cột               Kiểu            Ghi chú
  ----------------- --------------- ---------------------------------------------------------------------------------------------------------------------
  Id                UUID            PK

  VendorId          UUID            FK → VendorProfiles(Id). Nhà cung cấp nhận đơn (đường duy nhất để biết đơn thuộc ai)

  WeddingId         UUID            FK → Weddings(Id). Đám cưới của khách

  OrderCode         VARCHAR(30)     UNIQUE. Giữ nguyên dù đơn được sửa nhiều lần

  CustomerName      VARCHAR(150)    Tự điền từ tài khoản khách trong hội thoại; nhà cung cấp sửa trên đơn không đổi hồ sơ khách

  CustomerPhone     VARCHAR(20)     Tự điền tương tự

  EventDate         DATE            Ngày diễn ra sự kiện

  TotalAmount       NUMERIC(18,2)   DEFAULT 0, CHECK ≥ 0. Dẫn xuất: tổng OrderItems.Amount

  DepositPercent    NUMERIC(5,2)    CHECK \> 0 và \< 100. Nhà cung cấp nhập, khóa sau khi khách cọc

  DepositAmount     NUMERIC(18,2)   CHECK ≤ TotalAmount. Dẫn xuất: TotalAmount × DepositPercent / 100, làm tròn đến 100.000đ; cố định sau khi khách cọc

  DepositDueDate?   TIMESTAMPTZ     Hạn nộp cọc = lúc gửi (hoặc gửi lại) + 1 ngày

  Status            VARCHAR(20)     DEFAULT \'Draft\', CHECK: Draft, Pending, NeedRevision, Deposited, Completed, Expired, Cancelled

  Note?             TEXT            Ghi chú gửi khách

  CompletedDate?    TIMESTAMPTZ     Mốc tính hoa hồng

  CancelledDate?    TIMESTAMPTZ     

  CreatedDate       TIMESTAMPTZ     
  -------------------------------------------------------------------------------------------------------------------------------------------------------

Không có cột \"người tạo đơn\" (chỉ nhà cung cấp tạo đơn, suy ra từ VendorId).

5.19. OrderItems

  ------------------------------------------------------------------------------------------------------------------------
  Cột         Kiểu            Ghi chú
  ----------- --------------- --------------------------------------------------------------------------------------------
  Id          UUID            PK

  OrderId     UUID            FK → Orders(Id) ON DELETE CASCADE

  ItemName    VARCHAR(255)    Ví dụ \"Tiệc cưới -- Menu A\"

  Unit        VARCHAR(30)     DEFAULT \'Gói\'. Thường là \"Gói\" (số lượng mặc định 1) hoặc \"Bàn\" (số lượng tùy chỉnh)

  Quantity    INTEGER         DEFAULT 1, CHECK \> 0

  UnitPrice   NUMERIC(18,2)   CHECK ≥ 0. Nhà cung cấp nhập

  Amount      NUMERIC(18,2)   CHECK = Quantity × UnitPrice. Dẫn xuất
  ------------------------------------------------------------------------------------------------------------------------

5.20. OrderRevisions

  ------------------------------------------------------------------------------------
  Cột               Kiểu            Ghi chú
  ----------------- --------------- --------------------------------------------------
  Id                UUID            PK

  OrderId           UUID            FK → Orders(Id) ON DELETE CASCADE

  RevisionType      VARCHAR(20)     CHECK: BeforeDeposit, AfterDeposit

  RequestNote?      TEXT            Lời nhắn của khách

  OldTotalAmount    NUMERIC(18,2)   Tổng trước khi sửa

  NewTotalAmount?   NUMERIC(18,2)   Rỗng khi chưa áp dụng

  Status            VARCHAR(20)     DEFAULT \'Requested\', CHECK: Requested, Applied

  CreatedDate       TIMESTAMPTZ     

  AppliedDate?      TIMESTAMPTZ     
  ------------------------------------------------------------------------------------

5.21. OrderRevisionChanges (tách đa trị)

  -----------------------------------------------------------------------------------------------------------------------------------------------------
  Cột          Kiểu          Ràng buộc
  ------------ ------------- --------------------------------------------------------------------------------------------------------------------------
  RevisionId   UUID          PK (ghép), FK → OrderRevisions(Id) ON DELETE CASCADE

  ChangeType   VARCHAR(30)   PK (ghép). Ví dụ Quantity (đổi số lượng), EventDate (đổi ngày thực hiện). Chưa chốt đủ danh sách giá trị, chưa đặt CHECK
  -----------------------------------------------------------------------------------------------------------------------------------------------------

5.22. Payments (chỉ đặt cọc, quan hệ 1:1 với Orders)

  ----------------------------------------------------------------------------------------
  Cột                Kiểu           Ghi chú
  ------------------ -------------- ------------------------------------------------------
  Id                 UUID           PK

  OrderId            UUID           FK → Orders(Id), UNIQUE

  TransactionCode?   VARCHAR(100)   UNIQUE. Mã giao dịch VNPay, chỉ có khi đã thanh toán

  Status             VARCHAR(20)    DEFAULT \'Unpaid\', CHECK: Unpaid, Paid

  PaidDate?          TIMESTAMPTZ    

  CreatedDate        TIMESTAMPTZ    Lúc nhà cung cấp gửi đơn
  ----------------------------------------------------------------------------------------

CHECK: Status = \'Unpaid\' OR (TransactionCode IS NOT NULL AND PaidDate IS NOT NULL). Không có cột số tiền và không có cột loại: số tiền cọc nằm ở Orders.DepositAmount.

5.23. Invoices

  -----------------------------------------------------------------------------------------------------
  Cột           Kiểu           Ghi chú
  ------------- -------------- ------------------------------------------------------------------------
  Id            UUID           PK

  OrderId       UUID           FK → Orders(Id)

  InvoiceCode   VARCHAR(30)    UNIQUE

  Type          VARCHAR(20)    CHECK: DepositReceipt (giấy xác nhận cọc), FinalInvoice (hóa đơn cuối)

  CreatedDate   TIMESTAMPTZ    
  -----------------------------------------------------------------------------------------------------

Ràng buộc bảng: UNIQUE (OrderId, Type). Quan hệ Orders--Invoices là 1:n (tối đa 2 dòng mỗi đơn).

5.24. Messages

  ----------------------------------------------------------------------------------------------------------
  Cột              Kiểu           Ghi chú
  ---------------- -------------- --------------------------------------------------------------------------
  Id               UUID           PK

  ConversationId   UUID           FK → Conversations(Id)

  SenderId?        UUID           FK → Users(Id). Rỗng với tin nhắn hệ thống

  OrderId?         UUID           FK → Orders(Id). Chỉ có với tin loại Order, DepositReceipt, FinalInvoice

  Content          TEXT           

  Type             VARCHAR(20)    DEFAULT \'Text\', CHECK: Text, Order, DepositReceipt, FinalInvoice

  IsRead           BOOLEAN        DEFAULT false

  ReadDate?        TIMESTAMPTZ    

  SentDate         TIMESTAMPTZ    
  ----------------------------------------------------------------------------------------------------------

5.25. CommissionStatements

  ------------------------------------------------------------------------------------------------------------
  Cột                Kiểu            Ghi chú
  ------------------ --------------- -------------------------------------------------------------------------
  Id                 UUID            PK

  VendorId           UUID            FK → VendorProfiles(Id)

  PeriodMonth        DATE            Tháng đối soát, lưu ngày đầu tháng của tháng chứa CompletedDate các đơn

  DueDate            DATE            Ngày 25 của tháng sau PeriodMonth. Dẫn xuất lưu sẵn

  TotalOrders        INTEGER         DEFAULT 0. Dẫn xuất

  TotalAmount        NUMERIC(18,2)   DEFAULT 0. Dẫn xuất (tổng hoa hồng phải nộp)

  TransactionCode?   VARCHAR(100)    UNIQUE. Mã giao dịch nộp hoa hồng

  Status             VARCHAR(20)     DEFAULT \'Unpaid\', CHECK: Unpaid, Paid

  PaidDate?          TIMESTAMPTZ     

  CreatedDate        TIMESTAMPTZ     
  ------------------------------------------------------------------------------------------------------------

Ràng buộc bảng: UNIQUE (VendorId, PeriodMonth). \"Quá hạn\" không lưu, tính khi truy vấn: Status = \'Unpaid\' AND DueDate \< hôm nay. Nộp một lần cho cả bảng kê, không có bảng giao dịch nộp riêng.

5.26. Commissions (1:1 với Orders)

  -------------------------------------------------------------------------------------
  Cột           Kiểu            Ghi chú
  ------------- --------------- -------------------------------------------------------
  Id            UUID            PK

  OrderId       UUID            FK → Orders(Id), UNIQUE

  StatementId   UUID            FK → CommissionStatements(Id)

  OrderAmount   NUMERIC(18,2)   Bản chụp TotalAmount cuối cùng tại lúc đơn hoàn thành

  Rate          NUMERIC(5,2)    Bản chụp CommissionRate của loại dịch vụ tại lúc đó

  Amount        NUMERIC(18,2)   CHECK ≥ 0. OrderAmount × Rate / 100

  CreatedDate   TIMESTAMPTZ     Lúc đơn hoàn thành
  -------------------------------------------------------------------------------------

5.27. Notifications

  -----------------------------------------------------------------------------------------------------------
  Cột              Kiểu           Ghi chú
  ---------------- -------------- ---------------------------------------------------------------------------
  Id               UUID           PK

  UserId           UUID           FK → Users(Id). Người nhận

  Type             VARCHAR(50)    Danh sách giá trị ở mục 9.13, không đặt CHECK (định nghĩa trong code)

  Title            VARCHAR(255)   

  Content          TEXT           Nội dung đầy đủ lưu tại lúc tạo

  ReferenceType?   VARCHAR(50)    Order, ServicePackage, VendorProfile, CommissionStatement\...

  ReferenceId?     UUID           Không phải khóa ngoại (trỏ tới nhiều bảng); dùng để mở đúng trang khi bấm

  IsRead           BOOLEAN        DEFAULT false

  ReadDate?        TIMESTAMPTZ    

  CreatedDate      TIMESTAMPTZ    
  -----------------------------------------------------------------------------------------------------------

6\. Bảng quan hệ mức khái niệm (30 dòng)

  -------------------------------------------------------------------------------------------------------------------------------------------------------------
  Thực thể               Quan hệ             Thực thể               Bản số   Cách biểu diễn ở mức logic
  ---------------------- ------------------- ---------------------- -------- ----------------------------------------------------------------------------------
  Users                  Có                  Weddings               1:1      Weddings.UserId (UNIQUE)

  Users                  Có                  VendorProfiles         1:1      VendorProfiles.UserId (UNIQUE)

  Users                  Có                  SearchHistories        1:n      SearchHistories.UserId

  Users                  Yêu thích           VendorProfiles         n:n      Bảng FavoriteVendors

  Users                  Nhận                Notifications          1:n      Notifications.UserId

  Users                  Tham gia            Conversations          1:n      Conversations.CoupleId và Conversations.VendorId (hai khóa ngoại cùng trỏ Users)

  Conversations          Có                  Messages               1:n      Messages.ConversationId

  Users                  Gửi                 Messages               1:n      Messages.SenderId

  Orders                 Hiển thị trong      Messages               1:n      Messages.OrderId

  Weddings               Có                  TimelineTasks          1:n      TimelineTasks.WeddingId

  Weddings               Thêm vào kế hoạch   VendorProfiles         n:n      Bảng PlanVendors

  Weddings               Muốn sử dụng        ServiceCategories      n:n      Bảng WeddingCategories

  Weddings               Gắn với             Orders                 1:n      Orders.WeddingId

  ServiceCategories      Phân loại           TimelineTasks          1:n      TimelineTasks.CategoryId

  ServiceCategories      Phân loại           VendorProfiles         1:n      VendorProfiles.CategoryId

  ServiceCategories      Phân loại           ConsultationRequests   1:n      ConsultationRequests.CategoryId

  ServiceCategories      Phân loại           Conversations          1:n      Conversations.CategoryId

  VendorProfiles         Có                  VendorDocuments        1:n      VendorDocuments.VendorId

  VendorProfiles         Có                  VendorVerifications    1:n      VendorVerifications.VendorId

  VendorProfiles         Sở hữu              ServicePackages        1:n      ServicePackages.VendorId

  VendorProfiles         Có                  CommissionStatements   1:n      CommissionStatements.VendorId

  VendorProfiles         Nhận                Orders                 1:n      Orders.VendorId

  ServicePackages        Có                  PackageAlbums          1:n      PackageAlbums.PackageId

  ServicePackages        Có                  PackageVerifications   1:n      PackageVerifications.PackageId

  Orders                 Gồm                 OrderItems             1:n      OrderItems.OrderId

  Orders                 Có                  OrderRevisions         1:n      OrderRevisions.OrderId

  Orders                 Có                  Payments               1:1      Payments.OrderId (UNIQUE)

  Orders                 Có                  Invoices               1:n      Invoices.OrderId

  Orders                 Phát sinh           Commissions            1:1      Commissions.OrderId (UNIQUE)

  CommissionStatements   Gồm                 Commissions            1:n      Commissions.StatementId
  -------------------------------------------------------------------------------------------------------------------------------------------------------------

Thêm hai quan hệ sinh ra ở bước chuẩn hóa: ServicePackages 1:n PackageTags (PackageTags.PackageId) và OrderRevisions 1:n OrderRevisionChanges (OrderRevisionChanges.RevisionId).

7\. Ràng buộc duy nhất, CHECK, chỉ mục

UNIQUE: Users.Username; Users.Email; ServiceCategories.Name; Weddings.UserId; VendorProfiles.UserId; VendorProfiles.TaxCode; TimelineTasks (WeddingId, TaskCode); Conversations (CoupleId, VendorId); Orders.OrderCode; Payments.OrderId; Payments.TransactionCode; Invoices.InvoiceCode; Invoices (OrderId, Type); Commissions.OrderId; CommissionStatements (VendorId, PeriodMonth); CommissionStatements.TransactionCode. Các cột UNIQUE cho phép rỗng (TaxCode, TaskCode, hai TransactionCode) chấp nhận nhiều dòng rỗng (hành vi chuẩn của PostgreSQL).

CHECK đáng chú ý:

-   VendorVerifications, PackageVerifications: Status \<\> \'NeedRevision\' OR AdminNote IS NOT NULL.

-   Payments: Status = \'Unpaid\' OR (TransactionCode IS NOT NULL AND PaidDate IS NOT NULL).

-   Orders: DepositPercent \> 0 AND DepositPercent \< 100; DepositAmount \<= TotalAmount.

-   OrderItems: Amount = Quantity \* UnitPrice.

-   Conversations: CoupleId \<\> VendorId.

Chỉ mục đề xuất:

  -------------------------------------------------------------------------------------------------------------------------------------------
  Bảng                   Chỉ mục                                                                  Phục vụ
  ---------------------- ------------------------------------------------------------------------ -------------------------------------------
  Notifications          (UserId, IsRead, CreatedDate)                                            Đếm và liệt kê thông báo chưa đọc

  Messages               (ConversationId, SentDate)                                               Tải khung chat

  Conversations          (CoupleId), (VendorId)                                                   Danh sách hội thoại mỗi bên

  ServicePackages        (VendorId, Status)                                                       Các gói đang hiển thị

  PackageAlbums          (PackageId, DisplayOrder); duy nhất một phần (PackageId) WHERE IsCover   Bộ sưu tập và đúng một ảnh bìa

  Orders                 (VendorId, Status), (WeddingId, VendorId)                                Danh sách đơn; thẻ trong Kế hoạch của tôi

  TimelineTasks          (WeddingId, ScheduledDate)                                               Timeline và nhắc việc

  CommissionStatements   (Status, DueDate)                                                        Bảng kê sắp đến hạn hoặc quá hạn
  -------------------------------------------------------------------------------------------------------------------------------------------

Trigger: cập nhật UpdatedDate = now() khi sửa dòng ở Weddings, ConsultationRequests, VendorProfiles, ServicePackages.

8\. Giá trị enum (bảng tổng hợp)

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Cột                                                       Giá trị                                                                                      Ý nghĩa
  --------------------------------------------------------- -------------------------------------------------------------------------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------
  Users.Role                                                Couple, Vendor, Admin                                                                        Cặp đôi, Nhà cung cấp, Quản trị viên

  Users.Status                                              Active, Locked                                                                               Hoạt động, Bị khóa

  TimelineTasks.Status                                      Todo, Done                                                                                   Cần làm, Đã xong

  TimelineTasks.TaskType                                    Frame, Detail                                                                                Việc khung (mốc lớn như \"Thử món\", \"Chốt trung tâm\"), Việc chi tiết (sinh sau khi chốt, như \"Điều chỉnh khẩu vị\", \"Lên vị trí bàn\")

  ConsultationRequests.Qualification                        Pending, Qualified, NotQualified                                                             Chưa đánh giá, Đạt (hiện nút tạo tài khoản nhanh), Chưa đạt

  VendorProfiles.Status                                     Draft, Pending, NeedRevision, Approved                                                       Bản nháp, Chờ duyệt, Cần chỉnh sửa/bổ sung (kèm lý do), Đã duyệt. Không có Rejected

  VendorDocuments.DocumentType                              BusinessLicense, StorefrontPhoto, SignboardPhoto, FoodSafety, FireSafety, SkillCertificate   Giấy phép kinh doanh, Ảnh mặt tiền, Ảnh biển hiệu, Giấy an toàn thực phẩm, Giấy phòng cháy chữa cháy, Giấy chứng nhận tay nghề

  VendorVerifications.Status, PackageVerifications.Status   Pending, Approved, NeedRevision                                                              Chờ duyệt, Đã duyệt, Cần chỉnh sửa (kèm lý do)

  ServicePackages.Status                                    Draft, Pending, NeedRevision, Approved, Hidden                                               Bản nháp, Chờ duyệt, Cần chỉnh sửa, Đã duyệt (hiển thị với khách), Đang ẩn (khôi phục được)

  Messages.Type                                             Text, Order, DepositReceipt, FinalInvoice                                                    Văn bản, Thẻ đơn dịch vụ, Giấy xác nhận cọc, Hóa đơn cuối

  Orders.Status                                             Draft, Pending, NeedRevision, Deposited, Completed, Expired, Cancelled                       Xem mục 9.5

  OrderRevisions.RevisionType                               BeforeDeposit, AfterDeposit                                                                  Sửa trước cọc, Sửa sau cọc

  OrderRevisions.Status                                     Requested, Applied                                                                           Khách đã yêu cầu và chờ nhà cung cấp sửa, Nhà cung cấp đã sửa và gửi lại

  Payments.Status, CommissionStatements.Status              Unpaid, Paid                                                                                 Chưa thanh toán (kể cả khi lượt VNPay hết hạn hoặc bị hủy), Đã thanh toán

  Invoices.Type                                             DepositReceipt, FinalInvoice                                                                 Giấy xác nhận cọc, Hóa đơn cuối
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

9\. Quy tắc nghiệp vụ chi tiết

9.1. Yêu cầu tư vấn và tạo tài khoản nhà cung cấp

-   Form đăng ký hợp tác (công khai, chưa đăng nhập): tên thương hiệu, lĩnh vực (một trong các loại dịch vụ), người liên hệ, số điện thoại, email. Không có ô lời nhắn.

-   Admin: tích IsContacted (ghi ContactedDate). Chỉ khi đã liên hệ mới được đánh giá Qualification. Bỏ tích liên hệ thì kết quả đánh giá về Pending.

-   Khi Qualified hiện nút \"Tạo tài khoản nhanh\": tự điền email, số điện thoại, họ tên từ yêu cầu; admin chỉ nhập Username và chọn Role (mặc định Vendor), không nhập mật khẩu. Hệ thống tự sinh mật khẩu ngẫu nhiên (backend), chỉ lưu PasswordHash, rồi gửi tên đăng nhập và mật khẩu về email của người dùng. Chặn email và username trùng. Người dùng đăng nhập rồi tự đổi mật khẩu (chức năng đổi mật khẩu chỉ cập nhật PasswordHash, không cần thêm bảng hay cột). Chức năng \"Thêm người dùng\" của admin dùng chung luồng này.

-   Đã tạo tài khoản hay chưa: tra Users theo Email (không có cột liên kết).

-   Hạn chế đã biết: mật khẩu được gửi qua email dạng chữ thường nên người dùng nên đổi ngay lần đầu; thiết kế chưa có cột ép đổi mật khẩu lần đầu (xem mục 15). Mật khẩu sinh ngẫu nhiên đủ mạnh (ví dụ 12 ký tự), không ghi vào log, không hiển thị lại cho admin. Nếu gửi email lỗi hoặc người dùng mất mật khẩu thì admin dùng chức năng cấp lại mật khẩu (sinh mật khẩu mới và gửi lại), cũng chỉ cập nhật PasswordHash.

9.2. Hồ sơ nhà cung cấp

-   Draft → nộp → tạo một dòng VendorVerifications (Pending, ghi SubmittedDate), hồ sơ thành Pending.

-   Admin duyệt: Approved, hoặc yêu cầu chỉnh sửa: NeedRevision kèm AdminNote bắt buộc. Nhà cung cấp sửa và nộp lại thì tạo dòng xác minh mới. Lịch sử các lần nộp giữ nguyên.

-   Không có \"từ chối hẳn\". Không giới hạn số lần nộp.

-   Giấy tờ bắt buộc kiểm tra trong code lúc nộp: mọi loại cần BusinessLicense, StorefrontPhoto, SignboardPhoto; trung tâm tổ chức sự kiện thêm FoodSafety và FireSafety; Makeup thêm SkillCertificate.

-   Giấy tờ lưu ở bucket riêng tư; chỉ admin và chính nhà cung cấp xem được (qua signed URL có hạn).

-   Liên kết Google Maps trên trang nhà cung cấp (khách vào xem hồ sơ và chọn gói thì thấy thông tin cơ bản của hồ sơ, kèm nút \"Xem trên Google Maps\" mở tab mới). Không lưu tọa độ hay mã địa điểm (đã bỏ Latitude, Longitude, PlaceId). Quy tắc chọn link:

    1.  Nếu GoogleMapsUrl có giá trị: dùng link đó.

    2.  Nếu rỗng: ghép link từ địa chỉ: https://www.google.com/maps/search/?api=1&query= + mã hóa URL của BusinessName, Address, Ward, City (đưa cả tên cửa hàng vào để Google tìm đúng điểm kinh doanh). Định dạng này không cần khóa API.

    3.  Backend kiểm tra GoogleMapsUrl khi lưu: chỉ nhận đường dẫn https của Google Maps (ví dụ tên miền google.com/maps, maps.google.com, maps.app.goo.gl), từ chối mọi tên miền khác; khi hiển thị dùng target=\"\_blank\" kèm rel=\"noopener noreferrer\".

9.3. Gói dịch vụ

-   Vòng đời: Draft → Pending (tạo PackageVerifications Pending) → Approved hoặc NeedRevision (AdminNote bắt buộc) → sửa, nộp lại tạo dòng mới. Hidden là nhà cung cấp tạm ẩn (khôi phục được). \"Xóa\" thực chất là Hidden.

-   Gói hiển thị với khách khi: gói Approved và hồ sơ nhà cung cấp Approved và tài khoản Active.

-   Khoảng giá hiển thị ở nhà cung cấp không lưu: là MIN(Price) đến MAX(Price) của các gói đang hiển thị. Nhà cung cấp chưa có gói hiển thị nào thì không hiện cho khách.

-   Ảnh gói: mỗi ảnh một dòng PackageAlbums; ảnh IsCover là ảnh đại diện; thứ tự theo DisplayOrder. Giao diện hiển thị lưới ảnh, bấm vào phóng to kiểu lightbox có nút trước/sau.

9.4. Kế hoạch, yêu thích, tin nhắn

-   FavoriteVendors: khách yêu thích nhà cung cấp để so sánh (cùng loại dịch vụ). Thuộc tính so sánh tính khi truy vấn từ các gói: khoảng giá, số gói, sức chứa lớn nhất, gộp tags; cộng thông tin hồ sơ (thành phố, giờ làm việc).

-   PlanVendors: nhà cung cấp trong Kế hoạch của tôi. Mỗi loại dịch vụ chỉ một nhà cung cấp trong kế hoạch (kiểm tra bằng code). Không cho xóa khỏi kế hoạch khi có đơn Deposited hoặc Completed.

-   Nhãn trên thẻ nhà cung cấp trong kế hoạch suy ra, không lưu, từ đơn của (đám cưới, nhà cung cấp):

  -----------------------------------------------------------------------------------------------------------------
  Đơn gần nhất                               Nhãn
  ------------------------------------------ ----------------------------------------------------------------------
  Không có, hoặc Draft, Expired, Cancelled   Dự kiến (đang cân nhắc)

  Pending, NeedRevision                      Chờ đặt cọc (nhãn tùy chọn)

  Deposited                                  Đã chốt (hiện mã đơn, ngày thực hiện, đã cọc, còn lại trả trực tiếp)

  Completed                                  Hoàn thành
  -----------------------------------------------------------------------------------------------------------------

-   Conversations: mỗi cặp (khách, nhà cung cấp) một hội thoại. Tin nhắn thường, thẻ đơn dịch vụ, giấy xác nhận cọc, hóa đơn cuối. Tin nhắn hệ thống có SenderId rỗng (ví dụ thông báo khách vừa đổi lịch).

9.5. Đơn dịch vụ: tạo, sửa, trạng thái

Tạo đơn (nhà cung cấp): từ khung chat với khách. Tên và số điện thoại khách tự điền từ tài khoản khách. Nhà cung cấp nhập các hạng mục (OrderItems), DepositPercent, EventDate, ghi chú. Hệ thống tính TotalAmount, DepositAmount, DepositDueDate. Có nút \"Lưu nháp\" (Draft, khách chưa thấy) và \"Gửi đơn cho khách hàng\" (Pending). Khi gửi: tạo sẵn một dòng Payments (Unpaid) và gửi tin nhắn loại Order vào hội thoại.

Trạng thái đơn:

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Giá trị        Ý nghĩa                                                                                                                                     Sửa đơn
  -------------- ------------------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------------------------------------------------
  Draft          Nhà cung cấp lưu nháp                                                                                                                       Sửa tự do

  Pending        Đã gửi, chờ khách xác nhận và cọc, trong hạn 1 ngày                                                                                         Sửa tự do; gửi lại thì đặt lại hạn

  NeedRevision   Khách yêu cầu chỉnh sửa trước cọc, chờ nhà cung cấp sửa                                                                                     Sửa tự do. Không bị hết hạn khi đang chờ

  Deposited      Khách đã cọc thành công, dịch vụ đang thực hiện                                                                                             Sửa được hạng mục, ngày, ghi chú. Khóa DepositPercent và DepositAmount. Tổng mới không nhỏ hơn tiền đã cọc

  Completed      Khách đã trả nốt tiền mặt; nhà cung cấp tích hoàn thành (chỉ khi EventDate đã qua) hoặc hệ thống tự hoàn thành sau 7 ngày kể từ EventDate   Khóa. Bắt đầu tính hoa hồng

  Expired        Quá DepositDueDate mà chưa cọc (hệ thống tự). Không tính hoa hồng                                                                           Khóa

  Cancelled      Khách hủy sau khi đã cọc, mất cọc (xử lý ngoài hệ thống). Không tính hoa hồng                                                               Khóa
  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Luồng chuyển trạng thái:

  -------------------------------------------------------------------------------------------------------------------------
  Từ             Sự kiện                                                                 Sang
  -------------- ----------------------------------------------------------------------- ----------------------------------
  Draft          Nhà cung cấp bấm \"Gửi đơn cho khách hàng\"                             Pending

  Pending        Khách bấm \"Yêu cầu chỉnh sửa\"                                         NeedRevision

  NeedRevision   Nhà cung cấp sửa và gửi lại                                             Pending (đặt lại hạn cọc 1 ngày)

  Pending        VNPay báo cọc thành công                                                Deposited

  Pending        Quá DepositDueDate chưa cọc                                             Expired

  Deposited      Nhà cung cấp tích hoàn thành, hoặc tự động sau 7 ngày kể từ EventDate   Completed

  Deposited      Khách hủy                                                               Cancelled
  -------------------------------------------------------------------------------------------------------------------------

Sửa đơn và lịch sử (OrderRevisions):

-   Trước cọc: khách \"Yêu cầu chỉnh sửa\" → tạo dòng OrderRevisions (BeforeDeposit, Requested, ghi RequestNote và các nội dung muốn đổi vào OrderRevisionChanges, OldTotalAmount); đơn thành NeedRevision. Nhà cung cấp sửa và gửi lại → dòng thành Applied (ghi NewTotalAmount, AppliedDate), đơn về Pending, đặt lại hạn cọc, hệ thống tính lại TotalAmount và DepositAmount. Nhà cung cấp tự sửa vì nhập sai: tạo luôn dòng Applied, để trống phần yêu cầu của khách.

-   Sau cọc: đơn vẫn ở Deposited (yêu cầu của khách ghi OrderRevisions loại AfterDeposit, trạng thái Requested). Tiền còn phải trả = TotalAmount mới − DepositAmount đã cọc (ví dụ đơn 10 triệu, cọc 1 triệu, sửa lên 12 triệu thì còn 11 triệu).

-   Một đơn, một OrderCode dù sửa bao nhiêu lần. Đơn Expired hoặc Cancelled mà muốn tiếp tục thì nhà cung cấp tạo đơn mới (mã mới).

Tính tiền (backend tính, không tin dữ liệu từ giao diện):

-   OrderItems.Amount = Quantity × UnitPrice; Orders.TotalAmount = SUM(Amount).

-   Orders.DepositAmount = TotalAmount × DepositPercent / 100, làm tròn đến 100.000đ (theo ghi chú trên form tạo đơn).

-   Nhà cung cấp chỉ nhập: hạng mục, DepositPercent, EventDate, Note. Các số tiền khác chỉ hiển thị.

9.6. Thanh toán đặt cọc (VNPay)

-   Chỉ có một khoản thanh toán cho mỗi đơn: tiền cọc.

-   Bấm thanh toán → backend gửi lượt thanh toán sang VNPay, mã tham chiếu dạng {PaymentId}-{thời điểm}. Chưa ghi gì vào CSDL. Lượt hết hạn hoặc bị hủy thì coi như chưa thanh toán (dòng Payments vẫn Unpaid), khách bấm thử lại. Không lưu log lượt thất bại.

-   Khi VNPay báo thành công: kiểm tra chữ ký, kiểm tra số tiền khớp Orders.DepositAmount (VNPay gửi số tiền nhân 100), kiểm tra Payments.Status còn Unpaid (VNPay có thể gọi lại nhiều lần: nếu đã Paid thì bỏ qua), rồi thực hiện trong một giao dịch CSDL:

    1.  Payments → Paid, ghi PaidDate, TransactionCode.

    2.  Orders → Deposited.

    3.  Thêm nhà cung cấp vào PlanVendors nếu chưa có (nếu kế hoạch đang có nhà cung cấp \"Dự kiến\" cùng loại thì thay bằng nhà cung cấp vừa cọc).

    4.  Tạo Invoices loại DepositReceipt và gửi tin nhắn loại DepositReceipt vào chat.

    5.  Timeline: việc khung \"chốt\" của loại dịch vụ đó chuyển Done, rồi sinh các việc chi tiết (mục 9.9).

    6.  Tạo thông báo cho nhà cung cấp và khách.

-   Đơn quá DepositDueDate: không cho thanh toán (khóa nút), nhà cung cấp phải gửi lại để có hạn mới.

-   Lịch thanh toán 2 đợt cố định (hiển thị trên form tạo đơn và thẻ đơn, không lưu thành bảng, suy ra từ Orders và Payments). Đây là lịch yêu cầu thanh toán, không phải tiền đã thu:

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Đợt   Tên                       Tỷ lệ             Số tiền                       Hạn                                                   Phương thức                                                Trạng thái
  ----- ------------------------- ----------------- ----------------------------- ----------------------------------------------------- ---------------------------------------------------------- --------------------------------------------
  1     Đặt cọc                   DepositPercent    DepositAmount                 DepositDueDate (1 ngày sau khi gửi đơn)               VNPay (trực tuyến)                                         Payments.Status

  2     Thanh toán phần còn lại   Tính từ số tiền   TotalAmount − DepositAmount   EventDate; cho phép trả muộn đến EventDate + 7 ngày   Tiền mặt, trả trực tiếp cho nhà cung cấp, ngoài hệ thống   Không lưu: coi là đã thu khi đơn Completed
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Đợt 2 không có dòng dữ liệu. Khoảng \"trả muộn 7 ngày\" chính là khoảng chờ trước khi hệ thống tự hoàn thành đơn (mục 9.12). Sửa đơn sau cọc thì số tiền đợt 2 tự đổi theo TotalAmount mới. Form chỉ cho xem, không có nút thêm đợt.

9.7. Hóa đơn

-   Giấy xác nhận cọc (DepositReceipt): tự động khi cọc thành công, gửi vào chat.

-   Hóa đơn cuối (FinalInvoice): tùy chọn, nhà cung cấp xuất khi khách yêu cầu (số tiền còn lại trả bằng tiền mặt, ngoài hệ thống). Không bắt buộc.

-   Đây không phải hóa đơn điện tử theo quy định thuế (hạn chế đã ghi nhận). Hóa đơn đọc thông tin từ đơn và hồ sơ, không lưu bản chụp riêng (nếu nhà cung cấp đổi tên hay hồ sơ thì hóa đơn in lại sẽ khác, chấp nhận được).

9.8. Hoa hồng

-   Hoa hồng chỉ phát sinh khi đơn Completed: tạo Commissions (OrderAmount = TotalAmount cuối cùng; Rate = CommissionRate của loại dịch vụ của nhà cung cấp tại lúc đó, chụp lại; Amount = OrderAmount × Rate / 100), gắn vào CommissionStatements của (nhà cung cấp, tháng của CompletedDate); tạo bảng kê nếu chưa có; cộng dồn TotalOrders, TotalAmount.

-   PeriodMonth là ngày đầu tháng; DueDate là ngày 25 của tháng sau.

-   Nhà cung cấp nộp một lần cho cả bảng kê (qua VNPay): thành công thì bảng kê Paid, ghi PaidDate, TransactionCode. Chống ghi trùng như mục 9.6.

-   Không có phạt, cảnh cáo đếm lần, khóa tài khoản trong hệ thống. Chỉ có thông báo nhắc: CommissionDueSoon (trước hạn, ví dụ ngày 22), CommissionOverdue (quá hạn). \"Quá hạn\" tính khi truy vấn.

9.9. Timeline (sinh và hiển thị)

-   Khi khách điền hoặc sửa thông tin đám cưới và tích các loại dịch vụ (WeddingCategories): backend sinh việc từ danh mục mẫu trong code. Mỗi mẫu có: TaskCode, tên, loại dịch vụ, thời điểm sinh (OnCreate hoặc AfterDeposit), số ngày trước ngày cưới, cờ needVendorContact (có cần liên hệ nhà cung cấp), cờ isConfirmStep (việc \"chốt\").

-   ScheduledDate = WeddingDate − số ngày của mẫu; nếu đã qua thì đặt bằng hôm nay hoặc ngày mai. Việc sinh lúc tạo là Frame; sinh sau cọc là Detail.

-   Chống sinh trùng: UNIQUE (WeddingId, TaskCode).

-   Cờ needVendorContact KHÔNG lưu trong CSDL, tra từ danh mục mẫu qua TaskCode: việc cần liên hệ (ví dụ \"Khảo sát trung tâm\") hiện nút Nhắn tin (mở hội thoại với nhà cung cấp cùng loại trong kế hoạch) hoặc Chọn nhà cung cấp (nếu chưa có); việc không cần liên hệ (ví dụ \"Nghĩ bố cục bàn\") không có nút. Việc khách tự thêm có TaskCode rỗng, không có nút.

-   Khách tự sửa ScheduledDate sau khi hẹn với nhà cung cấp qua chat; backend kiểm tra (chỉ khi Todo, ngày không ở quá khứ, không sau ngày cưới, đúng đám cưới của khách), rồi gửi một tin nhắn hệ thống vào hội thoại và thông báo TaskRescheduled cho nhà cung cấp.

-   Khi đơn Cancelled: xóa các việc Detail của (đám cưới, loại dịch vụ đó), trả việc \"chốt\" về Todo.

-   Danh mục mẫu cụ thể chưa được người dùng cung cấp (mục 15).

9.10. Duyệt của admin và quản lý

-   Admin duyệt hồ sơ và gói (mục 9.2, 9.3). Một admin duy nhất nên không lưu người duyệt.

-   \"Xóa người dùng\", \"xóa dịch vụ\" của admin thực hiện bằng khóa (Locked) hoặc ẩn (Hidden), không xóa cứng.

-   Trang quản lý đơn hàng và giao dịch hoa hồng của admin là truy vấn trên Orders, Payments, Commissions, CommissionStatements.

9.11. Gợi ý, tìm kiếm, so sánh

-   Gợi ý nhà cung cấp (nút \"Gợi ý\" trong timeline): truy vấn lọc từ Weddings (ngân sách, số khách, thành phố, phong cách) trên VendorProfiles và ServicePackages, không lưu kết quả. Không có bảng gợi ý.

-   Tìm kiếm có lưu lịch sử vào SearchHistories (chỉ lưu từ khóa).

9.12. Các job chạy hằng ngày (backend)

1.  Hết hạn đơn: Orders đang Pending có DepositDueDate đã qua → Expired; thông báo OrderExpired.

2.  Tự hoàn thành: Orders đang Deposited mà EventDate + 7 ngày đã qua → Completed, ghi CompletedDate, tạo hoa hồng (mục 9.8); thông báo OrderCompleted.

3.  Nhắc việc: việc Todo sắp đến ScheduledDate → thông báo TaskUpcoming.

4.  Nhắc hoa hồng: bảng kê Unpaid sắp đến DueDate → CommissionDueSoon; đã quá DueDate → CommissionOverdue. Mọi thông báo do job tạo phải chống gửi trùng (kiểm tra đã có thông báo cùng UserId, Type, ReferenceId trong kỳ).

9.13. Thông báo (Notifications.Type, gợi ý)

TaskUpcoming, TaskRescheduled, OrderSent, OrderRevisionRequested, OrderDeposited, OrderExpired, OrderCancelled, OrderCompleted, VendorSubmitted, VendorApproved, VendorNeedRevision, PackageSubmitted, PackageApproved, PackageNeedRevision, NewConsultationRequest, CommissionDueSoon, CommissionOverdue, CommissionPaid. Bấm vào thông báo: frontend đọc ReferenceType và ReferenceId để mở đúng trang. Tin nhắn mới không tạo thông báo (đếm tin chưa đọc từ Messages).

10\. Cột dẫn xuất được lưu sẵn có chủ đích (phi chuẩn hóa có kiểm soát)

Báo cáo của người dùng khẳng định các bảng đạt 3NF, trừ các thuộc tính dẫn xuất sau, được lưu sẵn để chụp lại giá trị tại thời điểm giao dịch và tăng tốc truy vấn; cập nhật đồng bộ trong cùng giao dịch với dữ liệu gốc:

Orders.TotalAmount, Orders.DepositAmount, OrderItems.Amount, Commissions.Amount, CommissionStatements.TotalOrders, CommissionStatements.TotalAmount, CommissionStatements.DueDate, Conversations.CategoryId.

Commissions.OrderAmount và Commissions.Rate là bản chụp tại thời điểm tính (không phải vi phạm).

11\. Dữ liệu mẫu bắt buộc: ServiceCategories

7 loại dịch vụ (tỷ lệ hoa hồng người dùng tạm chấp nhận, đổi được sau và chỉ ảnh hưởng hoa hồng tạo sau đó):

  --------------------------------------------------------------------------------------------------------
  Name                        Description                                                 CommissionRate
  --------------------------- ----------------------------------------------------------- ----------------
  Trung tâm tổ chức sự kiện   Sảnh tiệc, thực đơn, cỗ cưới (gộp từ Nhà hàng và Cỗ cưới)   5.00

  Decor                       Trang trí tiệc cưới                                         7.00

  Hoa cưới                    Hoa cầm tay, hoa trang trí                                  8.00

  Trang phục                  Váy cưới, vest                                              8.00

  Makeup                      Trang điểm, làm tóc                                         10.00

  Chụp ảnh                    Ảnh cưới                                                    8.00

  Quay phóng sự               Quay phim phóng sự cưới                                     8.00
  --------------------------------------------------------------------------------------------------------

(Lưu ý: tài liệu gốc của người dùng chỉ liệt kê 6 loại do sót \"Quay phóng sự\". Dùng đủ 7 loại.)

Dữ liệu mẫu ví dụ minh họa cho mẫu timeline (chưa phải danh sách thật), loại \"Trung tâm tổ chức sự kiện\": VENUE_TASTING (thử món, cần liên hệ), VENUE_SURVEY (khảo sát, cần liên hệ), VENUE_CONFIRM (chốt trung tâm, là việc chốt), VENUE_MENU_ADJUST (điều chỉnh khẩu vị, sau cọc, cần liên hệ), VENUE_TABLE_LAYOUT (nghĩ bố cục bàn, sau cọc, không cần liên hệ), VENUE_FINAL_GUEST (chốt số khách lần cuối, sau cọc, cần liên hệ). Các mẫu này nằm trong code backend, không tạo bảng.

12\. Supabase Storage

  ------------------------------------------------------------------------------------------------------------------
  Bucket             Loại        Nội dung          Quy ước đường dẫn
  ------------------ ----------- ----------------- -----------------------------------------------------------------
  package-albums     Công khai   Ảnh gói dịch vụ   packages/{PackageId}/{NN}.webp (NN là số thứ tự; 01 là ảnh bìa)

  vendor-documents   Riêng tư    Giấy tờ pháp lý   vendors/{VendorId}/{loại}-{NN}.jpg
  ------------------------------------------------------------------------------------------------------------------

-   Cột Url lưu đường dẫn tương đối trong bucket (không lưu URL đầy đủ). Giấy tờ riêng tư truy cập qua signed URL có hạn.

-   Tên file dùng chuỗi ngẫu nhiên hoặc số thứ tự, không dấu tiếng Việt, không khoảng trắng.

-   Gói Supabase miễn phí: 1 GB lưu trữ, tối đa 50 MB mỗi file, không có biến đổi ảnh. Nén ảnh (cạnh dài khoảng 1.600 px, WebP, 300 đến 500 KB) trước khi tải. Backup của Supabase không gồm file Storage: giữ thư mục ảnh gốc làm bản dự phòng.

-   Mọi thao tác tải lên, xóa, tạo signed URL đi qua backend (khóa service_role), không từ trình duyệt.

13\. Bảo mật và RLS

-   Bảng thuộc schema public của Supabase có thể bị truy cập qua API công khai bằng khóa anon. Vì ứng dụng không dùng Supabase Auth, hãy bật Row Level Security trên cả 27 bảng và KHÔNG tạo chính sách cho anon/authenticated. Backend dùng khóa service_role (bỏ qua RLS) nên vẫn hoạt động bình thường.

-   Không đưa khóa service_role xuống trình duyệt hoặc lên kho mã công khai.

-   Mật khẩu chỉ lưu PasswordHash. Không lưu mật khẩu rõ.

14\. Những thứ ĐÃ BỊ LOẠI BỎ có chủ đích (đừng thêm lại)

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Loại bỏ                                                                               Lý do
  ------------------------------------------------------------------------------------- ----------------------------------------------------------------------------------------------------------------
  Bảng Reviews, mọi điểm sao và số đánh giá                                             Người dùng bỏ chức năng đánh giá

  Bảng Services (lớp dịch vụ)                                                           Trang nhà cung cấp chính là hồ sơ; gói nằm trực tiếp dưới hồ sơ

  Bảng PlanItems, WeddingPlans                                                          Thay bằng PlanVendors (nhà cung cấp trong kế hoạch)

  Bảng UserRecommendations                                                              Gợi ý là truy vấn lúc chạy

  Bảng CommissionPayments                                                               Nộp hoa hồng một lần, đã gộp vào CommissionStatements

  Bảng VendorVerificationItems, trạng thái Rejected, AttemptCount, giới hạn 3 lần nộp   Hồ sơ chỉ có \"yêu cầu chỉnh sửa\", không từ chối hẳn

  Bảng ProviderCategories                                                               Mỗi nhà cung cấp một loại dịch vụ

  Bảng TimelineSubTasks, cột Phase                                                      Việc khung và việc chi tiết cùng cấp, gộp một bảng TimelineTasks

  Bảng FavoritePackages                                                                 Yêu thích nhà cung cấp (FavoriteVendors)

  Cột Orders.CreatedBy, Orders.PackageId, Orders.UnitPrice, Orders.Quantity             Người tạo đơn suy ra từ VendorId; đơn không nối với gói; đơn giá và số lượng nằm ở OrderItems (xem 5.18, 5.19)

  Cột Payments.Amount, Payments.Type, Payments.Status = Failed/Pending                  Chỉ có cọc; lượt thất bại không lưu

  Cột ReviewedBy, HandledBy, CreatedBy ở các bảng duyệt và tư vấn                       Chỉ có một admin

  Cột Budget ở TimelineTasks, Source, Messages.IsFromVendor, Conversations.Tag/IsVip    Đã loại hoặc thay thế

  Cờ needVendorContact lưu trong CSDL                                                   Tra từ danh mục mẫu trong code qua TaskCode

  Trạng thái \"Quá hạn\" cho bảng kê, WarningCount, ReminderCount, LockReason           Luật phạt và khóa ngoài hệ thống; quá hạn tính khi truy vấn
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

15\. Điểm còn mở và giả định cần hỏi người dùng

1.  Công nghệ backend và cách triển khai: dùng migration của ORM (EF Core\...) hay chạy script SQL thuần? Đặt tên PascalCase có nháy kép hay snake_case?

2.  OrderRevisionChanges.ChangeType: chưa có danh sách giá trị đầy đủ (hiện có ví dụ Quantity, EventDate).

3.  Danh mục mẫu timeline (mã, tên, thời điểm sinh, số ngày trước cưới, cờ liên hệ, việc chốt) cho cả 7 loại dịch vụ: chưa có.

4.  Tỷ lệ hoa hồng 7 loại là tạm chấp nhận (đặc biệt \"Trung tâm tổ chức sự kiện\" 5%).

5.  Quy tắc làm tròn tiền cọc đến 100.000đ: chưa nói rõ làm tròn lên, xuống hay gần nhất.

6.  Ép đổi mật khẩu lần đầu: chưa có cột (ví dụ MustChangePassword); người dùng chưa quyết định thêm. Hiện mật khẩu do hệ thống sinh ngẫu nhiên và gửi qua email, người dùng tự đổi. Đăng nhập bằng email hay bằng tên đăng nhập cũng chưa chốt (cả hai cột đều UNIQUE nên hỗ trợ được cả hai).

7.  Mốc 7 ngày tự hoàn thành tính từ EventDate (người dùng đồng ý). Hạn cọc 1 ngày; hạn hoa hồng ngày 25 tháng sau; mọi tính ngày dùng múi giờ Việt Nam.

8.  Conversations.VendorId trỏ về Users là quyết định chủ đích; nếu người dùng đổi ý có thể đổi tên thành VendorUserId hoặc trỏ về VendorProfiles.

Đã chốt (không cần hỏi lại): VendorProfiles không có tọa độ và mã địa điểm, chỉ có địa chỉ tách (Address, Ward, City) cùng GoogleMapsUrl tùy chọn; VendorProfiles.WorkingHours là một cột chuỗi mô tả (không tách giờ mở và giờ đóng); SearchHistories chỉ có Keyword (đã bỏ Filters và City).

16\. Danh sách kiểm thử gợi ý sau khi tạo CSDL

1.  Tạo được đủ 27 bảng, không lỗi thứ tự khóa ngoại.

2.  Chèn 7 dòng ServiceCategories; chèn thử một cặp đôi (Users + Weddings + WeddingCategories) và một nhà cung cấp (Users + VendorProfiles + VendorDocuments + VendorVerifications + ServicePackages + PackageAlbums + PackageTags).

3.  Chạy luồng đơn: tạo Orders (Draft → Pending) + OrderItems + Payments (Unpaid); cập nhật thành công: Payments Paid + Orders Deposited + Invoices DepositReceipt; sau đó Orders Completed + Commissions + CommissionStatements (kiểm tra cộng dồn).

4.  Thử vi phạm ràng buộc, kỳ vọng bị chặn: hai ảnh bìa cho một gói; Payments Paid thiếu TransactionCode; xác minh NeedRevision thiếu AdminNote; hai bảng kê cùng (VendorId, PeriodMonth); hai hội thoại cùng cặp; DepositPercent = 100; OrderItems.Amount sai; hai dòng Invoices cùng (OrderId, Type); hai Payments cho một đơn; Orders.OrderCode trùng.

5.  Xác nhận RLS đã bật trên mọi bảng và khóa anon không đọc được dữ liệu.

6.  Truy vấn mẫu: khoảng giá nhà cung cấp (MIN/MAX Price của gói Approved); đơn Pending quá hạn; đơn Deposited đủ 7 ngày sau EventDate; bảng kê Unpaid quá hạn.
