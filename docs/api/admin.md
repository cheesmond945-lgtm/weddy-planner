# API: admin (cổng quản trị)

> **Đã triển khai** trên CSDL Supabase thật (`backend/src/modules/admin`); FE gọi qua `frontend/src/api/admin.ts` (kiểu ở `frontend/src/types/admin.ts`). Muốn dùng dữ liệu giả (`frontend/src/mocks/admin.ts`) thì bỏ `admin` khỏi `VITE_REAL_APIS`.
> Quy ước chung: [README.md](README.md).
> Role cho mọi endpoint: **ADMIN**. Admin **không tạo hồ sơ hay gói**: chỉ duyệt, yêu cầu bổ sung / chỉnh sửa, quản lý tài khoản và ghi nhận thanh toán hoa hồng.

Ánh xạ sang CSDL hiện có (gợi ý cho BE): yêu cầu tư vấn = `consultation_requests`; duyệt hồ sơ = `vendor_profiles.status` + `vendor_verifications`; duyệt gói = `service_packages.status` + `package_verifications`; người dùng = `users`; bảng kê = `commission_statements` + `commissions` (xem [commissions.md](commissions.md)); thông báo cho NCC/khách ghi vào `notifications`.

## Tổng quan

### GET /admin/counts
Số mục cần xử lý (hiện cạnh menu, chuông thông báo). FE tải lại mỗi 30 giây.

Response 200: `{ "data": { "consultations": 3, "vendors": 4, "packages": 5 } }`
`consultations`: yêu cầu tư vấn chưa liên hệ; `vendors`: hồ sơ NCC `PENDING`; `packages`: gói `PENDING`.

### GET /admin/dashboard
Response 200: `{ "data": AdminDashboard }`

```json
{
  "commissionThisMonth": { "value": 18450000, "changePct": 12.5 },
  "gmv": { "value": 184500000, "changePct": 8.2 },
  "newUsers": { "value": 128, "changePct": 14.2 },
  "activeVendors": { "value": 56, "changePct": -2.4 },
  "pendingVendors": 7, "pendingPackages": 12, "pendingConsultations": 5,
  "waitingVendors": [ { "id": "vp-1", "name": "Luxury Wedding Decor", "subtitle": "Trang trí", "category": { "id": "cat-2", "slug": "decor", "name": "Trang trí" }, "city": "Hà Nội", "submittedAt": "2026-10-20T01:39:00.000Z" } ],
  "waitingPackages": [ "WaitingItem (subtitle = tên NCC)" ],
  "commissionByMonth": [ { "period": "2026-05", "amount": 42000000 } ],
  "ordersByCategory": [ { "category": { "id": "cat-1", "slug": "nha-hang", "name": "Nhà hàng" }, "count": 25, "percent": 45 } ]
}
```

| Trường | Ghi chú |
|---|---|
| `*.changePct` | So với tháng trước, một chữ số thập phân; 0 thì FE không hiện mũi tên |
| `commissionThisMonth`, `gmv` | Tính từ đơn hoàn thành trong tháng (hoa hồng = tổng `commissions.amount`, GMV = tổng giá trị đơn) |
| `waitingVendors`, `waitingPackages` | Tối đa 5, **chờ lâu nhất trước** (`submittedAt` tăng dần) |
| `commissionByMonth` | 6 tháng gần nhất, cũ trước, tháng không có số liệu vẫn có dòng với `amount = 0` |
| `ordersByCategory` | Đơn hoàn thành 6 tháng gần nhất theo lĩnh vực, `count` giảm dần; `percent` làm tròn |

## Yêu cầu tư vấn

`ConsultationRequest`: `{ id, brandName, category, contactName, phone, email, createdAt, isContacted, contactedAt, qualification, note, vendorAccountCreated }`.
`qualification`: `UNRATED` (Chưa đánh giá), `QUALIFIED` (Đạt tiêu chuẩn), `UNQUALIFIED` (Chưa đạt). `note`: ghi chú nội bộ, NCC không thấy.

### GET /admin/consultation-requests
| Query | Ghi chú |
|---|---|
| `q` | Tìm trong thương hiệu, người liên hệ, SĐT, email (không phân biệt hoa thường, dấu) |
| `categorySlug`, `contacted` (`YES`/`NO`), `qualification` | Lọc |

Mới nhất trước. Không phân trang (bản nháp). Response 200: `{ "data": { "stats": { "total", "uncontacted", "contacted" }, "items": [ConsultationRequest] } }`. `stats` tính trên toàn bộ, không theo bộ lọc.

