import { HttpException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt } from 'node:crypto';
import { MailService } from '../../integrations/mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { registerOtpEmail, resetPasswordOtpEmail } from '../../integrations/mail/templates';
import { passwordProblem } from './password-policy';

const ROLE_MAP: Record<string, 'COUPLE' | 'VENDOR' | 'ADMIN'> = { Couple: 'COUPLE', Vendor: 'VENDOR', Admin: 'ADMIN' };

type UserRow = { id: string; username?: string | null; full_name: string | null; email: string | null; phone_number: string | null; role: string | null };

// Dạng người dùng frontend cần (docs/api/auth.md)
const toSessionUser = (u: UserRow) => ({
  id: u.id,
  username: u.username ?? null,
  name: u.full_name ?? '',
  email: u.email ?? '',
  phone: u.phone_number,
  role: ROLE_MAP[u.role ?? ''] ?? 'COUPLE',
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
/** Đổi email đang chờ nhập OTP gửi tới email mới. */
interface PendingEmailChange {
  email: string;
  otpHash: string;
  expiresAt: number;
  resendAt: number;
  attempts: number;
}

/** Đổi mật khẩu: nhập sai mật khẩu hiện tại quá số lần này thì tạm khóa chức năng đổi mật khẩu. */
const MAX_WRONG_CURRENT = 5;
const WRONG_LOCK_MS = 15 * 60_000;


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Đăng ký chờ xác thực OTP (lưu trong bộ nhớ, tự hết hạn; khởi động lại backend thì mất). */
  private readonly pending = new Map<string, PendingRegistration>();
  /** Yêu cầu đặt lại mật khẩu chờ nhập OTP, theo email (cũng chỉ lưu trong bộ nhớ). */
  private readonly resets = new Map<string, PendingReset>();
  /** Số lần nhập sai mật khẩu hiện tại khi đổi mật khẩu, theo người dùng (trong bộ nhớ). */
  private readonly wrongCurrent = new Map<string, { count: number; until: number }>();
  /** Đổi email chờ xác minh OTP, theo người dùng (trong bộ nhớ). */
  private readonly emailChanges = new Map<string, PendingEmailChange>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  private session(user: UserRow & { username: string | null }) {
    const accessToken = this.jwt.sign({ sub: user.id, username: user.username, role: user.role });
    return { accessToken, user: toSessionUser(user) };
  }

  /** Đăng nhập bằng username, email hoặc số điện thoại. */
  async login(identifier: string, password: string) {
    const user = await this.prisma.users.findFirst({
      where: { email: identifier.trim().toLowerCase() },
    });
    // Hash trong CSDL tạo bằng pgcrypto crypt(..., gen_salt('bf')) => tương thích bcryptjs
    if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
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
    for (let i = 1; await this.prisma.users.findFirst({ where: { username } }); i++) username = `${base}${i}`;

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
    const p: PendingReset = { userId: user.id, name: user.full_name ?? '', otpHash: '', expiresAt: 0, resendAt: 0, attempts: 0 };
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

  /**
   * Sửa họ tên, tên đăng nhập, SĐT; trường nào không gửi thì giữ nguyên (trang Tài khoản của tôi không gửi SĐT).
   * Đăng nhập bằng email nên đổi tên đăng nhập không ảnh hưởng việc đăng nhập.
   * Email không đổi ở đây mà qua requestEmailChange (mật khẩu + OTP).
   */
  async updateProfile(userId: string, body: { name?: string | null; username?: string | null; email?: string | null; phone?: string | null }) {
    const current = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!current) return fail('UNAUTHORIZED', 'Chưa đăng nhập.', 401);
    const data: { full_name?: string; username?: string; phone_number?: string | null } = {};
    const errors: Record<string, string> = {};
    if (body.name !== undefined) {
      const name = body.name?.trim() ?? '';
      if (!name || name.length > 100) errors.name = 'Nhập họ và tên (tối đa 100 ký tự).';
      data.full_name = name;
    }
    if (body.username !== undefined) {
      const username = body.username?.trim() ?? '';
      if (!username || username.length > 50) errors.username = 'Nhập tên đăng nhập (tối đa 50 ký tự).';
      else if (await this.prisma.users.findFirst({ where: { username: { equals: username, mode: 'insensitive' }, id: { not: userId } } })) errors.username = 'Tên đăng nhập đã được sử dụng.';
      data.username = username;
    }
    if (body.phone !== undefined) {
      const phone = body.phone?.trim() || null;
      if (phone && !PHONE_RE.test(phone)) errors.phone = 'Số điện thoại cần 10 số, bắt đầu bằng 0.';
      else if (phone && (await this.prisma.users.findFirst({ where: { phone_number: phone, id: { not: userId } } }))) errors.phone = 'Số điện thoại đã được sử dụng.';
      data.phone_number = phone;
    }
    // Client cũ còn gửi email: chỉ chấp nhận đúng email hiện tại
    if (body.email != null && body.email.trim().toLowerCase() !== (current.email ?? '')) errors.email = 'Đổi email đăng nhập qua mục "Đổi email" (cần mật khẩu và mã xác minh).';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400, errors);

    const user = await this.prisma.users.update({ where: { id: userId }, data });
    return toSessionUser(user);
  }

  // ---------- Đổi email đăng nhập ----------

  /**
   * Bước 1: nhập mật khẩu hiện tại + email mới, hệ thống gửi OTP tới email mới (chứng minh email mới đúng và là của mình).
   * Nhập sai mật khẩu dùng chung bộ đếm với đổi mật khẩu.
   */
  async requestEmailChange(userId: string, body: { currentPassword?: string; newEmail?: string }) {
    this.assertNotLocked(userId);
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user?.password_hash) return fail('UNAUTHORIZED', 'Chưa đăng nhập.', 401);

    const current = body.currentPassword ?? '';
    const email = body.newEmail?.trim().toLowerCase() ?? '';
    const errors: Record<string, string> = {};
    if (!current) errors.currentPassword = 'Nhập mật khẩu hiện tại.';
    if (!EMAIL_RE.test(email) || email.length > 255) errors.newEmail = 'Email chưa hợp lệ.';
    else if (email === user.email) errors.newEmail = 'Email mới phải khác email hiện tại.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400, errors);

    const existing = this.emailChanges.get(userId);
    if (existing?.email === email && existing.resendAt > Date.now()) return fail('OTP_RESEND_TOO_SOON', 'Vui lòng chờ trước khi gửi lại mã.', 429);
    await this.verifyCurrentPassword(userId, user.password_hash, current);
    if (await this.prisma.users.findFirst({ where: { email } })) return fail('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 409, { newEmail: 'Email đã được sử dụng.' });

    const p: PendingEmailChange = { email, otpHash: '', expiresAt: 0, resendAt: 0, attempts: 0 };
    this.emailChanges.set(userId, p);
    return this.issueEmailChangeOtp(p);
  }

  async resendEmailChangeOtp(userId: string) {
    const p = this.emailChanges.get(userId);
    if (!p || p.expiresAt + 10 * 60_000 < Date.now()) return fail('EMAIL_CHANGE_NOT_FOUND', 'Không có yêu cầu đổi email đang chờ xác minh.', 404);
    if (p.resendAt > Date.now()) return fail('OTP_RESEND_TOO_SOON', 'Vui lòng chờ trước khi gửi lại mã.', 429);
    return this.issueEmailChangeOtp(p);
  }

  /** Bước 2: nhập đúng OTP thì đổi email, báo về email cũ. */
  async verifyEmailChange(userId: string, otpRaw: string) {
    const p = this.emailChanges.get(userId);
    if (!p) return fail('EMAIL_CHANGE_NOT_FOUND', 'Không có yêu cầu đổi email đang chờ xác minh.', 404);
    if (p.attempts >= MAX_ATTEMPTS) return fail('OTP_TOO_MANY_ATTEMPTS', 'Nhập sai quá nhiều lần, hãy gửi lại mã mới.', 429);
    if (p.expiresAt < Date.now()) return fail('OTP_EXPIRED', 'Mã OTP đã hết hạn, hãy gửi lại mã mới.', 400);
    if (hashOtp(p.email, String(otpRaw ?? '').trim()) !== p.otpHash) {
      p.attempts++;
      return fail('OTP_INVALID', 'Mã OTP không đúng.', 400);
    }
    // Trong lúc chờ OTP có thể đã có tài khoản khác lấy email này
    if (await this.prisma.users.findFirst({ where: { email: p.email, id: { not: userId } } })) {
      this.emailChanges.delete(userId);
      return fail('EMAIL_ALREADY_EXISTS', 'Email đã được sử dụng.', 409);
    }
    const before = await this.prisma.users.findUnique({ where: { id: userId }, select: { email: true } });
    const user = await this.prisma.users.update({ where: { id: userId }, data: { email: p.email } });
    this.emailChanges.delete(userId);
    this.logger.log(`Người dùng ${userId} tự đổi email đăng nhập ${before?.email ?? '(trống)'} -> ${p.email}`);
    if (before?.email) void this.mail.sendEmailChanged(before.email, p.email, false);
    return toSessionUser(user);
  }

  /** Gửi OTP tới email mới; chưa cấu hình mail thì ghi mã ra log như OTP đăng ký. */
  private async issueEmailChangeOtp(p: PendingEmailChange) {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    p.otpHash = hashOtp(p.email, otp);
    p.expiresAt = Date.now() + OTP_TTL_MS;
    p.resendAt = Date.now() + RESEND_AFTER_MS;
    p.attempts = 0;
    if (!(await this.mail.sendOtp(p.email, otp, OTP_TTL_MS / 60_000, 'changeEmail'))) {
      this.logger.warn(`[OTP đổi email] ${p.email}: ${otp} (hiệu lực 5 phút, chưa gửi được email nên in ra log)`);
    }
    return { email: p.email, expiresIn: OTP_TTL_MS / 1000, resendAfter: RESEND_AFTER_MS / 1000 };
  }

  // ---------- Kiểm tra mật khẩu hiện tại (đổi mật khẩu, đổi email) ----------

  private assertNotLocked(userId: string) {
    const lock = this.wrongCurrent.get(userId);
    if (lock && lock.until > Date.now()) {
      const min = Math.ceil((lock.until - Date.now()) / 60_000);
      fail('TOO_MANY_ATTEMPTS', `Bạn đã nhập sai mật khẩu hiện tại quá ${MAX_WRONG_CURRENT} lần. Thử lại sau ${min} phút.`, 429);
    }
  }

  /** Sai thì tăng bộ đếm (đủ MAX_WRONG_CURRENT lần thì tạm khóa WRONG_LOCK_MS) và báo lỗi ở ô currentPassword; đúng thì xóa bộ đếm. */
  private async verifyCurrentPassword(userId: string, hash: string, current: string) {
    if (await bcrypt.compare(current, hash)) {
      this.wrongCurrent.delete(userId);
      return;
    }
    const lock = this.wrongCurrent.get(userId);
    // Hết thời gian tạm khóa (until đã qua) thì đếm lại từ đầu
    const count = (lock && lock.until === 0 ? lock.count : 0) + 1;
    this.wrongCurrent.set(userId, { count, until: count >= MAX_WRONG_CURRENT ? Date.now() + WRONG_LOCK_MS : 0 });
    const left = MAX_WRONG_CURRENT - count;
    fail('VALIDATION_ERROR', 'Mật khẩu hiện tại không đúng.', 400, {
      currentPassword: left > 0 ? `Mật khẩu hiện tại không đúng. Còn ${left} lần thử.` : `Mật khẩu hiện tại không đúng. Đã tạm khóa ${WRONG_LOCK_MS / 60_000} phút.`,
    });
  }

  // ---------- Đổi mật khẩu ----------

  /**
   * Đổi mật khẩu khi đang đăng nhập: kiểm tra mật khẩu hiện tại, mật khẩu mới theo password-policy, nhập lại khớp và khác mật khẩu cũ.
   * Sai mật khẩu hiện tại 5 lần thì tạm khóa chức năng này 15 phút. Đổi xong gửi email báo (nếu đã cấu hình mail).
   */
  async changePassword(userId: string, body: { currentPassword?: string; newPassword?: string; confirmPassword?: string }) {
    this.assertNotLocked(userId);
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user?.password_hash) return fail('UNAUTHORIZED', 'Chưa đăng nhập.', 401);

    const current = body.currentPassword ?? '';
    const next = body.newPassword ?? '';
    const errors: Record<string, string> = {};
    if (!current) errors.currentPassword = 'Nhập mật khẩu hiện tại.';
    const problem = next ? passwordProblem(next, { username: user.username, email: user.email, phone: user.phone_number }) : 'Nhập mật khẩu mới.';
    if (problem) errors.newPassword = problem;
    if ((body.confirmPassword ?? '') !== next) errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400, errors);

    await this.verifyCurrentPassword(userId, user.password_hash, current);
    if (await bcrypt.compare(next, user.password_hash)) {
      return fail('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400, { newPassword: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
    }

    await this.prisma.users.update({ where: { id: userId }, data: { password_hash: await bcrypt.hash(next, 10) } });
    if (user.email) void this.mail.sendPasswordChanged(user.email, user.full_name ?? '');
    return null;
  }
}
