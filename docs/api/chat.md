# API: chat (tin nhắn giữa cặp đôi và NCC)

> **Đã làm ở backend** (`backend/src/modules/chat`, cập nhật 27/10/2026) và đúng với `docs/database.md` mục 4.17, 4.18.
> Quy ước chung: [README.md](README.md). `ServiceSummary`: xem [catalog.md](catalog.md). Thẻ đơn và các tin liên quan đơn: [THE_DON_HANG.md](THE_DON_HANG.md), [orders.md](orders.md).

Cặp đôi và NCC dùng **cùng một bộ API** `/conversations`. Vai trò lấy từ JWT, mỗi người chỉ thấy hội thoại của mình (`Conversations.CoupleId` hoặc `Conversations.VendorId`). Mỗi cặp (khách, NCC) có đúng **một** hội thoại.

Phía NCC còn có **bí danh** `/vendors/me/conversations/*` (cùng hành vi, chỉ role `Vendor`, không có `POST` tạo hội thoại) để giữ đường dẫn cũ.

Role: **Couple** hoặc **Vendor**. Không đăng nhập: 401. Sai vai trò: 403.

## Kiểu dữ liệu

### `Message` (dùng chung hai phía)

```json
{
  "id": "…",
  "conversationId": "fb9cffdf-…",
  "sender": "VENDOR",
  "type": "Order",
  "orderId": "5d1c8b1e-…",
  "content": "Đơn dịch vụ DH26100004",
  "isRead": true,
  "sentDate": "2026-10-25T07:30:00.000Z",
  "order": { "orderCode": "DH26100004", "status": "Pending" }
}
```

| Trường | Ghi chú |
|---|---|
| `sender` | `COUPLE`, `VENDOR`, `SYSTEM` (`Messages.SenderId` rỗng = tin hệ thống) |
| `type` | `Messages.Type`, **chỉ 4 giá trị**: `Text`, `Order`, `DepositReceipt`, `FinalInvoice` |
| `orderId` | Có với `Order`, `DepositReceipt`, `FinalInvoice`, còn lại `null` |
| `content` | Nội dung chữ; với `Order` là câu mô tả ngắn |
| `isRead`, `sentDate` | `Messages.IsRead`, `Messages.SentDate` |
| `order` | **Phần thêm**, chỉ có khi tin có `orderId`: `orderCode` và `status` thô của đơn (7 trạng thái `Draft`, `Pending`, `NeedRevision`, `Deposited`, `Completed`, `Expired`, `Cancelled`). Mã và trạng thái đơn đi kèm tin, tiện cho danh sách và thông báo |

Tin hệ thống (`sender = SYSTEM`) luôn có `type = Text`, trừ `DepositReceipt` do hệ thống gửi. Khách yêu cầu chỉnh sửa đơn, đơn hết hạn, NCC hủy đơn, đơn hoàn thành đều là tin `Text` hệ thống: xem [CHOT_NGHIEP_VU_NCC.md](../CHOT_NGHIEP_VU_NCC.md) mục 5 và [THE_DON_HANG.md](THE_DON_HANG.md) mục 5.

### `Conversation` phía cặp đôi

```json
{
  "id": "fb9cffdf-…",
  "service": { "id": "8f9dfd27-…", "name": "Ha Vy Wedding & Event", "…": "ServiceSummary" },
  "planStatus": "AWAITING_DEPOSIT",
  "unreadCount": 2,
  "lastMessage": { "sender": "VENDOR", "type": "Text", "content": "Còn lịch bạn nhé", "sentDate": "2026-10-17T08:10:00.000Z", "orderCode": null },
  "latestOrder": { "id": "5d1c8b1e-…", "orderCode": "DH26100009", "status": "Pending", "depositDueDate": "2026-10-28T03:41:00.000Z" }
}
```

`latestOrder`: đơn **đã gửi** mới nhất với NCC này (bỏ bản nháp), hoặc `null`. Giao diện dùng cho nhãn trạng thái đơn trong danh sách hội thoại (Chờ cọc, Chờ chỉnh sửa, Đã cọc, Hoàn thành, Hết hạn, Đã hủy; chấm đỏ khi `Pending` còn dưới 6 giờ). Nhãn "Đã cọc" theo `planStatus` không còn dùng trong danh sách.

### `VendorConversation` (phía NCC)

```json
{
  "id": "fb9cffdf-…",
  "customer": { "name": "Minh Anh & Quốc Huy", "phone": "0901 234 567" },
  "unreadCount": 2,
  "lastMessage": { "sender": "COUPLE", "type": "Text", "content": "Bên mình cập nhật giúp…", "sentDate": "2026-10-18T00:51:00.000Z", "orderCode": null },
  "latestOrder": { "id": "5d1c8b1e-…", "orderCode": "DH26100003", "status": "NeedRevision" },
  "hasDraftOrder": false,
  "needsAction": true,
  "orderCodes": ["DH26100003"]
}
```