### PATCH /admin/consultation-requests/:id
Body (gửi một hoặc nhiều trường): `{ "isContacted"?: boolean, "qualification"?: Qualification, "note"?: string | null }`. Đặt `isContacted = true` thì ghi `contactedAt`. Response 200: `{ "data": ConsultationRequest }`

Lỗi: 404 `CONSULTATION_NOT_FOUND`

Tạo tài khoản NCC từ yêu cầu: dùng `POST /admin/users` với `role = VENDOR`, `categoryId` và `consultationId`: BE tạo tài khoản và hồ sơ nhà cung cấp trạng thái nháp (tên doanh nghiệp, người đại diện lấy từ yêu cầu, lĩnh vực do Admin gán, xem [vendors.md](vendors.md)), đặt `isContacted = true` và ghi chú "Đã tạo tài khoản ...". `vendorAccountCreated` suy ra từ việc có tài khoản Vendor trùng email của yêu cầu.

## Người dùng

`AdminUser`: `{ id, code, username, name, email, phone, role, status, createdAt, lastLoginAt }`. `code`: mã hiển thị `ND-00000015`. `status`: `ACTIVE` | `LOCKED`.

### GET /admin/users
| Query | Ghi chú |
|---|---|
| `q` | Tìm trong tên, tên đăng nhập, email, SĐT, mã |
| `role`, `status` | Lọc |
| `page`, `pageSize` | Mặc định 1, 10 |

Mới tạo trước. `code` (`ND-00000015`) tính theo thứ tự tạo tài khoản. Response 200: `{ "data": { "stats": { "total", "couples", "vendors", "locked" }, "items": [AdminUser], "total": 42 } }` (`total` = số dòng khớp bộ lọc để phân trang; `stats` toàn hệ thống).

### POST /admin/users
Body `SaveUserBody`: `{ username, email, phone, password, role, categoryId?, consultationId? }`. Mật khẩu tối thiểu 6 ký tự; `phone` `^0\d{9}$`; `role = VENDOR` bắt buộc `categoryId`. Response 201: `{ "data": AdminUser }`

Lỗi: 400 `VALIDATION_ERROR`, 409 `USERNAME_ALREADY_EXISTS`, 409 `EMAIL_ALREADY_EXISTS`, 409 `PHONE_ALREADY_EXISTS`

### PATCH /admin/users/:id
Cùng body, `password` để trống nghĩa là giữ nguyên. **Không đổi được vai trò** của tài khoản đã tạo (400 `VALIDATION_ERROR`, `details.role`) và không đổi `categoryId` của NCC. Response 200: `{ "data": AdminUser }`. Lỗi như trên, thêm 404 `USER_NOT_FOUND`.

### POST /admin/users/:id/lock, POST /admin/users/:id/unlock
Khóa / mở khóa. Tài khoản khóa không đăng nhập được (`ACCOUNT_DISABLED`), đơn đang xử lý giữ nguyên, người dùng nhận email thông báo. Response 200: `{ "data": AdminUser }`.

Lỗi: 404 `USER_NOT_FOUND`, 409 `CANNOT_LOCK_ADMIN`

### DELETE /admin/users/:id
Xóa vĩnh viễn. Response 200: `{ "data": null }`. Lỗi: 404 `USER_NOT_FOUND`, 409 `CANNOT_DELETE_ADMIN`, 409 `USER_HAS_DATA` (CSDL còn đơn, hội thoại… tham chiếu; khi đó nên khóa thay vì xóa).

## Duyệt hồ sơ nhà cung cấp

`AdminVendor`: như `VendorProfile` ([vendors.md](vendors.md)) cộng `owner: { name, email, phone }` và `reviewKind`: `INITIAL` (hồ sơ `Pending`: **Duyệt lần đầu**), `UPDATE` (hồ sơ `Approved` có một lần gửi cập nhật chưa kiểm: **Kiểm tra cập nhật**), `null` khi không chờ. Hồ sơ `UPDATE` hiện `status = PENDING` trong danh sách Chờ duyệt; `status` cùng enum `VendorProfileStatus`; `reviewNote` là nội dung yêu cầu bổ sung gần nhất; `documents`, `photos` là tệp NCC đã tải (`url` là link xem tạm thời).

