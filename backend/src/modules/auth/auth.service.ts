import { HttpException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../integrations/mail/mail.service';
import { registerOtpEmail, resetPasswordOtpEmail } from '../../integrations/mail/templates';

const ROLE_MAP: Record<string, 'COUPLE' | 'VENDOR' | 'ADMIN'> = { Couple: 'COUPLE', Vendor: 'VENDOR', Admin: 'ADMIN' };

type UserRow = { id: string; full_name: string; email: string; phone_number: string | null; role: string };

// Dạng người dùng frontend cần (docs/api/auth.md)
const toSessionUser = (u: UserRow) => ({
  id: u.id,
  name: u.full_name,
  email: u.email,
  phone: u.phone_number,
  role: ROLE_MAP[u.role] ?? 'COUPLE',
});

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const PHONE_RE = /^0\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MS = 5 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;

/** Một mã OTP đang chờ nhập (đăng ký hoặc đặt lại mật khẩu). */
interface PendingOtp {
  name: string;
  otpHash: string;
  expiresAt: number;
  resendAt: number;
  attempts: number;
}

interface PendingRegistration extends PendingOtp {
  /** Không bắt buộc khi đăng ký (form đăng ký đã bỏ ô số điện thoại); cặp đôi bổ sung sau ở hồ sơ */
  phone: string | null;
  passwordHash: string;
}

interface PendingReset extends PendingOtp {
  userId: string;
}

type OtpKind = 'register' | 'reset';

const hashOtp = (key: string, otp: string) => createHash('sha256').update(`${key}:${otp}`).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Đăng ký chờ xác thực OTP (lưu trong bộ nhớ, tự hết hạn; khởi động lại backend thì mất). */
  private readonly pending = new Map<string, PendingRegistration>();
  /** Yêu cầu đặt lại mật khẩu chờ nhập OTP, theo email (cũng chỉ lưu trong bộ nhớ). */
  private readonly resets = new Map<string, PendingReset>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  private session(user: UserRow & { username: string }) {
    const accessToken = this.jwt.sign({ sub: user.id, username: user.username, role: user.role });
    return { accessToken, user: toSessionUser(user) };
  }

  /** Đăng nhập bằng username, email hoặc số điện thoại. Mật khẩu dữ liệu mẫu: Everly@2026 */
  async login(identifier: string, password: string) {
    const user = await this.prisma.users.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }, { phone_number: identifier }] },
    });
    // Hash trong CSDL tạo bằng pgcrypto crypt(..., gen_salt('bf')) => tương thích bcryptjs
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return fail('INVALID_CREDENTIALS', 'Sai tài khoản hoặc mật khẩu.', 401);
    }
    if (user.status === 'Locked') return fail('ACCOUNT_DISABLED', 'Tài khoản đã bị khóa.', 403);

    await this.prisma.users.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    return this.session(user);
  }

  async me(userId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) return fail('UNAUTHORIZED', 'Chưa đăng nhập.', 401);
    return toSessionUser(user);
  }

  // ---------- Đăng ký cặp đôi có OTP ----------

  private sweep() {
    const now = Date.now();
    for (const map of [this.pending, this.resets]) {
      for (const [email, p] of map) if (p.expiresAt + 10 * 60_000 < now) map.delete(email);
    }
  }

  /**
   * Tạo mã mới (đăng ký tạm hoặc đặt lại mật khẩu) và gửi về email (integrations/mail).
   * Chưa cấu hình mail hoặc gửi lỗi: ghi mã ra log của backend để dev vẫn thử được (docs/api/auth.md, Ghi chú cho BE).
   */
  private async issueOtp(email: string, p: PendingOtp, kind: OtpKind) {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    p.otpHash = hashOtp(`${kind}:${email}`, otp);
    p.expiresAt = Date.now() + OTP_TTL_MS;
    p.resendAt = Date.now() + RESEND_AFTER_MS;
    p.attempts = 0;
    const mail = (kind === 'register' ? registerOtpEmail : resetPasswordOtpEmail)(p.name, otp, OTP_TTL_MS / 60_000);
    const sent = await this.mail.send(email, mail.subject, mail.html, mail.text);
    if (!sent) this.logger.warn(`[OTP ${kind === 'register' ? 'đăng ký' : 'quên mật khẩu'}] ${email}: ${otp} (hiệu lực 5 phút; chưa gửi được email nên in ra log)`);
    return { email, expiresIn: OTP_TTL_MS / 1000, resendAfter: RESEND_AFTER_MS / 1000 };
  }

  /** Kiểm tra mã: hết lượt, hết hạn, sai mã (sai thì tăng số lần nhập sai). Đúng thì không ném lỗi. */
  private checkOtp(email: string, p: PendingOtp, kind: OtpKind, otp: string) {
    if (p.attempts >= MAX_ATTEMPTS) return fail('OTP_TOO_MANY_ATTEMPTS', 'Nhập sai quá nhiều lần, hãy gửi lại mã mới.', 429);
    if (p.expiresAt < Date.now()) return fail('OTP_EXPIRED', 'Mã OTP đã hết hạn, hãy gửi lại mã mới.', 400);
    if (hashOtp(`${kind}:${email}`, String(otp ?? '').trim()) !== p.otpHash) {
      p.attempts++;
      return fail('OTP_INVALID', 'Mã OTP không đúng.', 400);
    }
  }

  async register(body: { name?: string; phone?: string; email?: string; password?: string }) {
    this.sweep();
    const name = body.name?.trim() ?? '';
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';
    const errors: Record<string, string> = {};
    if (!name) errors.name = 'Vui lòng nhập họ và tên.';
    if (phone && !PHONE_RE.test(phone)) errors.phone = 'Số điện thoại cần 10 số, bắt đầu bằng 0.';
    if (!EMAIL_RE.test(email)) errors.email = 'Email chưa hợp lệ.';
    if (password.length < 6) errors.password = 'Mật khẩu cần tối thiểu 6 ký tự.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin đăng ký chưa hợp lệ.', 400, errors);

    if (await this.prisma.users.findUnique({ where: { email } })) return fail('EMAIL_ALREADY_EXISTS', 'Email đã được sử dụng.', 409);
    if (phone && (await this.prisma.users.findFirst({ where: { phone_number: phone } }))) return fail('PHONE_ALREADY_EXISTS', 'Số điện thoại đã được sử dụng.', 409);

    const existing = this.pending.get(email);
    if (existing && existing.resendAt > Date.now()) return fail('OTP_RESEND_TOO_SOON', 'Vui lòng chờ trước khi gửi lại mã.', 429);
    const p: PendingRegistration = { name, phone, passwordHash: await bcrypt.hash(password, 10), otpHash: '', expiresAt: 0, resendAt: 0, attempts: 0 };
    this.pending.set(email, p);
    return this.issueOtp(email, p, 'register');
  }

  resendOtp(emailRaw: string) {
    this.sweep();
    const email = emailRaw?.trim().toLowerCase() ?? '';
    const p = this.pending.get(email);
    if (!p) return fail('REGISTRATION_NOT_FOUND', 'Không tìm thấy đăng ký đang chờ xác thực.', 404);
    if (p.resendAt > Date.now()) return fail('OTP_RESEND_TOO_SOON', 'Vui lòng chờ trước khi gửi lại mã.', 429);
    return this.issueOtp(email, p, 'register');
  }

  async verifyOtp(emailRaw: string, otp: string) {
    this.sweep();
    const email = emailRaw?.trim().toLowerCase() ?? '';
    const p = this.pending.get(email);
    if (!p) return fail('REGISTRATION_NOT_FOUND', 'Không tìm thấy đăng ký đang chờ xác thực.', 404);
    this.checkOtp(email, p, 'register', otp);

    // Tên đăng nhập sinh từ email, thêm số nếu trùng
    const base = (email.split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'user').slice(0, 40);
    let username = base;
    for (let i = 1; await this.prisma.users.findUnique({ where: { username } }); i++) username = `${base}${i}`;

    const user = await this.prisma.users.create({
      data: { username, email, full_name: p.name, phone_number: p.phone, password_hash: p.passwordHash, role: 'Couple', status: 'Active' },
    });
    this.pending.delete(email);
    return this.session(user);
  }

  // ---------- Quên mật khẩu: gửi OTP về email, nhập đúng mã thì đặt mật khẩu mới ----------

  async forgotPassword(emailRaw: string) {
    this.sweep();
    const email = emailRaw?.trim().toLowerCase() ?? '';
    if (!EMAIL_RE.test(email)) return fail('VALIDATION_ERROR', 'Email chưa hợp lệ.', 400, { email: 'Email chưa hợp lệ.' });
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) return fail('EMAIL_NOT_FOUND', 'Email này chưa đăng ký tài khoản WebPlan.', 404);
    if (user.status === 'Locked') return fail('ACCOUNT_DISABLED', 'Tài khoản đã bị khóa.', 403);

    const existing = this.resets.get(email);
    if (existing && existing.resendAt > Date.now()) return fail('OTP_RESEND_TOO_SOON', 'Vui lòng chờ trước khi gửi lại mã.', 429);
    const p: PendingReset = { userId: user.id, name: user.full_name, otpHash: '', expiresAt: 0, resendAt: 0, attempts: 0 };
    this.resets.set(email, p);
    return this.issueOtp(email, p, 'reset');
  }

  resendResetOtp(emailRaw: string) {
    this.sweep();
    const email = emailRaw?.trim().toLowerCase() ?? '';
    const p = this.resets.get(email);
    if (!p) return fail('RESET_NOT_FOUND', 'Yêu cầu đặt lại mật khẩu đã hết hạn, hãy nhập lại email.', 404);
    if (p.resendAt > Date.now()) return fail('OTP_RESEND_TOO_SOON', 'Vui lòng chờ trước khi gửi lại mã.', 429);
    return this.issueOtp(email, p, 'reset');
  }

  /** OTP đúng thì đổi mật khẩu và đăng nhập luôn. */
  async resetPassword(body: { email?: string; otp?: string; password?: string }) {
    this.sweep();
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';
    if (password.length < 6) return fail('VALIDATION_ERROR', 'Mật khẩu cần tối thiểu 6 ký tự.', 400, { password: 'Mật khẩu cần tối thiểu 6 ký tự.' });
    const p = this.resets.get(email);
    if (!p) return fail('RESET_NOT_FOUND', 'Yêu cầu đặt lại mật khẩu đã hết hạn, hãy nhập lại email.', 404);
    this.checkOtp(email, p, 'reset', body.otp ?? '');

    const user = await this.prisma.users.update({
      where: { id: p.userId },
      data: { password_hash: await bcrypt.hash(password, 10), last_login_at: new Date() },
    });
    this.resets.delete(email);
    return this.session(user);
  }

  // ---------- Hồ sơ cá nhân ----------

  async updateProfile(userId: string, body: { name?: string | null; email?: string | null; phone?: string | null }) {
    const name = body.name?.trim() ?? '';
    const email = body.email?.trim().toLowerCase() ?? '';
    const phone = body.phone?.trim() || null;
    const errors: Record<string, string> = {};
    if (!name) errors.name = 'Họ và tên không được để trống.';
    if (!EMAIL_RE.test(email)) errors.email = 'Email chưa hợp lệ.';
    if (phone && !PHONE_RE.test(phone)) errors.phone = 'Số điện thoại cần 10 số, bắt đầu bằng 0.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400, errors);

    const emailOwner = await this.prisma.users.findUnique({ where: { email } });
    if (emailOwner && emailOwner.id !== userId) return fail('EMAIL_ALREADY_EXISTS', 'Email đã được sử dụng.', 409);
    if (phone) {
      const phoneOwner = await this.prisma.users.findFirst({ where: { phone_number: phone, id: { not: userId } } });
      if (phoneOwner) return fail('PHONE_ALREADY_EXISTS', 'Số điện thoại đã được sử dụng.', 409);
    }
    const user = await this.prisma.users.update({ where: { id: userId }, data: { full_name: name, email, phone_number: phone } });
    return toSessionUser(user);
  }
}