| Trường | Ghi chú |
|---|---|
| `unreadCount` | Số tin **của bên kia** mà người xem chưa đọc (`IsRead = false`, bỏ qua tin hệ thống) |
| `lastMessage` | Tin gần nhất (kể cả tin hệ thống); `orderCode` có với tin liên quan đơn |
| `customer.name` | "Chú rể & Cô dâu" (`Weddings.GroomName` & `BrideName`); khách chưa có thông tin đám cưới thì `Users.FullName`. FE điền sẵn vào đơn |
| `customer.phone` | `Users.PhoneNumber`, chuỗi rỗng nếu khách chưa nhập |
| `customer.online` | **Tùy chọn.** Chưa có dữ liệu trực tuyến thật nên BE không trả; FE không hiện chấm xanh |
| `latestOrder` | Đơn **đã gửi** mới nhất của hội thoại (bỏ qua bản nháp): `status` là trạng thái thô, trừ `Draft` |
| `hasDraftOrder` | Có đơn `Draft` |
| `needsAction` | Có đơn `Draft`, `NeedRevision`, hoặc đơn `Deposited` đã qua `EventDate` (giờ VN, chờ đánh dấu hoàn thành) |
| `orderCodes` | Mã mọi đơn của hội thoại, để tìm theo mã đơn |

Nhãn trạng thái trong danh sách hội thoại NCC (FE suy từ `latestOrder.status`): `Pending` Chờ cọc, `NeedRevision` Cần sửa, `Deposited` Đã cọc, `Completed` Hoàn thành, `Expired` Hết hạn, `Cancelled` Đã hủy; chỉ có bản nháp thì "Bản nháp".

## Endpoint

### GET /conversations
Hội thoại của người gọi, mới nhất trước (`LastMessageDate`). Không phân trang. Response 200: `{ "data": Conversation[] }` (cặp đôi) hoặc `VendorConversation[]` (NCC).

Phía cặp đôi: NCC đã bị ẩn thì hội thoại không hiện. FE lọc theo hạng mục (`service.category.slug`) và hiện nhãn "Đã cọc" khi `planStatus = CONFIRMED`.

### POST /conversations
**Chỉ cặp đôi** (NCC: 403). Bắt đầu hoặc mở lại hội thoại với NCC của một dịch vụ. Body `{ "serviceId": "…", "replace": false }`.

- Dịch vụ chưa có trong kế hoạch: tự thêm vào (cùng quy tắc `POST /weddings/me/plan-items`, kể cả 409 `PLAN_CATEGORY_TAKEN` và `replace`).
- **Hạng mục đã có NCC khác chờ cọc hoặc đã chốt (cập nhật 28/10/2026):** KHÔNG còn lỗi `PLAN_CATEGORY_LOCKED`. Vẫn mở hội thoại để khách tư vấn tự do, chỉ không thêm NCC này vào kế hoạch (`planStatus = null`). Nếu khách cọc đơn của NCC này thì NCC được thêm vào kế hoạch lúc cọc, hạng mục có hai NCC (trang Kế hoạch hiện đủ).
- Hội thoại mới: tạo kèm lời chào của NCC "Chào bạn! Mình là <tên>. Bạn cần tư vấn gói nào cho <hạng mục>?".
- Gọi lại với cùng dịch vụ trả về cùng hội thoại.

Response 201: `{ "data": Conversation }`

Lỗi: 404 `SERVICE_NOT_FOUND`, 409 `WEDDING_NOT_SET`, 409 `PLAN_CATEGORY_TAKEN`. (`POST /weddings/me/plan-items` vẫn trả 409 `PLAN_CATEGORY_LOCKED`: thêm vào kế hoạch thì vẫn bị khóa.)

### GET /conversations/:id/messages
Toàn bộ tin của hội thoại, cũ trước. Response 200: `{ "data": Message[] }`

Tham số tùy chọn `?after=<sentDate ISO>`: chỉ lấy tin **mới hơn** mốc đó (cho polling nhẹ hơn). FE hiện chưa dùng, vẫn tải toàn bộ.

Lỗi: 404 `CONVERSATION_NOT_FOUND` (không tồn tại, id sai định dạng, hoặc không phải hội thoại của người gọi).

### POST /conversations/:id/messages
Gửi tin văn bản. Body `{ "text": "Cho mình hỏi giá bao nhiêu?" }`. Response 201: `{ "data": Message }`

Lỗi: 400 `VALIDATION_ERROR` (tin rỗng hoặc quá 2000 ký tự), 404 `CONVERSATION_NOT_FOUND`.

### GET /conversations/unread-count
Tổng số tin của bên kia mà người xem chưa đọc, ở mọi hội thoại (bỏ qua tin hệ thống và tin của chính mình). Response 200: `{ "data": { "count": 2 } }`. Bí danh phía NCC: `GET /vendors/me/conversations/unread-count`. Dùng cho huy hiệu menu Tin nhắn và tiêu đề tab "(2) Tin nhắn · WebPlan"; FE hỏi lại 15 giây và dừng khi tab bị ẩn.