### GET /admin/vendors
Query: `q` (tên doanh nghiệp, người đại diện, mã số thuế, email, tỉnh, phường/xã), `status`, `categorySlug`, `sort` (`recent` nộp gần đây nhất trước, mặc định; `oldest` nộp trước nhất, để duyệt theo thứ tự nộp), `days` (chỉ lấy hồ sơ nộp trong N ngày gần đây: 1, 3, 7, 30, 90), `page` (từ 1), `pageSize` (mặc định 10). Bỏ qua hồ sơ chưa gửi (`NOT_SUBMITTED`). Response 200: `{ "data": { "items": [AdminVendor], "total": 42, "counts": { "ALL", "PENDING", "NEEDS_REVISION", "VERIFIED" } } }`; `total` là số hồ sơ khớp mọi bộ lọc (để phân trang), `counts` tính theo từ khóa và lĩnh vực nhưng không theo `status` (số trên các nhãn trạng thái).

### GET /admin/vendors/:id
Chi tiết một hồ sơ **kèm tệp**: `documents` (giấy tờ, bucket riêng tư) và `photos` (ảnh cơ sở), `url` là link ký có hiệu lực 1 giờ, `size` lấy từ Storage. Danh sách `GET /admin/vendors` **không kèm tệp** (`documents`, `photos` rỗng) để nhẹ; FE tải chi tiết khi mở hồ sơ. Lỗi: 404 `VENDOR_NOT_FOUND`.

### POST /admin/vendors/:id/approve
`PENDING` → `VERIFIED`, `verifiedCategory = category`, `reviewNote = null`; thông báo `VendorApproved` cho NCC. Với `reviewKind = UPDATE` (cập nhật hợp lệ): dòng xác minh `Approved`, hồ sơ giữ `Approved`. Response 200: `{ "data": AdminVendor }`

### POST /admin/vendors/:id/request-revision
Body `{ "note": "Giấy PCCC đã hết hạn, vui lòng tải bản còn hiệu lực." }` (bắt buộc, ≤ 1000 ký tự). `PENDING` → `NEEDS_REVISION`, lưu `reviewNote`; thông báo `VendorNeedRevision`. Với `reviewKind = UPDATE` (cập nhật không hợp lệ): dòng xác minh `NeedRevision` kèm lý do, hồ sơ **vẫn `Approved`** (vẫn hiển thị); trong danh sách Admin hồ sơ này hiện `status = NEEDS_REVISION` (suy ra từ dòng xác minh gần nhất) cho tới khi NCC gửi lại. Vi phạm nghiêm trọng: khóa tài khoản ở `POST /admin/users/:id/lock`. Response 200: `{ "data": AdminVendor }`

Lỗi chung: 404 `VENDOR_NOT_FOUND`, 409 `VENDOR_PROFILE_NOT_PENDING` (chỉ xử lý hồ sơ đang chờ, kể cả bản cập nhật chưa kiểm), 400 `VALIDATION_ERROR` (thiếu `note`)

## Duyệt gói dịch vụ

`AdminPackage`: `{ id, name, description, price, capacity, tags, photos, category, vendor: { id, name, city }, status, reviewNote, submittedAt }`. `photos`: danh sách URL ảnh, ảnh đầu là ảnh bìa. `status` (`AdminPackageStatus`): `PENDING` (Chờ duyệt), `NEEDS_REVISION` (Cần chỉnh sửa, NCC sửa rồi gửi lại như bản nháp), `PUBLISHED`, `HIDDEN`. Bản nháp của NCC (`DRAFT`) Admin không thấy.

### GET /admin/packages
Query: `q` (tên gói, tên NCC), `status`, `categorySlug`, `days` (chỉ lấy gói nộp trong N ngày gần đây: 1, 3, 7, 30, 90), `page` (từ 1), `pageSize` (mặc định 10). Gói nộp gần đây nhất trước. Response 200: `{ "data": { "items": [AdminPackage], "total", "counts": { "ALL", "PENDING", "NEEDS_REVISION", "PUBLISHED", "HIDDEN" } } }` (`counts` tính theo từ khóa, lĩnh vực và thời gian nộp, không theo `status`).

### GET /admin/packages/:id
Chi tiết một gói (cùng dạng `AdminPackage`). Lỗi: 404 `PACKAGE_NOT_FOUND`.

### POST /admin/packages/:id/approve
`PENDING` → `PUBLISHED` (hiển thị công khai); thông báo `PackageApproved`. Response 200: `{ "data": AdminPackage }`

### POST /admin/packages/:id/request-revision
Body `{ "note": "..." }` bắt buộc. `PENDING` → `NEEDS_REVISION`, lưu `reviewNote`; thông báo `PackageNeedRevision`. Response 200: `{ "data": AdminPackage }`

