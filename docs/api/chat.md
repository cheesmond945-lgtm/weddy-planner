# API: chat (phía cặp đôi)

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/chat.ts`).
> Quy ước chung: [README.md](README.md). `ServiceSummary`: xem [catalog.md](catalog.md).
> **Chờ đối chiếu `docs/database.md`.**

Phạm vi: cặp đôi nhắn tin với NCC của một dịch vụ (mục 6.1, 6.2). Mỗi dịch vụ trong kế hoạch có tối đa **một** hội thoại. Phía NCC dùng chung các endpoint này (làm khi tới phần NCC).

Role: **COUPLE** (phía NCC: VENDOR, chỉ hội thoại của NCC mình).

`Conversation`

```json
{
  "id": "cv-1",
  "service": { "id": "sv-11", "name": "Lumi Wedding Studio", "…": "ServiceSummary" },
  "planStatus": "AWAITING_DEPOSIT",
  "unreadCount": 2,
  "lastMessage": { "type": "ORDER", "text": "Nhà cung cấp đã gửi đơn dịch vụ", "createdAt": "2026-10-17T08:10:00.000Z" }
}
```

`Message`

```json
{
  "id": "m-4",
  "conversationId": "cv-1",
  "sender": "VENDOR",
  "type": "ORDER",
  "text": "Nhà cung cấp đã gửi đơn dịch vụ",
  "orderId": "od-1",
  "createdAt": "2026-10-17T08:10:00.000Z"
}
```

| Trường | Giá trị |
|---|---|
| `sender` | `COUPLE`, `VENDOR`, `SYSTEM` (tin hệ thống: đã gửi đơn, đã cọc…) |
| `type` | `TEXT`; `ORDER` = thẻ đơn dịch vụ, FE lấy chi tiết bằng `GET /orders/:orderId` |

### GET /conversations
Hội thoại của người gọi, mới nhất trước. Không phân trang (mỗi cặp đôi chỉ vài hội thoại). Response 200: `{ "data": Conversation[] }`

FE lọc theo dịch vụ (hạng mục, `service.category.slug`) và hiện nhãn "Đã cọc" khi `planStatus = CONFIRMED`, đều làm ở FE nên không cần tham số lọc.

### POST /conversations
Bắt đầu hoặc mở lại hội thoại với NCC của dịch vụ (openChat trong prototype). Body `{ "serviceId": "sv-5", "replace": false }`.

- Dịch vụ chưa có trong kế hoạch: tự thêm vào (cùng quy tắc `POST /weddings/me/plan-items`, kể cả 409 `PLAN_CATEGORY_TAKEN` và `replace`).
- Dịch vụ đang `PLANNED` → chuyển `DISCUSSING`.
- Hội thoại mới: tạo kèm lời chào của NCC "Chào bạn! Mình là <tên>. Bạn cần tư vấn gói nào cho <hạng mục>?".

Response 200: `{ "data": Conversation }`

Lỗi: 404 `SERVICE_NOT_FOUND`, 409 `PLAN_CATEGORY_TAKEN`, 409 `PLAN_CATEGORY_LOCKED`

### GET /conversations/:id/messages
Toàn bộ tin, cũ trước. Response 200: `{ "data": Message[] }`

> Khi hội thoại dài cần phân trang ngược (`?before=<messageId>&limit=50`); bản nháp chưa cần.

Lỗi: 404 `CONVERSATION_NOT_FOUND`

### POST /conversations/:id/messages
Body `{ "text": "Cho mình hỏi giá bao nhiêu?" }`. Response 200: `{ "data": Message }`

Tin đầu tiên NCC chưa đọc tạo một thông báo cho NCC (bảng `notifications`, loại `NewMessage`); các tin tiếp theo khi NCC chưa đọc không báo thêm.

Lỗi: 400 `VALIDATION_ERROR` (tin rỗng), 404 `CONVERSATION_NOT_FOUND`

### POST /conversations/:id/read
Khách đã xem hội thoại: các tin của NCC thành đã đọc (`unreadCount = 0`). FE gọi khi mở khung chat hoặc trang Tin nhắn và khi có tin mới của NCC lúc đang mở. Response 200: `{ "data": null }`

`unreadCount` (tin NCC gửi mà khách chưa đọc) là số trên nút chat nổi và mục Tin nhắn trong menu tài khoản.

Lỗi: 404 `CONVERSATION_NOT_FOUND`

---

## Cập nhật tin mới

Chưa có thư viện websocket trong danh sách được dùng, nên FE **hỏi lại định kỳ** (2,5 giây) `GET /conversations` và `GET /conversations/:id/messages` khi đang mở trang Tin nhắn. Nếu sau này thêm websocket/SSE thì contract các endpoint trên giữ nguyên.

## Ghi chú về dữ liệu giả

NCC trong dữ liệu giả tự trả lời theo câu mẫu của prototype; nhắn có chữ "gửi đơn" hoặc "chốt" thì NCC tự gửi đơn; yêu cầu chỉnh sửa đơn thì NCC tự gửi lại đơn sau 2 giây. Các hành vi này **chỉ có trong mock** để thử luồng 7.3 khi chưa làm phía NCC; BE không làm.

---

# Phía Nhà cung cấp: tin nhắn

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/vendorChat.ts`). Phần này bổ sung, không đổi các endpoint phía cặp đôi ở trên.
> **Chờ đối chiếu `docs/database.md`**: tên trường và loại tin đang suy từ prototype NCC (`docs/prototype/prototype_vendor`, màn Tin nhắn).

