# Sao lưu và khôi phục dữ liệu (database + ảnh)

Dùng khi cần phòng hờ Supabase hiện tại bị hạn chế, bị tạm dừng hoặc mất kết nối (ví dụ ngày bảo vệ đồ án). Bản sao lưu cho phép dựng lại toàn bộ hệ thống trên một project Supabase **mới** trong khoảng 10 đến 15 phút.

- Script nằm ở [backend/scripts/backup/](../backend/scripts/backup/). Chạy bằng Node có sẵn, **không cần cài thêm gì** (dùng thư viện `pg` và `@supabase/supabase-js` đã có trong backend).
- Sao lưu **chỉ đọc**: không ghi, không xóa, không sửa gì trên Supabase hiện tại.
- Khôi phục **từ chối** chạy lên project đang dùng trong `backend/.env`; chỉ nạp vào project mới, rỗng.

## 1. Bản sao lưu gồm những gì

| Phần | Nội dung | Ghi chú |
|---|---|---|
| Cấu trúc database | 39 bảng, ràng buộc, chỉ mục, trigger, hàm, RLS (schema `public`) | tệp `sql/01-pre.sql`, `sql/02-post.sql` |
| Dữ liệu | Toàn bộ hàng của 39 bảng (khoảng 7.700 hàng, ~19 MB) | `data/<bảng>.ndjson` |
| Ảnh và tệp | Bucket `package-albums` (ảnh gói, ~1.556 tệp), `vendor-documents` (giấy tờ NCC), `chat-files` | `storage/<bucket>/...` |
| Mô tả | số hàng từng bảng, danh sách bucket, cảnh báo | `manifest.json` |

Không sao lưu: bảng của Supabase Auth (app không dùng, đăng nhập là bảng `users` riêng), cấu hình dashboard, khóa API.

> **Bản sao lưu chứa dữ liệu riêng tư** (mật khẩu đã băm, giấy tờ NCC, tin nhắn). Mặc định lưu vào thư mục `backups/` ở gốc repo và đã được thêm vào `.gitignore`. Đừng commit, đừng gửi cho người lạ.

## 2. Chạy sao lưu

Mở terminal trong thư mục `backend`:

```powershell
cd backend
npm run db:backup                 # sao lưu tất cả: database + ảnh
npm run db:backup -- --no-storage # chỉ database (nhẹ, vài MB)
npm run db:backup -- --only-storage   # chỉ ảnh / tệp
npm run db:backup -- --out D:\sao-luu # đổi thư mục đích
```

Kết quả nằm ở `backups/<ngày-giờ>/`. Thời gian ước tính: database khoảng 3 đến 4 phút (do database ở xa); ảnh khoảng vài phút, tùy mạng. Nếu bị ngắt giữa chừng, chạy lại phần ảnh sẽ **bỏ qua tệp đã tải**.

### Lưu ý về lượng egress (băng thông Supabase)

- Sao lưu **database** chỉ tốn khoảng 20 MB.
- Sao lưu **ảnh** phải tải khoảng 1.700 tệp, ước tính 350 đến 400 MB (khoảng 7% hạn mức 5 GB mỗi chu kỳ). Đây là con số ước tính.
- Gợi ý lịch: chạy `--no-storage` bất cứ lúc nào; chạy sao lưu đầy đủ **sau 21/11** (chu kỳ mới, hạn mức mới), tức khoảng 1 ngày trước buổi bảo vệ, hoặc chạy ngay nếu bạn muốn chắc chắn hơn.

## 3. Kiểm tra bản sao lưu có dùng được không (an toàn)

Trước khi tin vào bản sao lưu, chạy thử khôi phục ở chế độ **selftest**. Nó nạp toàn bộ dữ liệu vào một schema tạm trong một giao dịch rồi **ROLLBACK**, nên không để lại gì trên Supabase, mất khoảng 30 giây:

```powershell
npm run db:restore -- ..\backups\<ngày-giờ> --selftest
```

Kết quả đúng sẽ có dòng: `Đối chiếu số hàng: khớp 39 bảng ...` và `THỬ THÀNH CÔNG, đã ROLLBACK`.

## 4. Khôi phục vào project Supabase mới

### Bước 1. Tạo project mới

1. Vào https://supabase.com/dashboard, tạo project mới (nên cùng khu vực với project cũ để độ trễ như cũ). Ghi lại **mật khẩu database** đã đặt.
2. Gói Free chỉ cho 2 project đang hoạt động trong một tổ chức. Nếu hết chỗ, tạm dừng hoặc xóa một project không dùng, **trừ project Weddy hiện tại**.

