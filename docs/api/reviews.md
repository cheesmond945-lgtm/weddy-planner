# Đánh giá (reviews)

Cặp đôi đánh giá từng dòng dịch vụ trong đơn (`order_items`), mỗi dòng một lần. Đánh giá hiển thị chung ở trang nhà cung cấp, không kiểm duyệt.

Điều kiện đánh giá (trigger DB): đơn `Completed` và ngày cưới (`weddings.wedding_date`) đã qua theo giờ Asia/Ho_Chi_Minh. Nội dung 10–1000 ký tự; từ cấm do backend lọc (`common/utils/banned-words.ts`).

## Công khai

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/services/:serviceId/reviews?page&pageSize` | Danh sách đánh giá của nhà cung cấp, mới nhất trước (pageSize tối đa 50). Mỗi mục có `packageName`, `customerName`. |
| GET | `/services/:serviceId/reviews/summary` | `{ count, average }`. `average` làm tròn 1 chữ số, `null` nếu chưa có đánh giá. |

## Cặp đôi (cần đăng nhập, role Couple)

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/orders/:orderId/reviews` | Các dòng của đơn: `orderItemId`, `name`, `review` (hoặc null), `canReview`. |
| POST | `/order-items/:itemId/review` | Body `{ rating: 1..5, content }`. Tạo đánh giá. |
| PUT | `/order-items/:itemId/review` | Cùng body. Sửa đánh giá của chính mình. |

## Mã lỗi

| Mã | HTTP | Ý nghĩa |
|---|---|---|
| `VALIDATION_ERROR` | 400 | rating không phải số nguyên 1–5, hoặc nội dung ngoài 10–1000 ký tự (`details` theo trường) |
| `REVIEW_BANNED_CONTENT` | 400 | Nội dung chứa từ cấm |
| `REVIEW_NOT_ELIGIBLE` | 409 | Đơn chưa hoàn thành hoặc ngày cưới chưa qua |
| `REVIEW_ALREADY_EXISTS` | 409 | Dòng đơn đã được đánh giá |
| `REVIEW_NOT_FOUND` | 404 | Sửa khi chưa có đánh giá |
| `ORDER_NOT_FOUND` / `ORDER_ITEM_NOT_FOUND` / `SERVICE_NOT_FOUND` | 404 | Không tìm thấy, hoặc không thuộc cặp đôi này |