Phạm vi: NCC xem hội thoại với các cặp đôi, nhắn tin, xem các sự kiện của đơn trong khung chat. Tạo, sửa, gửi lại đơn: xem [orders.md](orders.md) (phần Nhà cung cấp).

Role: **VENDOR**, chỉ hội thoại của NCC mình (của người khác trả `404`).

## Hội thoại và tin nhắn

Cùng bảng hội thoại / tin nhắn với phía cặp đôi. Mỗi hội thoại phía cặp đôi gắn với một dịch vụ (`service`); phía NCC nhìn thấy khách (`customer`).

`VendorConversation`

```json
{
  "id": "vc-4",
  "customer": { "name": "Minh Anh & Quốc Huy", "phone": "0901 234 567" },
  "interestPackage": { "id": "DV101", "name": "Tiệc cưới – Menu A", "price": 3500000, "maxPrice": 4500000 },
  "unreadCount": 2,
  "lastMessage": { "sender": "COUPLE", "type": "TEXT", "text": "Bên mình cập nhật giúp…", "orderVersion": null, "orderCode": null, "createdAt": "2026-10-18T00:51:00.000Z" },
  "latestOrder": { "id": "so-1025", "code": "#WP1025", "status": "REVISION_REQUESTED", "paymentStatus": "UNPAID" },
  "hasDraftOrder": false,
  "needsAction": true,
  "orderCodes": ["#WP1025"]
}
```

| Trường | Ghi chú |
|---|---|
| `customer.phone` | Số điện thoại tài khoản cặp đôi, NCC thấy để liên hệ |
| `interestPackage` | Gói của NCC trong kế hoạch của khách (gói trong đơn mới nhất, chưa có đơn thì gói rẻ nhất), kèm `imageUrl` ảnh bìa gói để hiện thẻ gói đầu hội thoại; `null` nếu NCC chưa có trong kế hoạch. Gói: xem [catalog.md](catalog.md) phần Nhà cung cấp |
| `latestOrder` | Đơn đã gửi mới nhất của hội thoại (bỏ qua bản nháp chưa gửi) |
| `needsAction` | Có ít nhất một đơn: có bản nháp, `status = REVISION_REQUESTED`, có `adjustmentRequest`, hoặc có phương án điều chỉnh `REVISION_REQUESTED`. Dùng cho tab "Cần xử lý" |
| `orderCodes` | Để FE tìm hội thoại theo mã đơn |

`VendorMessage`: như `Message` phía cặp đôi, thêm:

```json
{
  "id": "m-9",
  "conversationId": "vc-5",
  "sender": "SYSTEM",
  "type": "ORDER_RESENT",
  "text": "",
  "orderId": "so-1024",
  "orderVersion": 2,
  "adjustmentId": null,
  "changes": ["Tiệc cưới – Menu A: số lượng 25 → 22 Bàn", "Tổng tiền: 100.000.000đ → 92.200.000đ"],
  "createdAt": "2026-10-13T02:10:00.000Z"
}
```

