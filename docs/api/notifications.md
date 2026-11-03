# API: notifications (thông báo)

> **Đã làm ở backend** (`backend/src/modules/notifications`, 27/10/2026). Dùng chung cho **mọi vai trò** (Couple, Vendor, Admin): mỗi người chỉ thấy và đánh dấu thông báo của chính mình.
> Quy ước chung: [README.md](README.md). Bảng `Notifications` (`docs/database.md`): `Type`, `Title`, `Content`, `ReferenceType`, `ReferenceId`, `IsRead`, `ReadDate`, `CreatedDate`.

## Kiểu dữ liệu

```json
{
  "id": "…",
  "type": "NewMessage",
  "title": "Tin nhắn mới từ Bùi Thanh Chi",
  "content": "Bên mình có thể xem thử mẫu cổng hoa vào cuối tuần này được không ạ?",
  "referenceType": "Conversation",
  "referenceId": "42d4c57d-…",
  "isRead": false,
  "readDate": null,
  "createdDate": "2026-10-27T05:48:05.628Z"
}
```

| `type` | Ai nhận | Khi nào | `referenceType` |
|---|---|---|---|
| `NewMessage` | Bên kia của hội thoại | Có tin nhắn chữ mới; mỗi hội thoại chỉ giữ **một** thông báo chưa đọc cho mỗi người nhận (xem [chat.md](chat.md)) | `Conversation` |
| `OrderSent` | Khách | NCC gửi, cập nhật hoặc sửa đơn | `Order` |
| `OrderRevisionRequested` | NCC | Khách yêu cầu chỉnh sửa (trước cọc) | `Order` |
| `OrderDeposited` | NCC | Khách đặt cọc thành công | `Order` |
| `OrderExpired` | Khách và NCC | Đơn quá hạn đặt cọc | `Order` |
| `OrderCompleted` | Khách (và NCC khi hệ thống tự hoàn thành) | Đơn hoàn thành | `Order` |
| `OrderCancelled` | Khách | NCC hủy đơn đã cọc | `Order` |

Giao diện tự dựng câu hiển thị theo `type` (ví dụ NCC thấy "Bùi Thanh Chi nhắn tin: …", "Khách đã thanh toán cọc đơn DH…") và mở đúng chỗ theo `referenceType`: `Conversation` → hội thoại, `Order` → đơn.

## Endpoint

### GET /notifications
Mới nhất trước. Query: `limit` (mặc định 30, tối đa 100), `unreadOnly=true` (chỉ chưa đọc), `before` (ISO, chỉ lấy thông báo cũ hơn mốc này, để phân trang). Response 200: `{ "data": Notification[] }`.

### GET /notifications/unread-count
Response 200: `{ "data": { "count": 3 } }`. Dùng cho chấm đỏ trên chuông; FE hỏi lại 15 giây và dừng khi tab bị ẩn.

### POST /notifications/:id/read
Đánh dấu một thông báo đã đọc (idempotent). Response 200: `{ "data": null }`. Lỗi: 404 `NOTIFICATION_NOT_FOUND` (không tồn tại, id sai định dạng, hoặc của người khác).

### POST /notifications/read-all
Đánh dấu mọi thông báo của người gọi đã đọc. Response 200: `{ "data": { "updated": 6 } }`.

## Ghi chú

- Đánh dấu thông báo `NewMessage` đã đọc **không** làm các tin nhắn trong hội thoại thành đã đọc (số tin chưa đọc trên menu Tin nhắn chỉ giảm khi mở hội thoại, `POST /conversations/:id/read`).
- Ngược lại, mở hội thoại sẽ đánh dấu thông báo `NewMessage` của hội thoại đó đã đọc.
- Chưa có: thông báo nhắc việc (`TaskUpcoming`), nhắc hoa hồng (`CommissionDueSoon`, `CommissionOverdue`), thông báo duyệt hồ sơ; chưa có chuông phía khách (nút chuông hiện là nút tĩnh).
- Dữ liệu giả (nhóm cờ `notifications`): `frontend/src/mocks/notifications.ts` dựng thông báo từ hội thoại và đơn giả của NCC, chỉ lưu phần đã đọc.
