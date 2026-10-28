/**
 * Quy tắc mật khẩu khi tự đặt (đổi mật khẩu). Cùng bộ quy tắc với backend (backend/src/modules/auth/password-policy.ts);
 * ở đây dùng để hiện danh sách đạt / chưa đạt ngay khi gõ, backend vẫn kiểm tra lại.
 */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 64

export interface PasswordOwner {
  username?: string | null
  email?: string | null
  phone?: string | null
}

const personalParts = (o: PasswordOwner) =>
  [o.username, o.email?.split('@')[0], o.phone].map((x) => x?.trim().toLowerCase()).filter((x): x is string => !!x && x.length >= 4)

export const PASSWORD_RULES: { id: string; label: string; ok: (pw: string, owner: PasswordOwner) => boolean }[] = [
  { id: 'length', label: `Từ ${PASSWORD_MIN} đến ${PASSWORD_MAX} ký tự`, ok: (pw) => pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX },
  { id: 'case', label: 'Có chữ hoa và chữ thường', ok: (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
  { id: 'digit', label: 'Có ít nhất 1 chữ số', ok: (pw) => /\d/.test(pw) },
  { id: 'special', label: 'Có ít nhất 1 ký tự đặc biệt (vd ! @ # $ %)', ok: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
  { id: 'space', label: 'Không có khoảng trắng', ok: (pw) => !!pw && !/\s/.test(pw) },
  { id: 'personal', label: 'Không chứa tên đăng nhập, email hoặc số điện thoại', ok: (pw, o) => !!pw && !personalParts(o).some((x) => pw.toLowerCase().includes(x)) },
]

export const passwordValid = (pw: string, owner: PasswordOwner) => PASSWORD_RULES.every((r) => r.ok(pw, owner))
