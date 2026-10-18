# Weddy Planner (WebPlan): luật cho AI

Nền tảng web lập kế hoạch đám cưới và kết nối cặp đôi với nhà cung cấp (NCC).
Giao diện tiếng Việt. Tiền tệ đồng. Tên hiển thị trên giao diện giữ như prototype (WebPlan) cho tới khi tôi đổi.

## Stack
| Phần | Chọn |
|---|---|
| FE | React + Vite + TypeScript + Tailwind (+ shadcn/ui, React Query, React Router) |
| BE | NestJS + TypeScript |
| DB / ORM | PostgreSQL + Prisma |
| Validate | class-validator (BE), Zod (FE nếu cần) |
| Auth | JWT + phân quyền theo role |
| Lưu ảnh | Cloudinary (BE cấp chữ ký upload) |
| Khác | VNPay (đặt cọc), LLM (sinh timeline), gửi email, Docker Compose cho Postgres |

## Vai trò
Couple (cặp đôi), Vendor (NCC), Admin. NCC không tự đăng ký: gửi yêu cầu tư vấn, Admin duyệt, hệ thống gửi email link tạo tài khoản, NCC đặt mật khẩu lần đầu.

## Cấu trúc repo (monorepo)
weddy-planner/
- frontend/: src/{app, layouts, pages/{auth,couple,vendor,admin}, features/{catalog,weddings,favorites,compare,chat,orders,payments,notifications}, components, api, routes, store, types, mocks, assets, lib, styles}
- backend/: prisma/{schema.prisma, migrations, seed.ts, seed-assets} và src/{main.ts, app.module.ts, modules/{auth,users,weddings,search,favorites,consultation-requests,vendors,catalog,chat,orders,payments,commissions,notifications}, common/{guards,decorators,filters,interceptors,enums,utils}, prisma, integrations/{storage,ai,mail,payment-gateway}, jobs}
- docs/: api/{README,auth,vendors,catalog,weddings,chat,orders,payments,commissions,notifications}.md, database.md, state-diagrams.md, ARCHITECTURE.md, prototype/, images/
- docker-compose.yml, .env.example, .gitignore, README.md

## Nguồn sự thật (ưu tiên từ trên xuống)
1. docs/database.md: tên thực thể, thuộc tính, enum, quan hệ. Dùng nguyên văn, không tự đặt tên khác.
2. docs/state-diagrams.md: trạng thái hồ sơ NCC, gói, đơn, thanh toán.
3. docs/api/*.md: hợp đồng giữa FE và BE.
4. docs/prototype/prototype.html: chỉ dùng cho giao diện và luồng người dùng của phía cặp đôi. Dữ liệu trong prototype là dữ liệu giả.
Nếu các nguồn mâu thuẫn nhau, DỪNG và hỏi tôi, không tự chọn.

## Quy trình làm việc
1. FE làm từng module với dữ liệu giả trong frontend/src/mocks, đúng theo docs/database.md.
2. Xong module nào, ghi luôn contract docs/api/<module>.md: method, path, role được gọi, request, response mẫu JSON, mã lỗi.
3. BE làm API đúng contract. Contract đổi thì sửa tài liệu trước, rồi báo tôi.
4. Ghép: đổi FE từ mock sang API thật, từng module một.

## Quy ước API (bản nháp, chốt trong docs/api/README.md)
- Thành công: { "data": ... }. Lỗi: { "error": { "code", "message" } }.
- Tiền là số nguyên đơn vị đồng. Ngày giờ theo ISO 8601. Phân trang và enum theo README.
- Tên trường camelCase, khớp schema.prisma.

## Quy tắc FE
- Mỗi file trong pages/ là một trang, chỉ ghép thành phần. Logic nghiệp vụ nằm trong features/.
- Mọi lời gọi HTTP đi qua src/api. Chuyển mock/thật bằng biến VITE_USE_MOCK.
- types/ khớp contract. mocks/ khớp types/.
- Màu, font, bo góc lấy từ design tokens (cấu hình Tailwind), không viết màu cứng trong component.
- Trang cần quyền thì chặn bằng routes/ (route guard theo role).

## Quy tắc BE
- Mỗi module một thư mục: controller, service, dto. Module gọi nhau qua service, không truy vấn chéo bảng của module khác.
- Truy cập DB qua PrismaService. Không sửa tay thư mục migrations.
- Role kiểm tra bằng JwtAuthGuard và RolesGuard. Response bọc bằng interceptor, lỗi bắt bằng filter.
- Dịch vụ bên ngoài (Cloudinary, LLM, mail, VNPay) nằm trong integrations/, mỗi cái một module.
- Việc chạy định kỳ (hết hạn cọc, bảng kê hoa hồng tháng) nằm trong jobs/.

## Git
- Mỗi người một nhánh: feature/<fe|be>-<module>-<tên>. Không push thẳng main.
- Module không liên quan nhau thì làm trước. Commit nhỏ, message rõ.

## Bảo mật
- Không commit .env hoặc khóa bí mật. Chỉ cập nhật .env.example (không chứa khóa thật).
- Kiểm tra chữ ký callback VNPay. Upload ảnh dùng chữ ký do BE cấp.

## Không được làm
- Thêm thư viện mới khi chưa hỏi.
- Tự đổi tên thực thể, enum, trường dữ liệu.
- Sửa module hoặc tài liệu API của người khác khi chưa được yêu cầu.
- Sao chép các phần chỉ có trong prototype (thanh mô phỏng NCC, ô "Hiện mã chức năng").