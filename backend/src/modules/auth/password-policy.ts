/**
 * Quy tắc mật khẩu khi người dùng tự đặt (đổi mật khẩu), theo thực tế các hệ thống (OWASP / NIST, app ngân hàng, sàn TMĐT):
 * 8-64 ký tự, có chữ hoa, chữ thường, chữ số, ký tự đặc biệt, không có khoảng trắng,
 * không chứa tên đăng nhập, phần trước @ của email hoặc số điện thoại. Frontend kiểm tra cùng bộ quy tắc
 * (frontend/src/features/auth/passwordRules.ts) để hiện danh sách đạt / chưa đạt khi gõ.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

export function passwordProblem(pw: string, owner: { username?: string | null; email?: string | null; phone?: string | null }): string | null {
  if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX) return `Mật khẩu cần từ ${PASSWORD_MIN} đến ${PASSWORD_MAX} ký tự.`;
  if (/\s/.test(pw)) return 'Mật khẩu không được chứa khoảng trắng.';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return 'Mật khẩu cần có cả chữ hoa và chữ thường.';
  if (!/\d/.test(pw)) return 'Mật khẩu cần có ít nhất 1 chữ số.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Mật khẩu cần có ít nhất 1 ký tự đặc biệt (vd ! @ # $ %).';
  const lower = pw.toLowerCase();
  const personal = [owner.username, owner.email?.split('@')[0], owner.phone].map((x) => x?.trim().toLowerCase()).filter((x): x is string => !!x && x.length >= 4);
  if (personal.some((x) => lower.includes(x))) return 'Mật khẩu không được chứa tên đăng nhập, email hoặc số điện thoại.';
  return null;
}
