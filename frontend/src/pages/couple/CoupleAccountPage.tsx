import { AccountSettings } from '@/features/auth/components/AccountSettings'

/** Tài khoản của tôi (cặp đôi): sửa họ tên, tên đăng nhập, số điện thoại; đổi email và mật khẩu. Cùng khung với trang của Admin. */
export default function CoupleAccountPage() {
  return (
    <div className="pt-6">
      <AccountSettings
        nameLabel="Họ và tên"
        editablePhone
        infoNote="Thông tin đăng nhập của bạn. Số điện thoại giúp nhà cung cấp liên hệ khi cần. Đổi email cần mật khẩu hiện tại và mã xác minh gửi tới email mới."
        passwordNote="Dùng mật khẩu mạnh, không dùng lại mật khẩu của tài khoản khác và đổi ngay khi nghi bị lộ."
      />
    </div>
  )
}
