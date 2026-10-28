# Weddy Planner (WebPlan)

Nền tảng web lập kế hoạch đám cưới và kết nối cặp đôi với nhà cung cấp (NCC).
Luật làm việc và cấu trúc repo: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Quy ước API: [docs/api/README.md](docs/api/README.md).

| Phần | Công nghệ | Thư mục |
|---|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, React Query, React Router | `frontend/` |
| Backend | NestJS 12 (ESM), TypeScript, Prisma 6 | `backend/` |
| Database | PostgreSQL 16 (Docker Compose) | `docker-compose.yml` |

## Yêu cầu

- Node.js 24 trở lên (đã thử với 24.16) và npm
- Docker Desktop (để chạy PostgreSQL), hoặc PostgreSQL 16 cài sẵn trên máy

## Cài đặt lần đầu

```bash
# 1. Biến môi trường (sửa mật khẩu nếu muốn, giữ khớp giữa các file)
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Thư viện
cd backend
npm install
npx prisma generate
cd ..
cd frontend
npm install
cd ..
```

Trên Windows PowerShell dùng `Copy-Item` thay cho `cp`. Mỗi lệnh một dòng như trên: PowerShell 5.1 không hiểu `&&`.
`POSTGRES_*` trong `.env` gốc phải khớp với `DATABASE_URL` trong `backend/.env`.

## Chạy

Mở 3 terminal ở thư mục gốc repo:

```bash
# Database
docker compose up -d

# Backend: http://localhost:3000/api (Swagger: http://localhost:3000/api/docs)
cd backend
npm run start:dev

# Frontend: http://localhost:5173
cd frontend
npm run dev
```

Lệnh `npm` phải chạy trong `frontend/` hoặc `backend/`. Thư mục gốc không có `package.json`.

Kiểm tra backend kết nối được DB: mở http://localhost:3000/api/health, kết quả `{"data":{"status":"ok","db":"up"}}`.

## Lệnh hay dùng

| Lệnh | Thư mục | Việc |
|---|---|---|
| `npm run dev` | frontend | Chạy dev server |
| `npm run build` | frontend | Kiểm tra kiểu và build |
| `npm run start:dev` | backend | Chạy API, tự tải lại khi sửa code |
| `npm run build` | backend | Build ra `dist/` |
| `npm run prisma:migrate` | backend | Tạo và chạy migration từ `schema.prisma` |
| `npm run prisma:studio` | backend | Xem dữ liệu trong DB |
| `npm run prisma:seed` | backend | Nạp dữ liệu mẫu |
| `docker compose down` | gốc | Dừng PostgreSQL (thêm `-v` để xóa luôn dữ liệu) |

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
  integrations/ Cloudinary, LLM, mail, VNPay
  jobs/        Việc chạy định kỳ
```

## Git

Mỗi người một nhánh `feature/<fe|be>-<module>-<tên>`, không push thẳng `main`. Không commit file `.env`.
