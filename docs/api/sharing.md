# API: sharing (link xem kế hoạch công khai)

> Quy ước chung: [README.md](README.md). Đặc tả: [KE_HOACH_KE_HOACH_CUA_TOI.md](../KE_HOACH_KE_HOACH_CUA_TOI.md) P7. Code: `backend/src/modules/wedding-sharing/`.
> Bảng: `wedding_share_links` (`backend/prisma/manual/2026-10-30-02-share-links.sql`). Chưa chạy file SQL này thì mọi endpoint dưới đây trả 503 `DB_MIGRATION_PENDING`.

Chỉ có **link xem** (chỉ đọc). Không có lời mời cùng lập kế hoạch, không có thành viên hay phân quyền (bỏ 02/11/2026): mỗi tài khoản cặp đôi có đúng một kế hoạch của mình.

**Mã trong link** = HMAC-SHA256(`SHARE_TOKEN_SECRET`, `"share:"` + id dòng), dạng base64url 43 ký tự. DB chỉ lưu SHA-256 của mã; backend dựng lại được mã từ id nên cặp đôi sao chép lại link bất cứ lúc nào. Không đặt `SHARE_TOKEN_SECRET` thì dùng `JWT_SECRET` (đổi khóa thì mọi link cũ hết hiệu lực).

API trả `token` và `path` (`/xem/<token>`); FE ghép thành link đầy đủ theo địa chỉ trang đang mở.

---

## 1. Quản lý link xem

Role **COUPLE**, luôn làm trên đám cưới của chính mình. Chưa có đám cưới: 409 `WEDDING_NOT_SET`.

`ShareLink`: `{ "enabled": true, "tabs": ["overview", "timeline", "services"], "token": "…", "path": "/xem/…", "updatedDate": "…" }`. Chưa tạo thì `token`, `path`, `updatedDate` là `null`, `enabled: false`.

### GET /weddings/me/share-link
Response 200: `ShareLink`.

### PUT /weddings/me/share-link
Body `{ "enabled"?: boolean, "tabs"?: PlanTab[] }` (ít nhất 1 tab; mặc định Tổng quan, Timeline, Dịch vụ). Tab nào cũng tắt được, kể cả Tổng quan. Chưa có link thì tạo (mặc định bật). Response 200: `ShareLink`. Lỗi: 400 `VALIDATION_ERROR`.

`PlanTab`: `overview`, `timeline`, `services`, `budget`, `guests`.

### POST /weddings/me/share-link/regenerate
Tạo mã mới, giữ trạng thái bật/tắt và tab. Link cũ trả 404 ngay. Response 201: `ShareLink`.

---

## 2. Xem công khai (không cần đăng nhập)

Giới hạn 60 lần/phút (`GET :token`) và 120 lần/phút (`GET :token/:tab`) mỗi IP (429 `RATE_LIMITED`). Link không có, đang tắt hoặc đã tạo lại: 404 `SHARE_LINK_NOT_FOUND`.

### GET /public/plans/:token
```json
{
  "wedding": { "groomName": "Huy", "brideName": "Hà", "date": "2027-05-01" },
  "tabs": ["overview", "services"]
}
```

### GET /public/plans/:token/:tab
`tab` không được chia sẻ: 404 `SHARE_TAB_NOT_FOUND`. Dữ liệu lọc ở backend:

| Tab | Dữ liệu |
|---|---|
| `overview` | Như `GET /weddings/me/overview`; phần của tab không được chia sẻ là `null` |
| `timeline` | `{ items }` như `GET /weddings/me/timeline`, **bỏ ghi chú** (`note: null`) |
| `services` | `{ categorySlugs, items: [{ id, service, status, packageName, price }] }`; không có đơn, gói đổi được. `price` là `null` khi tab Ngân sách không được chia sẻ |
| `budget` | Như `GET /weddings/me/budget`, không có `version` |
| `guests` | Như `GET /weddings/me/guests` |

Không bao giờ trả: tin nhắn, đơn hàng, thanh toán, email, ghi chú việc.

FE: trang `/xem/:token/:tab`, khung riêng (đầu trang chỉ có Đăng nhập, Đăng ký), banner "Bạn đang xem kế hoạch này qua liên kết chia sẻ".