### POST /conversations/:id/read
Người xem đã mở hội thoại: các tin của bên kia thành đã đọc (`unreadCount = 0`) và thông báo `NewMessage` của hội thoại đó thành đã đọc. FE gọi khi mở hội thoại và khi có tin mới lúc đang mở. Response 201: `{ "data": null }`

Lỗi: 404 `CONVERSATION_NOT_FOUND`.

## Thông báo tin mới

Khi có tin văn bản mới, **người nhận** có một thông báo (bảng `Notifications`, `Type = NewMessage`, `ReferenceType = Conversation`, `ReferenceId` = hội thoại). Áp dụng cho cả hai chiều (khách nhắn thì NCC nhận, NCC nhắn thì khách nhận).

- Mỗi hội thoại **chỉ giữ một thông báo `NewMessage` chưa đọc** cho mỗi người nhận: đã có thì không tạo thêm.
- Người nhận mở hội thoại (`POST …/read`) thì thông báo đó thành đã đọc; tin kế tiếp sẽ báo lại.
- Lỗi khi ghi thông báo không làm hỏng việc gửi tin.

## Cập nhật tin mới (realtime)

**Socket.IO** ở cùng cổng backend, đường dẫn `/socket.io` (`backend/src/modules/realtime`). FE kết nối với `auth: { token: <JWT> }`; token sai hoặc hết hạn thì server gửi `unauthorized` rồi ngắt. Mỗi người dùng vào phòng `user:<id>` và nhận:

| Sự kiện | Dữ liệu | Khi nào |
|---|---|---|
| `message` | `{ conversationId, orderId, type }` | Mọi tin mới trong hội thoại của mình: tin chữ, thẻ đơn, tin hệ thống (đơn hết hạn, cọc, sửa, hủy, hoàn thành…). Gửi cho **cả hai bên** |
| `read` | `{ conversationId }` | Một bên vừa đọc hội thoại (số chưa đọc đổi) |
| `notification` | `{ type, referenceType, referenceId }` | Có thông báo mới |

Sự kiện chỉ báo "có thay đổi"; FE tải lại đúng truy vấn liên quan qua REST (`frontend/src/app/RealtimeBridge.tsx`), nên contract các endpoint giữ nguyên. Khi đang kết nối, FE chỉ hỏi lại dự phòng mỗi 60 giây; mất kết nối thì hỏi lại như cũ (5 giây khung chat, 15 đến 30 giây số chưa đọc). Chạy nhiều tiến trình backend thì cần adapter Redis cho Socket.IO.

## Thẻ đơn trong chat

Tin `Order`, `DepositReceipt`, `FinalInvoice` có `orderId`; FE lấy đơn đầy đủ bằng `GET /orders/:id` (khách) hoặc `GET /vendors/me/orders?conversationId=…` (NCC) để vẽ thẻ (nội dung giống nhau hai bên, chỉ khác nút: [THE_DON_HANG.md](THE_DON_HANG.md), [THE_DON_PHIA_KHACH.md](../THE_DON_PHIA_KHACH.md)). Gửi lại đơn tạo thẻ `Order` mới, các thẻ cũ của cùng đơn thu gọn.

Tin hệ thống về đơn lưu **một bản chữ trung tính**, FE đổi cách xưng hô theo vai trò: lưu "Khách yêu cầu chỉnh sửa đơn …" (khách thấy "Bạn đã yêu cầu chỉnh sửa đơn …"), lưu "NCC đã hủy đơn … · Lý do: …" (khách thấy "{tên NCC} đã hủy đơn … · Lý do: …"), "Đơn … đã hết hạn đặt cọc.", "Đơn … đã hoàn thành.".

## Ghi chú về dữ liệu giả

- Phía cặp đôi (`frontend/src/mocks/chat.ts`): NCC giả tự trả lời theo câu mẫu; nhắn có chữ "gửi đơn" hoặc "chốt" thì NCC giả tự gửi đơn; yêu cầu chỉnh sửa đơn thì NCC giả tự gửi lại đơn sau 2 giây. Các hành vi này **chỉ có trong mock**, BE không làm.
- Phía NCC (`frontend/src/mocks/vendorOrders.ts`): nút **"Giả lập khách"** (đặt cọc, yêu cầu chỉnh sửa trước cọc, nhắn tin) và **"Giả lập thời gian"** **chỉ có khi dùng dữ liệu giả**, không nằm trong hợp đồng.

## Cần chốt

1. Gửi ảnh / tệp trong chat (prototype có nút đính kèm): có làm không.
2. Trạng thái trực tuyến của khách và NCC: cần chốt có làm (websocket / presence) không.
3. Phân trang tin khi hội thoại dài (`?before=<messageId>&limit=50`): bản này chưa cần.
4. Chuông thông báo hiển thị `NewMessage`: chờ API đọc `Notifications`.
