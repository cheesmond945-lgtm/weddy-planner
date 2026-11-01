# API: sharing (chia sẻ kế hoạch: lời mời và link xem công khai)

> Quy ước chung: [README.md](README.md). Quyền thành viên: [weddings.md](weddings.md) mục 5. Đặc tả: [KE_HOACH_KE_HOACH_CUA_TOI.md](../KE_HOACH_KE_HOACH_CUA_TOI.md) P7.
> Bảng: `wedding_invites`, `wedding_share_links` (`backend/prisma/manual/2026-10-30-02-invites-share.sql`). Chưa chạy file SQL này thì mọi endpoint dưới đây trả 503 `DB_MIGRATION_PENDING`.

**Mã trong link** = HMAC-SHA256(`SHARE_TOKEN_SECRET`, loại + id dòng), dạng base64url 43 ký tự. DB chỉ lưu SHA-256 của mã; backend dựng lại được mã từ id nên chủ kế hoạch sao chép lại link bất cứ lúc nào. Không đặt `SHARE_TOKEN_SECRET` thì dùng `JWT_SECRET` (đổi khóa thì mọi link cũ hết hiệu lực).

API trả `token` và `path` (`/moi/<token>`, `/xem/<token>`); FE ghép thành link đầy đủ theo địa chỉ trang đang mở.

---

## 1. Lời mời (chỉ owner)

Role COUPLE, quyền **owner** (editor, viewer nhận 403 `WEDDING_FORBIDDEN` / `WEDDING_READ_ONLY`).

`Invite`

```json
{
  "id": "…", "token": "…", "path": "/moi/…",
  "relation": "RELATIVE", "displayName": "Mẹ cô dâu", "role": "VIEWER",
  "tabs": ["overview", "timeline", "services"],
  "expiresDate": "2026-11-13T08:00:00.000Z", "createdDate": "…"
}
```

### GET /weddings/me/invites
Link đang chờ (chưa dùng, chưa thu hồi, chưa hết hạn), mới nhất trước. Response 200: `Invite[]`.

### POST /weddings/me/invites
Body `{ "relation": "BRIDE" | "GROOM" | "RELATIVE", "displayName"?: "…" (≤ 40 ký tự), "role"?: "EDITOR" | "VIEWER", "tabs"?: PlanTab[] }`.

- Mặc định: Cô dâu, Chú rể là `EDITOR` và xem cả 5 tab; Người thân là `VIEWER` và xem Tổng quan, Timeline, Dịch vụ.
- `tabs`: tab nào cũng tắt được, miễn còn ít nhất 1.
- Link hết hạn sau 14 ngày. Tối đa 10 link đang chờ.

Response 201: `Invite`. Lỗi: 400 `VALIDATION_ERROR`, 409 `INVITE_LIMIT`.

### DELETE /weddings/me/invites/:id
Thu hồi. Response 200: `null`. Lỗi: 404 `INVITE_NOT_FOUND`.

---

## 2. Người nhận lời mời

### GET /invites/:token
Không cần đăng nhập. Giới hạn 30 lần/phút mỗi IP (429 `RATE_LIMITED`).

```json
{
  "status": "VALID",
  "wedding": { "groomName": "Huy", "brideName": "Hà", "date": "2027-05-01" },
  "inviterName": "Nguyễn Văn Huy",
  "relation": "RELATIVE", "displayName": "Mẹ cô dâu", "role": "VIEWER",
  "tabs": ["overview", "timeline", "services"],
  "expiresDate": "…"
}
```

`status`: `VALID`, `USED`, `REVOKED`, `EXPIRED`. Mã sai hoặc không tồn tại: 404 `INVITE_NOT_FOUND`.

### POST /invites/:token/accept
Role **COUPLE** (tài khoản NCC, Admin nhận 403). Body `{ "leaveOwnPlan"?: boolean }`. Response 201: `{ "weddingId": "…", "joined": true }`. Đã là thành viên của đúng đám cưới này: `joined: false`, không đổi gì.

