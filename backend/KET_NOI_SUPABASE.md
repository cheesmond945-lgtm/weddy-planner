# Kết nối backend NestJS + Prisma với Supabase "Weddy"

CSDL đã được nạp xong trên Supabase: 27 bảng, 58 tài khoản, 44 NCC, 205 gói, 1.535 bản ghi ảnh, 39 đơn, 729 thông báo. Mọi truy vấn kiểm tra đều trả 0 lỗi.
Còn thiếu **file ảnh thật** trong Storage (bước 3).

## 1. Chép code vào repo
Giải nén `everly_backend.zip` vào `weddy-planner\backend\`, chép đè các file trùng tên (repo hiện chỉ có file rỗng).

## 2. Tạo `backend\.env`
Chép `.env.example` thành `.env`, rồi điền:
- `DATABASE_URL`
  - Lấy ở Supabase, nút **Connect** (thanh trên cùng) → **Session pooler** (cổng 5432).
  - Thay `[YOUR-PASSWORD]` bằng mật khẩu DB. Nếu quên, đặt lại tại *Project Settings → Database → Reset database password*.
  - Ký tự đặc biệt trong mật khẩu phải mã hóa, ví dụ `@` thành `%40`, `#` thành `%23`.
- `SUPABASE_SECRET_KEY`: key **mới** sau khi bạn rotate. Key cũ đã lộ trong ảnh chụp màn hình.
- `JWT_SECRET`: chuỗi ngẫu nhiên tự đặt.

`.env` đã có trong `.gitignore`, không commit lên GitHub.

## 3. Tải ảnh lên Storage (PowerShell, trong thư mục chứa `upload_storage.py`)
Trước tiên, thay ảnh `Giấy tờ\giấy phép kd.jpg` (có CCCD người thật) bằng một ảnh giấy phép giả.

```powershell
$env:SUPABASE_URL="https://kiomwvtaadqnditkbneo.supabase.co"
$env:SUPABASE_SERVICE_KEY="sb_secret_...key mới..."
python upload_storage.py --root "C:\Users\<bạn>\Documents\ĐATN" --dry-run   # kiểm tra trước, phải báo đủ 1681 file
python upload_storage.py --root "C:\Users\<bạn>\Documents\ĐATN"
```

Kiểm tra bằng cách mở link sau trên trình duyệt, phải thấy ảnh:
https://kiomwvtaadqnditkbneo.supabase.co/storage/v1/object/public/package-albums/trang-tri/v01/p001/01.jpg

## 4. Cài và chạy backend
```powershell
cd weddy-planner\backend
npm install
npx prisma db pull      # đọc 27 bảng từ Supabase vào prisma\schema.prisma
npx prisma generate     # sinh client vào src\generated\prisma
npm run start:dev
```
**Tuyệt đối không chạy** `prisma migrate dev` hoặc `prisma migrate reset`, vì chúng sẽ xóa toàn bộ dữ liệu.

## 5. Thử API
| Mục đích | Lệnh |
|---|---|
| Kiểm tra kết nối | `GET http://localhost:3000/api/health` → counts users 58, packages 205, albums 1535 |
| Danh mục | `GET /api/catalog/categories` |
| Danh sách gói (có ảnh bìa) | `GET /api/catalog/packages?page=1&pageSize=12` |
| Chi tiết gói (toàn bộ ảnh) | `GET /api/catalog/packages/<id>` |
| Đăng nhập | `POST /api/auth/login` body `{"login":"admin","password":"Everly@2026"}` |
| Thông tin tôi | `GET /api/auth/me`, header `Authorization: Bearer <accessToken>` |
| Giấy tờ NCC (link 10 phút) | `GET /api/vendors/<vendorId>/documents` (Admin hoặc chính NCC đó) |

Tất cả tài khoản mẫu dùng chung mật khẩu `Everly@2026`, ví dụ `admin`, `ncc01`, `thao.trinh01`. Danh sách đầy đủ có trong `HUONG_DAN.md`.

## Ghi chú
- Code chưa được build thử, vì máy làm việc không cài được npm.
  - Nếu `db pull` đặt tên quan hệ khác với tên trong `catalog.service.ts` (ví dụ `vendor_profiles`, `package_albums`), TypeScript sẽ báo lỗi đúng chỗ đó. Chỉ cần sửa tên cho khớp.
- Frontend không cần key Supabase: ảnh dùng URL công khai do API trả về, mọi dữ liệu lấy qua API backend.
- Nếu kết nối DB báo lỗi SSL, thêm `?sslmode=no-verify` vào cuối `DATABASE_URL`.
