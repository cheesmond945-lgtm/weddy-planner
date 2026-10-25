import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { MailService } from '../../integrations/mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { fail, matches, UUID } from './admin-common';

const ROLE_OUT: Record<string, string> = { Couple: 'COUPLE', Vendor: 'VENDOR', Admin: 'ADMIN' };
const ROLE_IN: Record<string, string> = { COUPLE: 'Couple', VENDOR: 'Vendor', ADMIN: 'Admin' };
const PHONE_RE = /^0\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Bỏ các ký tự dễ nhầm (0/O, 1/l/I) vì người dùng đọc mật khẩu từ email rồi gõ lại
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Mật khẩu ngẫu nhiên 12 ký tự, sinh bằng CSPRNG. */
const generatePassword = () => Array.from({ length: 12 }, () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]).join('');

export interface UserQueryDto {
  q?: string;
  role?: string;
  status?: string;
  page?: string | number;
  pageSize?: string | number;
}

export interface SaveUserDto {
  username?: string;
  email?: string;
  phone?: string;
  role?: string;
  categoryId?: string;
  consultationId?: string;
}

type UserRow = {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  role: string;
  status: string;
  created_date: Date;
  last_login_at: Date | null;
  vendor_profiles: { status: string; _count: { vendor_documents: number; service_packages: number; vendor_verifications: number } } | null;
};

/** NCC đã bắt đầu tạo hồ sơ: đã gửi xác minh (không còn nháp), hoặc đã tải giấy tờ / ảnh, tạo gói dịch vụ. Hồ sơ trống do Admin tạo kèm tài khoản chưa tính. */
const hasProfile = (u: Pick<UserRow, 'vendor_profiles'>) => {
  const p = u.vendor_profiles;
  return !!p && (p.status !== 'Draft' || p._count.vendor_documents + p._count.service_packages + p._count.vendor_verifications > 0);
};

