# API: auth

> **Bản nháp** (FE đã làm theo bằng dữ liệu giả, `frontend/src/mocks/auth.ts`).
> Quy ước chung: [README.md](README.md).
> **Chờ đối chiếu `docs/database.md`:** tên trường người dùng (`name`, `email`, `phone`) và giá trị `role` đang suy từ prototype.

Phạm vi: đăng ký cặp đôi có OTP gửi qua email, đăng nhập (mọi role), xem/sửa thông tin cá nhân.
Chưa có: NCC đặt mật khẩu lần đầu, quên mật khẩu (làm khi tới phần NCC/Admin).

## Đối tượng dùng chung

`User`

```json
{
  "id": "8f0c…",
  "name": "Nguyễn Minh Anh",
  "email": "minh.anh@example.com",
  "phone": "0901234567",
  "role": "COUPLE"
}
```

`Session` = `{ "accessToken": "<JWT>", "user": User }`

`OtpSent`

```json
{ "email": "ngoc@example.com", "expiresIn": 300, "resendAfter": 60 }
```

`expiresIn`: số giây OTP còn hiệu lực. `resendAfter`: số giây phải chờ trước khi được gửi lại.

## Quy tắc dữ liệu

| Trường | Quy tắc |
|---|---|
| `name` | Bắt buộc, cắt khoảng trắng hai đầu |
| `phone` | **Không bắt buộc**, không có ở form đăng ký (cặp đôi bổ sung ở Thông tin cá nhân). Nếu có: 10 số, bắt đầu bằng `0` (`^0\d{9}$`), duy nhất |
| `email` | Email hợp lệ, lưu chữ thường. Duy nhất |
| `password` | Tối thiểu 6 ký tự. BE lưu dạng băm, không bao giờ trả về |
| `otp` | 6 chữ số. Hiệu lực 5 phút, sai tối đa 5 lần, gửi lại sau 60 giây |

---

### POST /auth/register
Role: Public

Bước 1 của đăng ký: kiểm tra trùng, lưu đăng ký tạm, gửi OTP về `email`. **Chưa tạo tài khoản.**
Gọi lại với cùng `email` khi đang chờ OTP: thay thông tin đăng ký cũ và gửi mã mới (vẫn tôn trọng thời gian chờ gửi lại).

Request

```json
{ "name": "Trần Bảo Ngọc", "email": "ngoc@example.com", "password": "abcdef" }
```

`phone` không còn trong form đăng ký. BE vẫn nhận nếu được gửi (kiểm tra định dạng và trùng như PATCH /auth/me), không gửi thì lưu `null`.

Response 200

```json
{ "data": { "email": "ngoc@example.com", "expiresIn": 300, "resendAfter": 60 } }
```

Lỗi: 400 `VALIDATION_ERROR`, 409 `PHONE_ALREADY_EXISTS`, 409 `EMAIL_ALREADY_EXISTS`, 429 `OTP_RESEND_TOO_SOON`

### POST /auth/register/resend-otp
Role: Public

Request

```json
{ "email": "ngoc@example.com" }
```

Response 200: `{ "data": OtpSent }`. Gửi mã mới, mã cũ hết hiệu lực, đặt lại số lần nhập sai.

Lỗi: 404 `REGISTRATION_NOT_FOUND` (không có hoặc đăng ký tạm đã hết hạn), 429 `OTP_RESEND_TOO_SOON`

### POST /auth/register/verify-otp
Role: Public

Bước 2: OTP đúng thì tạo tài khoản role cặp đôi và đăng nhập luôn.

Request

```json
{ "email": "ngoc@example.com", "otp": "123456" }
```

Response 200

```json
{
  "data": {
    "accessToken": "eyJhbGciOi…",
    "user": { "id": "…", "name": "Trần Bảo Ngọc", "email": "ngoc@example.com", "phone": null, "role": "COUPLE" }
  }
}
```

Lỗi: 400 `OTP_INVALID`, 400 `OTP_EXPIRED`, 404 `REGISTRATION_NOT_FOUND`, 429 `OTP_TOO_MANY_ATTEMPTS`

### POST /auth/login
Role: Public

Đăng nhập bằng email **hoặc** số điện thoại. Dùng cho cả cặp đôi, NCC, Admin; FE chuyển trang theo `user.role`.

Request

```json
{ "identifier": "minh.anh@example.com", "password": "123456" }
```

Response 200: `{ "data": Session }`

Lỗi: 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS` (không nói rõ sai tài khoản hay sai mật khẩu), 403 `ACCOUNT_DISABLED`

### GET /auth/me
Role: Đã đăng nhập

Response 200: `{ "data": User }`

Lỗi: 401 `UNAUTHORIZED`, 401 `TOKEN_INVALID`

### PATCH /auth/me
Role: Đã đăng nhập

Sửa thông tin cá nhân (mã 1.3 trong prototype). Gửi đủ 3 trường; để trống thì gửi `null`.

Request

```json
{ "name": "Minh Anh Nguyễn", "email": "minh.anh@example.com", "phone": "0911111111" }
```

Response 200: `{ "data": User }`

Lỗi: 400 `VALIDATION_ERROR`, 401 `TOKEN_INVALID`, 409 `PHONE_ALREADY_EXISTS`, 409 `EMAIL_ALREADY_EXISTS`

---

## Ghi chú cho BE

- JWT payload: `{ sub: user.id, role }`. Thời hạn đọc từ `JWT_EXPIRES_IN`.
- Gửi OTP qua `integrations/mail`. Khi dev chưa cấu hình mail: ghi mã OTP ra log.
- Số điện thoại vẫn bắt buộc và duy nhất (dùng để đăng nhập) nhưng **không xác thực** bằng OTP.
- OTP lưu dạng băm, kèm thời hạn và số lần sai. Đăng ký tạm tự hết hạn.
- Chặn gửi OTP dồn dập theo email và theo IP (429).

## Cần chốt

1. Sửa email ở PATCH /auth/me: hiện cho sửa thẳng như prototype. Email đã xác thực bằng OTP lúc đăng ký, đổi email có cần xác thực OTP lại không?
2. Tên trường và giá trị role theo `docs/database.md`.
