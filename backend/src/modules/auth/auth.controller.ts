import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // POST /api/auth/login  { "identifier": "admin", "password": "Everly@2026" }  (cũ: "login" vẫn được nhận)
  @Post('login')
  login(@Body() body: { identifier?: string; login?: string; password?: string }) {
    const identifier = (body?.identifier ?? body?.login ?? '').trim();
    if (!identifier || !body?.password) throw new BadRequestException('Nhập tài khoản và mật khẩu');
    return this.auth.login(identifier, body.password);
  }

  // GET /api/auth/me  (header Authorization: Bearer <token>)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.auth.me(req.user.sub);
  }
}