### Bước 2. Lấy thông tin kết nối của project mới

- Nút **Connect** ở trên cùng, tab **Session pooler** (cổng 5432): chuỗi `postgresql://postgres.<ref>:<mật-khẩu>@<host>:5432/postgres`. Đây là `--db-url`.
- **Project Settings, API Keys**: lấy **secret key** (khóa bí mật) và **Project URL** (`https://<ref>.supabase.co`).
- Chỗ nào có `[YOUR-PASSWORD]`, thay bằng mật khẩu bạn đã đặt. Mật khẩu có ký tự đặc biệt (`@`, `#`, `/`...) cần mã hóa dạng `%40`, `%23`, `%2F`.

### Bước 3. Chạy khôi phục

```powershell
cd backend
npm run db:restore -- ..\backups\<ngày-giờ> --yes `
  --db-url "postgresql://postgres.<ref>:<mật-khẩu>@<host>:5432/postgres" `
  --supabase-url "https://<ref>.supabase.co" `
  --service-key "<secret key của project mới>"
```

Script sẽ lần lượt: tạo bảng, nạp dữ liệu, tạo ràng buộc/chỉ mục/trigger, đối chiếu số hàng, tạo 3 bucket và tải ảnh lên. Tất cả phần database nằm trong **một giao dịch**: nếu có lỗi sẽ rollback, project mới không bị dở dang.

Tùy chọn: `--no-storage` (bỏ ảnh), `--only-storage` (chỉ ảnh).

Ảnh khi tải lên project mới được đặt `Cache-Control` 1 năm, nên trình duyệt sẽ giữ ảnh đã xem (tiết kiệm egress hơn project cũ).

### Bước 4. Trỏ backend sang project mới

Sửa `backend/.env`:

```
DATABASE_URL="<chuỗi Transaction pooler (cổng 6543) của project mới>"
DIRECT_URL="<chuỗi Session pooler (cổng 5432) của project mới>"
SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_SECRET_KEY="<secret key của project mới>"
```

Khởi động lại backend (`npm run start:dev` hoặc restart dịch vụ trên Azure). Frontend **không cần sửa gì**, vì frontend chỉ gọi backend.

Nếu đã deploy trên Azure: vào App Service, Settings, Environment variables, sửa 4 biến trên rồi Restart.

### Bước 5. Kiểm tra

- Mở `http://localhost:3000/api/health` (hoặc địa chỉ backend trên Azure): thấy `"db":"ok"` và có `counts`.
- Đăng nhập bằng một tài khoản đã có (mật khẩu giữ nguyên vì được sao lưu cùng dữ liệu).
- Mở trang dịch vụ, kiểm tra ảnh gói hiển thị; thử một tài khoản NCC xem giấy tờ.

## 5. Xử lý lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `TỪ CHỐI: --db-url trùng project đang dùng` | Bạn đang trỏ vào project cũ. Dùng chuỗi kết nối của project **mới**. |
| `Project đích đã có N bảng` | Project đích không rỗng. Tạo project mới hoặc xóa bảng. Script cố ý không ghi đè. |
| `password authentication failed` | Sai mật khẩu hoặc chưa mã hóa ký tự đặc biệt trong mật khẩu. |
| `Tenant or user not found` | Sai host pooler. Chép lại đúng chuỗi từ nút Connect của project mới. |
| Có tệp ảnh báo THIẾU hoặc LỖI | Chạy lại lệnh khôi phục với `--only-storage`; tệp đã có sẽ được ghi đè an toàn (upsert). |
| Hết hạn mức egress / project bị hạn chế | Đó chính là lúc dùng bản sao lưu này để dựng project mới. |

## 6. Việc nên làm trước ngày bảo vệ (22/11)

1. Chạy `db:backup` (đầy đủ), rồi chạy `--selftest` để chắc bản sao lưu dùng được.
2. Chép thư mục `backups/<ngày-giờ>` sang ổ khác hoặc USB (không chỉ để trên một máy).
3. Thử khôi phục thật một lần vào project nháp, đổi `.env` thử để chắc luồng chạy tốt, rồi đổi lại.
4. Ngay trước giờ demo, mở trang đăng nhập trên bản deploy Azure và xem dữ liệu, ảnh đã hiển thị chưa.
