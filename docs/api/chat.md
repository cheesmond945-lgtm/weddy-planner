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
