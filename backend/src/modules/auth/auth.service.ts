import { HttpException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

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

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  /** Đăng nhập bằng username, email hoặc số điện thoại. Mật khẩu dữ liệu mẫu: Everly@2026 */
  async login(identifier: string, password: string) {
    const user = await this.prisma.users.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }, { phone_number: identifier }] },
    });
    // Hash trong CSDL tạo bằng pgcrypto crypt(..., gen_salt('bf')) => tương thích bcryptjs
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpException({ code: 'INVALID_CREDENTIALS', message: 'Sai tài khoản hoặc mật khẩu.' }, 401);
    }
    if (user.status === 'Locked') {
      throw new HttpException({ code: 'ACCOUNT_DISABLED', message: 'Tài khoản đã bị khóa.' }, 403);
    }

    await this.prisma.users.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    const accessToken = this.jwt.sign({ sub: user.id, username: user.username, role: user.role });
    return { accessToken, user: toSessionUser(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new HttpException({ code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' }, 401);
    return toSessionUser(user);
  }
}
