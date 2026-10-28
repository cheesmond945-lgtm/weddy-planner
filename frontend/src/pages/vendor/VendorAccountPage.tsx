import { AccountSettings } from '@/features/auth/components/AccountSettings'

/** Tài khoản của tôi (NCC): tự đổi email (mật khẩu + mã xác minh); đổi SĐT hoặc mất email cũ thì liên hệ Admin; nên đổi mật khẩu được gửi qua email ở lần đăng nhập đầu. */
export default function VendorAccountPage() {
  return (
    <AccountSettings
      nameLabel="Người liên hệ"
      infoNote="Tự đổi email đăng nhập bằng mật khẩu và mã xác minh gửi tới email mới. Cần đổi số điện thoại, hoặc mất cả email lẫn mật khẩu, vui lòng liên hệ quản trị viên WebPlan."
      passwordNote="Nên đổi mật khẩu được gửi qua email ngay lần đăng nhập đầu tiên. Không dùng lại mật khẩu của tài khoản khác."
    />
  )
}
