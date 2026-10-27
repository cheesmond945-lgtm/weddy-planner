import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
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

  // Đăng ký cặp đôi: bước 1 gửi OTP (chưa cấu hình mail thì mã được ghi ra log của backend)
  @Post('register')
  register(@Body() body: { name?: string; phone?: string; email?: string; password?: string }) {
    return this.auth.register(body ?? {});
  }

  @Post('register/resend-otp')
  resendOtp(@Body() body: { email?: string }) {
    return this.auth.resendOtp(body?.email ?? '');
  }

  @Post('register/verify-otp')
  verifyOtp(@Body() body: { email?: string; otp?: string }) {
    return this.auth.verifyOtp(body?.email ?? '', body?.otp ?? '');
  }

  // Quên mật khẩu: bước 1 gửi OTP về email, bước 2 nhập OTP + mật khẩu mới
  @Post('forgot-password')
  forgotPassword(@Body() body: { email?: string }) {
    return this.auth.forgotPassword(body?.email ?? '');
  }

  @Post('forgot-password/resend-otp')
  resendResetOtp(@Body() body: { email?: string }) {
    return this.auth.resendResetOtp(body?.email ?? '');
  }

  @Post('reset-password')
  resetPassword(@Body() body: { email?: string; otp?: string; password?: string }) {
    return this.auth.resetPassword(body ?? {});
  }

  // GET /api/auth/me (header Authorization: Bearer <token>)
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.auth.me(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@Req() req: any, @Body() body: { name?: string | null; email?: string | null; phone?: string | null }) {
    return this.auth.updateProfile(req.user.sub, body ?? {});
  }
}
