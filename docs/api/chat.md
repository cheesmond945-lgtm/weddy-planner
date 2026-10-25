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

Lỗi: 400 `VALIDATION_ERROR` (tin rỗng), 404 `CONVERSATION_NOT_FOUND`

---

## Cập nhật tin mới

Chưa có thư viện websocket trong danh sách được dùng, nên FE **hỏi lại định kỳ** (2,5 giây) `GET /conversations` và `GET /conversations/:id/messages` khi đang mở trang Tin nhắn. Nếu sau này thêm websocket/SSE thì contract các endpoint trên giữ nguyên.

## Ghi chú về dữ liệu giả

NCC trong dữ liệu giả tự trả lời theo câu mẫu của prototype; nhắn có chữ "gửi đơn" hoặc "chốt" thì NCC tự gửi đơn; yêu cầu chỉnh sửa đơn thì NCC tự gửi lại đơn sau 2 giây. Các hành vi này **chỉ có trong mock** để thử luồng 7.3 khi chưa làm phía NCC; BE không làm.

---

# Phía Nhà cung cấp: tin nhắn

> **Hợp đồng theo CSDL** (`docs/database.md` mục 4.17, 4.18, 9.4) và `docs/CHOT_NGHIEP_VU_NCC.md` mục 3 và 5. Thẻ đơn và các tin liên quan đơn: [THE_DON_HANG.md](THE_DON_HANG.md) và [orders.md](orders.md) (phần NCC).
> Quy ước chung: [README.md](README.md). Role: **VENDOR**.

Cùng bảng `Conversations` / `Messages` với phía cặp đôi: mỗi cặp (khách, NCC) một hội thoại. Phía NCC nhìn thấy khách (`customer`).

## Kiểu dữ liệu

### `VendorConversation`

```json
{
  "id": "fb9cffdf-…",
  "customer": { "name": "Minh Anh & Quốc Huy", "phone": "0901 234 567" },
  "unreadCount": 2,
  "lastMessage": { "sender": "COUPLE", "type": "Text", "content": "Bên mình cập nhật giúp…", "orderCode": null, "sentDate": "2026-10-18T00:51:00.000Z" },
  "latestOrder": { "id": "5d1c8b1e-…", "orderCode": "DH26100003", "status": "NeedRevision" },
  "hasDraftOrder": false,
  "needsAction": true,
  "orderCodes": ["DH26100003"]
}
```

| Trường | Ghi chú |
|---|---|
| `customer.name` | "Chú rể & Cô dâu" (`Weddings.GroomName` & `BrideName`); khách chưa có thông tin đám cưới thì `Users.FullName`. FE điền sẵn vào đơn |
| `customer.phone` | `Users.PhoneNumber`, chuỗi rỗng nếu khách chưa nhập. FE điền sẵn vào đơn, NCC sửa hoặc tự nhập được |
| `customer.online` | **Tùy chọn.** Chỉ có khi backend có dữ liệu trạng thái trực tuyến thật; không có thì FE không hiện chấm xanh và "Trực tuyến" |
| `lastMessage` | Tin gần nhất (kể cả tin hệ thống); `orderCode` có với tin liên quan đơn |
| `latestOrder` | Đơn **đã gửi** mới nhất của hội thoại (bỏ qua bản nháp): mọi trạng thái trừ `Draft`. Dùng cho nhãn trạng thái và nút "Xem đơn" |
| `hasDraftOrder` | Có đơn `Draft` |
| `needsAction` | Cần NCC xử lý: có đơn `Draft`, `NeedRevision`, đơn `Deposited` có yêu cầu sửa sau cọc đang `Requested`, hoặc đơn `Deposited` đã qua `eventDate` (chờ đánh dấu hoàn thành) |
| `orderCodes` | Mã mọi đơn của hội thoại, để tìm theo mã đơn |

Nhãn trạng thái trong danh sách hội thoại (FE suy từ `latestOrder.status`): `Pending` Chờ khách xác nhận (hạn cọc còn), `NeedRevision` Cần sửa, `Deposited` Đã cọc, `Completed` Hoàn thành, `Expired` Hết hạn, `Cancelled` Đã hủy; chỉ có bản nháp thì "Bản nháp".