/** Quản lý người dùng (bảng users, và vendor_profiles khi tạo tài khoản NCC). */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Mã hiển thị ND-00000015 theo thứ tự tạo tài khoản (ổn định vì tài khoản không bị xóa lẻ giữa chừng thường xuyên). */
  private dtos(rows: UserRow[]) {
    const order = [...rows].sort((a, b) => a.created_date.getTime() - b.created_date.getTime() || a.id.localeCompare(b.id));
    const codeOf = new Map(order.map((u, i) => [u.id, `ND-${String(i + 1).padStart(8, '0')}`]));
    return rows.map((u) => ({
      id: u.id,
      code: codeOf.get(u.id)!,
      username: u.username,
      name: u.full_name,
      email: u.email,
      phone: u.phone_number,
      role: ROLE_OUT[u.role] ?? 'COUPLE',
      status: u.status === 'Locked' ? 'LOCKED' : 'ACTIVE',
      createdAt: u.created_date.toISOString(),
      lastLoginAt: u.last_login_at?.toISOString() ?? null,
    }));
  }

  private async allRows() {
    return this.prisma.users.findMany({
      select: { id: true, username: true, email: true, full_name: true, phone_number: true, role: true, status: true, created_date: true, last_login_at: true, vendor_profiles: { select: { status: true, _count: { select: { vendor_documents: true, service_packages: true, vendor_verifications: true } } } } },
    });
  }

  async list(q: UserQueryDto) {
    const all = this.dtos(await this.allRows());
    const filtered = all
      .filter((u) => matches(q.q, u.name, u.username, u.email, u.phone, u.code) && (!q.role || u.role === q.role) && (!q.status || u.status === q.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    const page = Math.max(1, Math.trunc(Number(q.page)) || 1);
    const size = Math.min(200, Math.max(1, Math.trunc(Number(q.pageSize)) || 10));
    return {
      stats: { total: all.length, couples: all.filter((u) => u.role === 'COUPLE').length, vendors: all.filter((u) => u.role === 'VENDOR').length, locked: all.filter((u) => u.status === 'LOCKED').length },
      items: filtered.slice((page - 1) * size, page * size),
      total: filtered.length,
    };
  }

  private async one(id: string) {
    const rows = await this.allRows();
    const row = UUID.test(id) ? rows.find((r) => r.id === id) : undefined;
    if (!row) return fail('USER_NOT_FOUND', 'Không tìm thấy người dùng.', 404);
    return { row, dto: this.dtos(rows).find((u) => u.id === id)! };
  }

  /** Kiểm tra dữ liệu như frontend và trùng tên đăng nhập, email, số điện thoại. */
  private async validate(b: SaveUserDto, selfId: string | null, creating: boolean) {
    const errors: Record<string, string> = {};
    const username = b.username?.trim() ?? '';
    const email = b.email?.trim().toLowerCase() ?? '';
    const phone = b.phone?.trim() ?? '';
    if (!username || username.length > 50) errors.username = 'Nhập tên đăng nhập (tối đa 50 ký tự).';
    if (!EMAIL_RE.test(email)) errors.email = 'Email chưa hợp lệ.';
    if (!PHONE_RE.test(phone)) errors.phone = 'Số điện thoại cần 10 số, bắt đầu bằng 0.';
    if (!b.role || !(b.role in ROLE_IN)) errors.role = 'Chọn vai trò người dùng.';
    if (creating && b.role === 'VENDOR' && !b.categoryId) errors.categoryId = 'Chọn lĩnh vực cung cấp.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin tài khoản chưa hợp lệ.', 400, errors);

    const notSelf = selfId ? { id: { not: selfId } } : {};
    if (await this.prisma.users.findFirst({ where: { email, ...notSelf } })) return fail('EMAIL_ALREADY_EXISTS', 'Email đã được sử dụng.', 409);
    if (await this.prisma.users.findFirst({ where: { phone_number: phone, ...notSelf } })) return fail('PHONE_ALREADY_EXISTS', 'Số điện thoại đã được sử dụng.', 409);
    return { username, email, phone };
  }

  async create(input: SaveUserDto) {
    // Tạo từ yêu cầu tư vấn: lĩnh vực, vai trò NCC và tên đăng nhập (tên người liên hệ) lấy từ yêu cầu.
    // Email và SĐT điền sẵn từ yêu cầu nhưng Admin sửa được (NCC gửi sai thì Admin chỉnh sau khi trao đổi qua Zalo).
    const consult = input.consultationId && UUID.test(input.consultationId) ? await this.prisma.consultation_requests.findUnique({ where: { id: input.consultationId } }) : null;
    if (input.consultationId && !consult) return fail('CONSULTATION_NOT_FOUND', 'Không tìm thấy yêu cầu tư vấn.', 404);
    if (consult && consult.qualification !== 'Qualified') return fail('VALIDATION_ERROR', 'Chỉ tạo tài khoản cho nhà cung cấp đã được đánh giá đạt.', 409);
    const b: SaveUserDto = consult
      ? { username: consult.contact_name.slice(0, 50), email: input.email || consult.email, phone: input.phone || consult.phone_number, role: 'VENDOR', categoryId: consult.category_id, consultationId: consult.id }
      : input;
    const v = await this.validate(b, null, true);
    const role = ROLE_IN[b.role!];
    if (role === 'Vendor') {
      const cat = UUID.test(b.categoryId ?? '') ? await this.prisma.service_categories.findUnique({ where: { id: b.categoryId! } }) : null;
      if (!cat) return fail('VALIDATION_ERROR', 'Lĩnh vực không hợp lệ.', 400, { categoryId: 'Chọn lĩnh vực cung cấp.' });
    }

    // Admin không nhập mật khẩu: hệ thống tự sinh, chỉ lưu hash. Bản gốc gửi qua email cho người dùng.
    const generatedPassword = generatePassword();
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    const created = await this.prisma.$transaction(async (tx) => {
      const u = await tx.users.create({
        data: { username: v.username, email: v.email, full_name: consult?.contact_name ?? v.username, phone_number: v.phone, password_hash: passwordHash, role, status: 'Active' },
      });
      if (role === 'Vendor') {
        // Hồ sơ trống với lĩnh vực do Admin gán (docs/api/vendors.md); NCC tự điền rồi gửi xác minh
        await tx.vendor_profiles.create({
          data: {
            user_id: u.id,
            category_id: b.categoryId!,
            business_name: consult?.brand_name ?? '',
            representative_name: consult?.contact_name ?? '',
            address: '',
            ward: '',
            city: 'Hà Nội',
            description: '',
            status: 'Draft',
          },
        });
      }
      if (consult) {
        await tx.consultation_requests.update({
          where: { id: consult.id },
          // Ghi lại email, SĐT đã dùng (Admin có thể đã sửa) để yêu cầu khớp với tài khoản vừa tạo
          data: { email: v.email, phone_number: v.phone, is_contacted: true, contacted_date: consult.contacted_date ?? new Date(), updated_date: new Date(), admin_note: [consult.admin_note, `Đã tạo tài khoản ${v.username}.`].filter(Boolean).join('\n') },
        });
      }
      return u;
    });
    // Gửi mật khẩu qua email cho người dùng; chỉ khi gửi không được mới trả về cho Admin để chuyển tay
    const emailSent = await this.mail.sendAccountCreated(v.email, generatedPassword);
    const dto = (await this.one(created.id)).dto;
    return emailSent ? { ...dto, emailSent } : { ...dto, emailSent, generatedPassword };
  }

  async update(id: string, b: SaveUserDto) {
    const { row } = await this.one(id);
    // Email là thông tin đăng nhập nên không cho sửa: luôn giữ email hiện tại, bỏ qua giá trị client gửi lên
    const v = await this.validate({ ...b, email: row.email }, id, false);
    if (ROLE_IN[b.role!] !== row.role) return fail('VALIDATION_ERROR', 'Không đổi vai trò của tài khoản đã tạo.', 400, { role: 'Không đổi được vai trò của tài khoản đã tạo.' });
    await this.prisma.users.update({
      where: { id },
      data: { username: v.username, email: v.email, phone_number: v.phone },
    });
    return (await this.one(id)).dto;
  }

  async setStatus(id: string, lock: boolean) {
    const { row } = await this.one(id);
    if (row.role === 'Admin' && lock) return fail('CANNOT_LOCK_ADMIN', 'Không thể khóa tài khoản quản trị viên.', 409);
    await this.prisma.users.update({ where: { id }, data: { status: lock ? 'Locked' : 'Active' } });
    return (await this.one(id)).dto;
  }

  async remove(id: string, actorId: string) {
    const { row } = await this.one(id);
    if (row.role === 'Admin' || id === actorId) return fail('CANNOT_DELETE_ADMIN', 'Không thể xóa tài khoản quản trị viên.', 409);
    // Chỉ xóa được tài khoản chưa từng đăng nhập và chưa có hồ sơ. Không bao giờ xóa ảnh hồ sơ, ảnh gói dịch vụ.
    if (row.last_login_at) return fail('USER_HAS_LOGGED_IN', 'Tài khoản đã từng đăng nhập nên không thể xóa. Hãy khóa tài khoản thay vì xóa.', 409);
    if (hasProfile(row)) return fail('USER_HAS_PROFILE', 'Nhà cung cấp đã tạo hồ sơ nên không thể xóa. Hãy khóa tài khoản thay vì xóa.', 409);
    try {
      await this.prisma.$transaction([
        // Chỉ còn hồ sơ trống (chưa có giấy tờ, ảnh, gói, xác minh) và thông báo đi kèm tài khoản; không đụng tới file trong kho lưu trữ
        this.prisma.vendor_profiles.deleteMany({ where: { user_id: id } }),
        this.prisma.notifications.deleteMany({ where: { user_id: id } }),
        this.prisma.users.delete({ where: { id } }),
      ]);
    } catch {
      return fail('USER_HAS_DATA', 'Tài khoản đã có dữ liệu liên quan (đơn, hội thoại, gói...) nên không thể xóa. Hãy khóa tài khoản thay vì xóa.', 409);
    }
    return null;
  }
}