| `type` | `sender` | Ý nghĩa | Trường kèm theo |
|---|---|---|---|
| `TEXT` | `COUPLE`, `VENDOR` | Tin chữ | `text` |
| `ORDER` | `VENDOR` | Thẻ đơn một phiên bản | `orderId`, `orderVersion` |
| `ORDER_RESENT` | `SYSTEM` | NCC cập nhật và gửi lại đơn | `orderId`, `orderVersion` (mới), `changes` |
| `ORDER_REVISION_REQUESTED` | `COUPLE` | Khách yêu cầu chỉnh sửa đơn | `orderId`, `orderVersion`, `text` (nội dung yêu cầu) |
| `ORDER_CONFIRMED` | `COUPLE` | Khách xác nhận đơn | `orderId`, `orderVersion` |
| `PAYMENT_RECORDED` | `SYSTEM` | Ghi nhận một khoản đã thu (cọc VNPay hoặc NCC ghi nhận) | `orderId`, `text` (câu hiển thị sẵn) |
| `ADJUSTMENT_PROPOSED` | `VENDOR` | NCC gửi phương án điều chỉnh | `orderId`, `adjustmentId` |
| `ADJUSTMENT_REQUESTED` | `COUPLE` | Khách đề nghị điều chỉnh đơn đã xác nhận | `orderId`, `text` |
| `ADJUSTMENT_REVISION_REQUESTED` | `COUPLE` | Khách yêu cầu sửa phương án điều chỉnh | `orderId`, `adjustmentId`, `text` |
| `ADJUSTMENT_ACCEPTED` | `COUPLE` | Khách đồng ý phương án, phiên bản mới có hiệu lực | `orderId`, `orderVersion` (mới) |
| `ORDER_CANCELLED` | `SYSTEM` | NCC hủy đơn (chỉ khi chưa có khoản thu); chỉ thêm khi đơn đã gửi khách | `orderId`, `text` (lý do hủy) |

Trường không dùng thì `null` (`text` thì chuỗi rỗng). Phía cặp đôi hiện chỉ hiểu `TEXT` và `ORDER`; khi phía cặp đôi chuyển sang đơn mới ([orders.md](orders.md)) thì dùng chung các loại tin này.

---

### GET /vendors/me/conversations
Role: VENDOR

Hội thoại của NCC, tin cuối mới nhất trước. Không phân trang (bản nháp; khi nhiều thì thêm `page`, `pageSize`). Tìm theo tên, số điện thoại, mã đơn và lọc tab làm ở FE.

Response 200: `{ "data": VendorConversation[] }`

### GET /vendors/me/conversations/:id/messages
Role: VENDOR

Toàn bộ tin, cũ trước. Response 200: `{ "data": VendorMessage[] }`

Lỗi: 404 `CONVERSATION_NOT_FOUND`

### POST /vendors/me/conversations/:id/messages
Role: VENDOR

Body `{ "text": "Dạ bên em đã nhận được ạ." }`. Response 200: `{ "data": VendorMessage }` (`type = TEXT`, `sender = VENDOR`)

Lỗi: 400 `VALIDATION_ERROR` (tin rỗng), 404 `CONVERSATION_NOT_FOUND`

### POST /vendors/me/conversations/:id/read
Role: VENDOR

Đánh dấu đã đọc (`unreadCount = 0`). FE gọi khi mở hội thoại và khi có tin mới lúc đang mở. Response 200: `{ "data": null }`

Lỗi: 404 `CONVERSATION_NOT_FOUND`

## Cập nhật tin mới (phía NCC)

Như phía cặp đôi: FE hỏi lại mỗi 2,5 giây `GET /vendors/me/conversations`, tin của hội thoại đang mở và `GET /vendors/me/orders?conversationId=` khi đang ở trang Tin nhắn.

## Ghi chú về dữ liệu giả (phía NCC)

`mocks/vendorChat.ts` tách riêng với `mocks/chat.ts` của phía cặp đôi (hai bên chưa thấy tin của nhau khi dùng mock). Khi `VITE_USE_MOCK=true`, khung chat có nút **Giả lập khách** (nhắn tin, xác nhận đơn, yêu cầu chỉnh sửa, đặt cọc VNPay, yêu cầu điều chỉnh, đồng ý / yêu cầu sửa phương án) trên đơn mới nhất của hội thoại. Nút này **chỉ có trong mock**; BE không làm.

## Cần chốt (phía NCC)

1. Gửi ảnh / tệp trong chat (prototype có nút đính kèm): có làm không, dùng upload Cloudinary như hồ sơ NCC.
2. `customer.phone`: có cho NCC thấy số điện thoại cặp đôi trước khi có đơn không.