Người nhận đang có kế hoạch riêng:

| Trường hợp | Kết quả |
|---|---|
| Là thành viên (không phải owner) của kế hoạch khác | 409 `ALREADY_MEMBER`: phải rời kế hoạch đó trước |
| Owner của kế hoạch đã có hội thoại, đơn hoặc người cùng lập | 409 `ALREADY_IN_WEDDING` |
| Owner của kế hoạch còn trống, `leaveOwnPlan` không gửi | 409 `OWN_PLAN_EXISTS` (`details.canLeave = true`): FE hỏi "Bỏ kế hoạch riêng để tham gia?" |
| Như trên, `leaveOwnPlan: true` | Xóa kế hoạch riêng (thông tin, timeline, dịch vụ đã chọn, khách, ngân sách) rồi nhận lời mời |

Lời mời đã dùng, thu hồi, hết hạn: 410 `INVITE_USED`, `INVITE_REVOKED`, `INVITE_EXPIRED`. Hai người nhận cùng lúc thì chỉ một người thành công.

FE: trang `/moi/:token`. Chưa đăng nhập thì đăng nhập hoặc đăng ký rồi quay lại trang này (bỏ qua hộp thiết lập đám cưới) và tự nhận lời mời.

---

## 3. Link xem công khai (chỉ owner)

`ShareLink`: `{ "enabled": true, "tabs": ["overview", "timeline", "services"], "token": "…", "path": "/xem/…", "updatedDate": "…" }`. Chưa tạo thì `token`, `path` là `null`, `enabled: false`.

### GET /weddings/me/share-link
Response 200: `ShareLink`.

### PUT /weddings/me/share-link
Body `{ "enabled"?: boolean, "tabs"?: PlanTab[] }` (ít nhất 1 tab; mặc định Tổng quan, Timeline, Dịch vụ). Chưa có link thì tạo (mặc định bật). Response 200: `ShareLink`. Lỗi: 400 `VALIDATION_ERROR`.

### POST /weddings/me/share-link/regenerate
Tạo mã mới, giữ trạng thái bật/tắt và tab. Link cũ trả 404 ngay. Response 201: `ShareLink`.

---

## 4. Xem công khai (không cần đăng nhập)

Giới hạn 60 lần/phút (`GET :token`) và 120 lần/phút (`GET :token/:tab`) mỗi IP. Link không có, đang tắt hoặc đã tạo lại: 404 `SHARE_LINK_NOT_FOUND`.

### GET /public/plans/:token
```json
{
  "wedding": { "groomName": "Huy", "brideName": "Hà", "date": "2027-05-01" },
  "tabs": ["overview", "services"],
  "members": [{ "name": "Nguyễn Văn Huy", "role": "OWNER" }, { "name": "Mẹ cô dâu", "role": "VIEWER" }]
}
```
Thành viên chỉ có tên và vai trò (không email).

### GET /public/plans/:token/:tab
`tab` không được chia sẻ: 404 `SHARE_TAB_NOT_FOUND`. Dữ liệu lọc ở backend:

| Tab | Dữ liệu |
|---|---|
| `overview` | Như `GET /weddings/me/overview`; phần của tab không được chia sẻ là `null` |
| `timeline` | Như `GET /weddings/me/timeline`, **bỏ ghi chú** (`note: null`) |
| `services` | `{ categorySlugs, items: [{ id, service, status, packageName, price }] }`; không có đơn, gói đổi được. `price` là `null` khi tab Ngân sách không được chia sẻ |
| `budget` | Như `GET /weddings/me/budget`, không có `version` |
| `guests` | Như `GET /weddings/me/guests` |

Không bao giờ trả: tin nhắn, đơn hàng, thanh toán, email thành viên, ghi chú việc.

FE: trang `/xem/:token/:tab`, khung riêng (đầu trang chỉ có Đăng nhập, Đăng ký), banner "Bạn đang xem kế hoạch này qua liên kết chia sẻ".