### `VendorMessage`

```json
{
  "id": "…",
  "conversationId": "fb9cffdf-…",
  "sender": "VENDOR",
  "type": "Order",
  "orderId": "5d1c8b1e-…",
  "content": "Đơn dịch vụ DH26100004",
  "isRead": true,
  "sentDate": "2026-10-25T07:30:00.000Z"
}
```

- `sender`: `COUPLE`, `VENDOR`, `SYSTEM` (`Messages.SenderId` rỗng).
- `type` (`Messages.Type`) **chỉ có 4 giá trị**:

| `type` | Khi nào | Hiển thị |
|---|---|---|
| `Text` | Tin nhắn thường, và tin hệ thống | Bong bóng (tin hệ thống: dòng nhỏ ở giữa, nền xanh nhạt) |
| `Order` | NCC gửi hoặc gửi lại đơn, hoặc sửa đơn sau cọc | Thẻ đơn (đọc dữ liệu trực tiếp từ `Orders`, không phải bản chụp). `orderId` bắt buộc |
| `DepositReceipt` | Cọc thành công | Thẻ "Giấy xác nhận cọc {mã}: đã nhận … cho đơn …" kèm nút Xem. `orderId` bắt buộc |
| `FinalInvoice` | NCC xuất hóa đơn cuối | Thẻ "Hóa đơn {mã} cho đơn …" kèm nút Xem. `orderId` bắt buộc |

- Các tin hệ thống (`sender = SYSTEM`, `type = Text`): khách yêu cầu chỉnh sửa đơn (kèm nội dung và lời nhắn), đơn hết hạn đặt cọc, khách hủy đơn, đơn hoàn thành.
- Bản nháp đơn **không** tạo tin; khách không thấy.
- Gửi lại đơn tạo thêm một thẻ `Order` mới; FE thu gọn các thẻ cũ của cùng đơn thành "Đơn … đã được cập nhật, xem bản mới nhất bên dưới".
- Để vẽ thẻ, FE lấy đơn qua `GET /vendors/me/orders?conversationId=…`.

## Endpoint

### GET /vendors/me/conversations
Hội thoại của NCC, mới nhất trước (`Conversations.LastMessageDate`). Response 200: `{ "data": VendorConversation[] }`

### GET /vendors/me/conversations/:id/messages
Tin nhắn của hội thoại, cũ nhất trước. Response 200: `{ "data": VendorMessage[] }`. Lỗi: 404 `CONVERSATION_NOT_FOUND`.

### POST /vendors/me/conversations/:id/messages
NCC gửi tin nhắn văn bản. Request: `{ "text": "…" }` (không rỗng). Response 201: `{ "data": VendorMessage }`. Lỗi: 400 `VALIDATION_ERROR`, 404.

### POST /vendors/me/conversations/:id/read
Đánh dấu đã đọc mọi tin của khách (`unreadCount` về 0). Response 204.

## Cập nhật tin mới

Chưa có websocket: FE hỏi lại định kỳ (2,5 giây khi đang mở trang Tin nhắn, 15 giây cho số chưa đọc trên sidebar).

## Ghi chú về dữ liệu giả

`frontend/src/mocks/vendorOrders.ts` mô phỏng đúng các quy tắc trên (tính tiền, hạn cọc, hết hạn, tự hoàn thành, hoa hồng, hóa đơn). Nút **"Giả lập khách"** (đặt cọc, yêu cầu chỉnh sửa trước hoặc sau cọc, hủy sau cọc, nhắn tin) và **"Giả lập thời gian"** (tua nhanh để thử hết hạn, hoàn thành) **chỉ có khi dùng dữ liệu giả**, không nằm trong hợp đồng.

## Cần chốt (phía NCC)

1. Gửi ảnh / tệp trong chat (prototype có nút đính kèm): có làm không.
2. Trạng thái trực tuyến của khách: chưa có dữ liệu, nên giao diện đang ẩn. Cần chốt có làm (websocket / presence) không.
3. `OrderRevisionChanges.ChangeType`: danh sách đầy đủ (hiện: `Item`, `Quantity`, `EventDate`, `Other`).