Lỗi: 404 `PACKAGE_NOT_FOUND`, 409 `PACKAGE_NOT_PENDING`, 400 `VALIDATION_ERROR`

## Thanh toán (bảng kê hoa hồng)

`AdminStatement`: `{ id, code, vendor: { id, name }, category, period, orderCount, revenue, commissionAmount, dueDate, status, isOverdue, paidAt, transactionCode }`. `status`: `UNPAID` | `PAID`. `isOverdue`: chưa trả và quá `dueDate` (giờ VN). Cách tính kỳ, tỷ lệ, hạn: [commissions.md](commissions.md).

### GET /admin/commissions
| Query | Ghi chú |
|---|---|
| `q` | Tìm trong mã bảng kê, tên NCC |
| `status`, `year` (YYYY), `month` (1-12), `period` (`YYYY-MM`) | Lọc; `year` và `month` dùng riêng hoặc cùng nhau. Response có thêm `years` (các năm có bảng kê) |

Chi tiết một bảng kê: `GET /admin/commissions/:id` trả `AdminStatement` kèm `closingDate`, `createdAt`, `averageRate`, `vendorInfo` (tên doanh nghiệp, người đại diện, mã số thuế, địa chỉ, tài khoản, email, điện thoại) và `lines[]` (mã đơn, khách, ngày sự kiện, ngày hoàn thành, giá trị đơn, tỷ lệ, tiền hoa hồng, `originPeriod` khi đơn được tính dồn). Lỗi: 404 `COMMISSION_STATEMENT_NOT_FOUND`.
| `page`, `pageSize` | Mặc định 1, 10 |

Kỳ mới nhất trước, cùng kỳ theo tên NCC. Response 200: `{ "data": { "stats": { "total", "paid", "unpaid" }, "items": [AdminStatement], "total": 36, "periods": ["2026-10", "2026-09"] } }`. `stats` là tổng `commissionAmount` **của các bảng kê khớp bộ lọc** (mọi trang); `periods` là các kỳ có bảng kê (cho ô chọn tháng, mới nhất trước).

FE nút **Xuất dữ liệu** gọi endpoint này với `pageSize = 5000` rồi tạo tệp CSV phía trình duyệt.

Bảng kê chuyển sang `PAID` khi NCC thanh toán qua VietQR và SePay xác nhận đã nhận tiền (xem [payments.md](payments.md)); Admin còn có thể ghi nhận thủ công qua `POST /admin/commissions/:id/record-payment`.

### POST /admin/vendors/:id/hide và /unhide
Role: ADMIN. Chỉ Admin ẩn / hiện lại hồ sơ, NCC không có nút nào.

- `hide`: hồ sơ `Approved` (`VERIFIED`) sang `Hidden` (`HIDDEN`). Gói dịch vụ giữ nguyên trạng thái nhưng ngừng hiển thị với khách (danh mục chỉ lấy NCC `Approved`). Báo NCC (`VendorHidden`). Lỗi 409 `VENDOR_NOT_HIDEABLE` nếu hồ sơ không ở `Approved`.
- `unhide`: `Hidden` về `Approved`, gói hiển thị lại như cũ. Báo NCC (`VendorUnhidden`). Lỗi 409 `VENDOR_NOT_HIDDEN`.
- Khi hồ sơ `Hidden`: NCC vẫn đăng nhập, xử lý đơn đã cọc, hoa hồng; không sửa hồ sơ (409 `VENDOR_PROFILE_HIDDEN`), không ẩn / khôi phục gói (409 `VENDOR_HIDDEN`), không gửi đơn mới; khách không đặt cọc được đơn chưa cọc (409 `VENDOR_HIDDEN`). Cần ràng buộc DB `vendor_profiles_status_check` có `'Hidden'` (xem `backend/prisma/manual/2026-10-vendor-profile-hidden.sql`).

## Cần chốt

1. Xóa người dùng đã có dữ liệu (đơn, hội thoại): cho xóa cứng, hay chỉ cho khóa? FE đang cho xóa, BE trả `USER_HAS_DATA` nếu không xóa được.
2. Phân trang cho `GET /admin/vendors`, `/admin/packages`, `/admin/consultation-requests` khi dữ liệu nhiều (hiện trả hết).
3. Gửi email thông báo khi khóa tài khoản, yêu cầu bổ sung (chưa có `integrations/mail`).
