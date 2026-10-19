# Prototype giao diện Nhà cung cấp (NCC)

Prototype là bản thiết kế mẫu của toàn bộ phần Vendor. Khi code `frontend/src/pages/vendor/`, giao diện và luồng thao tác phải bám theo prototype này.

## File trong thư mục

| File | Dùng để |
|---|---|
| `prototype-ncc.html` | Bản gốc, đầy đủ ảnh. **Người** mở bằng trình duyệt để xem và bấm thử. |
| `prototype-ncc.slim.html` | Bản đã bỏ ảnh base64 và đổi chữ tiếng Việt về dạng đọc được. **AI** đọc bản này: CSS ở đầu file, logic React (đã build) ở cuối file. |

## Các màn hình (menu bên trái)

1. **Tổng quan**
2. **Hồ sơ nhà cung cấp**: thông tin doanh nghiệp, mã số thuế, lĩnh vực, giờ mở cửa, Google Maps, giấy tờ (GPKD, PCCC, ATTP), ảnh (mặt tiền, sảnh). Trạng thái: Chờ duyệt / Cần bổ sung / Đã xác minh.
3. **Quản lý dịch vụ**: gói dịch vụ (tên gói, giá tối thiểu và tối đa, album ảnh). Trạng thái: Bản nháp / Chờ duyệt / Đã đăng / Ẩn.
4. **Tin nhắn**: chat với khách. Tạo đơn ngay trong cuộc trò chuyện, gửi lại đơn (version), xử lý yêu cầu điều chỉnh.
5. **Quản lý đơn hàng**: đơn tạo từ Tin nhắn. Trạng thái đơn và trạng thái thanh toán tách riêng. Trạng thái đơn: Bản nháp / Chờ khách xác nhận / Khách yêu cầu sửa phương án / Đã xác nhận. Có ghi nhận thanh toán và phương án điều chỉnh.
6. **Tài chính & đối soát**: hoa hồng phải trả cho WebPlan theo kỳ (tháng).

## Quy tắc khi code theo prototype

- Bám prototype về **bố cục, màu, chữ, luồng thao tác, trạng thái**. Không copy code đã build. Viết lại bằng React + TypeScript + Tailwind theo `docs/ARCHITECTURE.md`.
- **Tên trường, enum, trạng thái** lấy theo `docs/api/*.md` và `docs/database.md`. Nếu prototype khác tài liệu thì **theo tài liệu** và ghi lại chỗ khác biệt.
- Dữ liệu giả đặt ở `src/mocks/`, kiểu dữ liệu ở `src/types/`, đúng contract.
- Màu và font lấy từ biến CSS trong `:root` của prototype (`--bg`, `--ink`, `--gold`, `--side`…), đưa vào cấu hình Tailwind. Font: Be Vietnam Pro (chữ thường), Cormorant Garamond (tiêu đề).
- Dùng lại `components/`, `layouts/`, `api/` có sẵn. Không sửa `pages/couple/`.
