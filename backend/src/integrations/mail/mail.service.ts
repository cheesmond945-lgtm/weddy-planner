import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Gửi email qua SMTP (Gmail + mật khẩu ứng dụng). Chưa cấu hình MAIL_USER / MAIL_PASSWORD thì coi như chưa bật. */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly user = process.env.MAIL_USER;
  private readonly transport = this.user && process.env.MAIL_PASSWORD
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: this.user, pass: process.env.MAIL_PASSWORD.replace(/\s/g, '') } })
    : null;

  get enabled() {
    return !!this.transport;
  }

  /** Trả true nếu gửi được, false nếu chưa cấu hình hoặc lỗi (không ném lỗi để không chặn việc tạo tài khoản). */
  async send(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.transport) {
      this.log.warn('Chưa cấu hình MAIL_USER / MAIL_PASSWORD nên không gửi email.');
      return false;
    }
    try {
      await this.transport.sendMail({ from: `"${process.env.MAIL_FROM_NAME ?? 'WebPlan'}" <${this.user}>`, to, subject, html, text });
      return true;
    } catch (e) {
      this.log.error(`Gửi email tới ${to} thất bại: ${(e as Error).message}`);
      return false;
    }
  }

  /** Email thông tin tài khoản mới (email đăng nhập + mật khẩu hệ thống sinh). Bố cục dạng bảng, style inline để hiển thị đúng ở Gmail/Outlook. */
  sendAccountCreated(to: string, password: string) {
    const loginUrl = `${(process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN?.split(',')[0] ?? 'http://localhost:5173').trim()}/login`;
    const ink = '#161d1d';
    const gold = '#a8802f';
    const font = "'Segoe UI',Helvetica,Arial,sans-serif";
    const row = (label: string, value: string, mono = false) => `
      <tr><td style="padding:14px 20px;border-bottom:1px solid #eee3cf">
        <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8a8170;margin-bottom:4px">${label}</div>
        <div style="font-size:${mono ? 20 : 16}px;font-weight:600;color:${ink};${mono ? "font-family:Consolas,'Courier New',monospace;letter-spacing:2px;" : ''}word-break:break-all">${value}</div>
      </td></tr>`;
    const html = `<!doctype html>
<html lang="vi"><body style="margin:0;padding:0;background:#f4efe6;font-family:${font}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Thông tin đăng nhập tài khoản WebPlan của bạn.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe6;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(22,29,29,.08)">
        <tr><td style="background:${ink};padding:28px 32px">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#ffffff;line-height:1">Web<i style="color:#d4b068">Plan.</i></div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:3px;color:#9aa5a5">WEDDING PLANNER</div>
        </td></tr>
        <tr><td style="padding:32px 32px 8px">
          <h1 style="margin:0 0 12px;font-size:22px;color:${ink}">Chào mừng bạn đến với WebPlan</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4a4a45">Tài khoản của bạn đã được tạo. Hãy dùng thông tin dưới đây để đăng nhập.</p>
        </td></tr>
        <tr><td style="padding:20px 32px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f1;border:1px solid #eee3cf;border-radius:12px">
            ${row('Email đăng nhập', esc(to))}
            ${row('Mật khẩu', esc(password), true).replace('border-bottom:1px solid #eee3cf', 'border-bottom:0')}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:8px 32px 28px">
          <a href="${esc(loginUrl)}" style="display:inline-block;background:${gold};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:999px">Đăng nhập ngay</a>
        </td></tr>
        <tr><td style="padding:0 32px 32px">
          <div style="border-left:3px solid ${gold};background:#fbf8f1;padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.6;color:#5c5546">
            Bạn có thể đổi mật khẩu sau khi đăng nhập. Vì lý do bảo mật, đừng chia sẻ email này cho người khác.
          </div>
        </td></tr>
        <tr><td style="background:#faf7f0;padding:18px 32px;text-align:center;font-size:12px;color:#8a8170">
          Email được gửi tự động từ hệ thống WebPlan, vui lòng không trả lời.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    const text = `Tài khoản WebPlan của bạn đã được tạo.

Email đăng nhập: ${to}
Mật khẩu: ${password}
Đăng nhập: ${loginUrl}

Bạn có thể đổi mật khẩu sau khi đăng nhập. Không chia sẻ email này cho người khác.`;
    return this.send(to, 'Thông tin tài khoản WebPlan của bạn', html, text);
  }
}
