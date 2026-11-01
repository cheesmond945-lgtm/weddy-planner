# Weddy Planner (WebPlan)

Nền tảng web lập kế hoạch đám cưới và kết nối cặp đôi với nhà cung cấp (NCC).
Luật làm việc và cấu trúc repo: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Quy ước API: [docs/api/README.md](docs/api/README.md).

| Phần | Công nghệ | Thư mục |
|---|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, React Query, React Router | `frontend/` |
| Backend | NestJS 11, TypeScript, Prisma 7 | `backend/` |
| Database | PostgreSQL trên Supabase (dùng chung cả nhóm) | `backend/prisma/` |

## Yêu cầu

- Node.js 24 trở lên (đã thử với 24.16) và npm
- Quyền truy cập Supabase của nhóm (xin người quản lý dự án chuỗi kết nối và khóa)

`docker-compose.yml` ở thư mục gốc là PostgreSQL chạy cục bộ, chỉ dùng khi muốn thử trên một DB riêng. Chạy bình thường không cần Docker.

## Cài đặt lần đầu

```bash
# 1. Biến môi trường
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Thư viện
cd backend
npm install
npm run db:generate
cd ..
cd frontend
npm install
cd ..
```

Trên Windows PowerShell dùng `Copy-Item` thay cho `cp`. Mỗi lệnh một dòng như trên: PowerShell 5.1 không hiểu `&&`.

### Điền `backend/.env`

`backend/.env` chứa khóa bí mật nên **không nằm trong git**; file mẫu `backend/.env.example` chỉ có tên biến. Sau khi `cp`, điền như sau (xin giá trị dùng chung từ người quản lý dự án qua tin nhắn riêng, không gửi vào nhóm chat chung):

| Biến | Lấy ở đâu |
|---|---|
| `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Supabase dùng chung của nhóm: xin người quản lý dự án |
| `JWT_SECRET` | Tự đặt, chuỗi ngẫu nhiên dài |
| `MAIL_USER`, `MAIL_PASSWORD` | Gmail và "Mật khẩu ứng dụng" của bạn (không dùng mật khẩu đăng nhập) |
| `VIETQR_*`, `SEPAY_TOKEN` | Tài khoản nhận tiền và token SePay: xin người quản lý dự án. Thiếu thì chỉ các API thanh toán trả 501, phần còn lại vẫn chạy |
| `GEMINI_API_KEY` | Tự tạo miễn phí ở https://aistudio.google.com/apikey. Thiếu thì "Tạo với AI" dùng đoạn mẫu |

`frontend/.env` chỉ cần `VITE_API_URL` (mặc định `http://localhost:3000/api`). Khi thêm biến mới vào `.env`, nhớ thêm tên biến vào `.env.example` (để trống giá trị) trong cùng commit.

## Chạy

Mở 2 terminal ở thư mục gốc repo:

```bash
# Backend: http://localhost:3000/api (Swagger: http://localhost:3000/api/docs)
cd backend
npm run start:dev

# Frontend: http://localhost:5173
cd frontend
npm run dev
```

Lệnh `npm` phải chạy trong `frontend/` hoặc `backend/`. Thư mục gốc không có `package.json`.

Nếu `npm run start:dev` tự thoát hoặc báo lỗi ngay khi khởi động (xảy ra trên một số máy Windows), chạy `npm run build` rồi `node dist/main`, và chạy lại hai lệnh này mỗi khi sửa code backend.

Kiểm tra backend kết nối được DB: mở http://localhost:3000/api/health, kết quả `{"data":{"status":"ok","db":"up"}}`.

## Thay đổi cấu trúc cơ sở dữ liệu

Ai có quyền vào Supabase của nhóm đều tự sửa cấu trúc DB được. Vì cả nhóm dùng chung một DB nên làm theo thứ tự này để không làm hỏng máy của người khác:

1. Viết thay đổi thành file SQL trong `backend/prisma/manual/` (đặt tên `năm-tháng-nội-dung.sql`) và commit cùng code, để người khác biết DB đã đổi gì.
2. Chạy file đó trong Supabase SQL Editor.
3. Báo cho nhóm biết trước khi chạy nếu thay đổi có thể làm hỏng code của người khác (đổi tên hoặc xóa bảng, cột; thêm ràng buộc chặt hơn). Thêm cột cho phép trống thì thường an toàn.
4. Chạy `npm run db:pull` rồi `npm run db:generate` trong `backend/` để cập nhật `schema.prisma`.

Ứng dụng không tự đổi cấu trúc DB khi khởi động.

## Lệnh hay dùng

| Lệnh | Thư mục | Việc |
|---|---|---|
| `npm run dev` | frontend | Chạy dev server |
| `npm run build` | frontend | Kiểm tra kiểu và build |
| `npm run start:dev` | backend | Chạy API, tự tải lại khi sửa code |
| `npm run build` | backend | Build ra `dist/` |
| `npm run db:pull` | backend | Đọc cấu trúc DB hiện có vào `schema.prisma` (dùng `DIRECT_URL`) |
| `npm run db:generate` | backend | Sinh lại Prisma Client sau khi đổi `schema.prisma` |

## Cấu trúc chính

```
frontend/src/
  app/         Providers (React Query, Router)
  layouts/     CoupleLayout, VendorLayout, AdminLayout, AuthLayout
  routes/      Bảng route, guard theo role, đường dẫn
  pages/       Mỗi file một trang, chỉ ghép thành phần
  features/    Logic nghiệp vụ theo module
  api/         HTTP client (gắn token, xử lý 401)
  store/       Phiên đăng nhập
  styles/      Design tokens và cấu hình Tailwind
backend/src/
  common/      JwtAuthGuard, RolesGuard, @Roles, @CurrentUser, filter lỗi, interceptor { data }
  prisma/      PrismaService, /api/health
  modules/     Mỗi module nghiệp vụ một thư mục
  integrations/ Cloudinary, Gemini (AI), mail, VietQR/SePay
  jobs/        Việc chạy định kỳ
```

## Git

Mỗi người một nhánh `feature/<fe|be>-<module>-<tên>`, không push thẳng `main`. Không commit file `.env`.
