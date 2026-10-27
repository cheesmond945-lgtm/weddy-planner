# Hướng dẫn chạy dự án với dữ liệu thật (Supabase)

Dữ liệu (27 bảng) và ảnh (1681 file) đã nằm sẵn trên Supabase. Sau khi clone chỉ cần cấu hình `.env` và chạy backend, frontend.
Không cần giải nén ảnh hay chạy script upload.

## 0. Cần chuẩn bị

- Node 20 trở lên, Git.
- Hai giá trị bí mật do chủ repo gửi riêng (không có trong repo):
  - mật khẩu database;
  - `SUPABASE_SECRET_KEY` (dạng `sb_secret_...`).
- Không gửi hai giá trị này qua nơi công khai và không commit lên git.

```powershell
git clone <link-repo>
cd weddy-planner
git checkout chika
```

## 1. Backend (NestJS + Prisma)

```powershell
cd backend
copy .env.example .env
```

Mở `backend\.env`, điền ba giá trị:

| Biến | Cách điền |
|---|---|
| `DATABASE_URL` | Thay `[YOUR-PASSWORD]` bằng mật khẩu DB. Ký tự đặc biệt phải mã hóa: `@` thành `%40`, `#` thành `%23`. Nếu báo lỗi SSL thì thêm `?sslmode=no-verify` vào cuối |
| `SUPABASE_SECRET_KEY` | Key `sb_secret_...` do chủ repo gửi |
| `JWT_SECRET` | Chuỗi ngẫu nhiên tự tạo, ví dụ: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Các biến còn lại (`SUPABASE_URL`, `PORT`, `CORS_ORIGIN`) giữ nguyên.

```powershell
npm install
npx prisma generate
npm run start:dev
```

- Bắt buộc chạy `npx prisma generate`, vì thư mục `src/generated` không nằm trong git.
- **Tuyệt đối không chạy** `prisma db pull`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push`.
  - `db pull` sẽ ghi đè phần sửa trong `prisma/schema.prisma` (quan hệ `package_albums` phải là mảng).
  - Các lệnh migrate và `db push` có thể xóa hoặc đổi dữ liệu thật.

Kiểm tra: mở http://localhost:3000/api/health, kết quả phải có `users 58`, `packages 205`, `albums 1535`.

## 2. Frontend (React + Vite)

Mở terminal mới:

```powershell
cd weddy-planner\frontend
copy .env.example .env
npm install
npm run dev
```

`frontend\.env` cần có đủ ba dòng (đã có sẵn trong `.env.example`):

```
VITE_API_URL=http://localhost:3000/api
VITE_USE_MOCK=true
VITE_REAL_APIS=catalog,auth
```

- `VITE_REAL_APIS=catalog,auth`: danh mục, dịch vụ, ảnh và đăng nhập lấy từ backend thật.
- Các tính năng chưa có backend (đơn hàng, chat, yêu thích, kế hoạch đám cưới, NCC...) vẫn dùng dữ liệu giả vì `VITE_USE_MOCK=true`.
- **Phía NCC: các cờ `orders`, `vendorChat` và `commissions` phải bật hoặc tắt CÙNG NHAU** (cùng nằm trong `VITE_REAL_APIS` hoặc cùng không). Hội thoại, đơn và hoa hồng giả dùng chung một kho dữ liệu (`weddy.mock.vendorOrders.*`); bật thật riêng một cờ thì hội thoại giả gặp đơn thật (hoặc ngược lại) và vỡ trang. Nút "Giả lập khách" và "Giả lập thời gian" chỉ có khi các cờ này đang dùng dữ liệu giả.
- Sửa `.env` xong phải khởi động lại `npm run dev`.

Mở http://localhost:5173 và đăng nhập thử bằng `admin` / `Everly@2026`.
Các tài khoản mẫu khác (ví dụ `ncc01`, `thao.trinh01`) dùng chung mật khẩu này.

## 3. Các API đã nối với frontend

| API | Ghi chú |
|---|---|
| `GET /api/categories` | Danh mục kèm ảnh bìa và số dịch vụ |
| `GET /api/services`, `/services/:id`, `/services/locations`, `/services/styles` | Lọc theo từ khóa, danh mục, khu vực, khoảng giá, có phân trang. Mỗi album là một gói dịch vụ, có `imageUrls` là toàn bộ ảnh của gói |
| `POST /api/auth/login` | Body `{"identifier":"...","password":"..."}`; `identifier` là username, email hoặc số điện thoại |
| `GET /api/auth/me` | Header `Authorization: Bearer <accessToken>` |
| `GET /api/vendors/:id/documents` | Giấy tờ NCC, link tạm 10 phút. Chỉ Admin hoặc chính NCC đó |
| `GET /api/health` | Kiểm tra kết nối DB |

Chưa có: đăng ký và OTP, sửa hồ sơ, rating Google Maps (đang trả 0).

## 4. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Backend báo lỗi kết nối DB | Sai mật khẩu, chưa mã hóa ký tự đặc biệt, hoặc thiếu `?sslmode=no-verify` |
| Trang vẫn hiện dữ liệu giả, ảnh Unsplash | `frontend\.env` thiếu `VITE_REAL_APIS`, hoặc chưa khởi động lại `npm run dev` |
| Trang trống, không có dữ liệu | Backend chưa chạy hoặc `VITE_API_URL` sai cổng |
| Báo lỗi CORS | `CORS_ORIGIN` trong `backend\.env` phải có địa chỉ frontend (mặc định có `http://localhost:5173`) |
| Lỗi `PrismaClient` hoặc `generated` | Chưa chạy `npx prisma generate` |
| Cổng 3000 hoặc 5173 đã bị chiếm | Tắt tiến trình đang dùng cổng, hoặc đổi `PORT` trong `backend\.env` |

## 5. Lưu ý bảo mật

- `SUPABASE_SECRET_KEY` có toàn quyền với Supabase của dự án. Nếu lộ, vào Supabase để rotate key rồi cập nhật lại `.env`.
- Frontend không cần key Supabase. Ảnh dùng URL công khai do backend trả về.
- Mật khẩu mẫu `Everly@2026` dùng chung cho mọi tài khoản mẫu. Nếu repo công khai, nên đổi mật khẩu các tài khoản này.
- Ảnh giấy tờ NCC nằm trong bucket private, chỉ xem được qua API có phân quyền.
