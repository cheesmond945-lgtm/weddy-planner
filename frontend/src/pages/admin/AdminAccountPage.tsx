import { AccountSettings } from '@/features/auth/components/AccountSettings'

/** Tài khoản của tôi (Admin): xem thông tin đăng nhập và đổi mật khẩu. */
export default function AdminAccountPage() {
  return (
    <AccountSettings
      nameLabel="Họ tên"
      infoNote="Thông tin đăng nhập của tài khoản quản trị. Đổi email cần mật khẩu hiện tại và mã xác minh gửi tới email mới."
      passwordNote="Tài khoản quản trị có toàn quyền trên hệ thống: dùng mật khẩu mạnh, không dùng lại mật khẩu của tài khoản khác và đổi ngay khi nghi bị lộ."
    />
  )
}
