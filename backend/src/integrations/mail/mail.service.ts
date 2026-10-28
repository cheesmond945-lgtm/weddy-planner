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
      // || chứ không ??: MAIL_FROM_NAME để trống thì vẫn hiện tên WebPlan (tên người gửi rỗng dễ bị lọc spam)
      const info = await this.transport.sendMail({ from: `"${process.env.MAIL_FROM_NAME || 'WebPlan'}" <${this.user}>`, to, subject, html, text });
      this.log.log(`Đã gửi email "${subject}" tới ${to} (${info.response})`);
      return true;
    } catch (e) {
      this.log.error(`Gửi email tới ${to} thất bại: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * Email thông tin đăng nhập (email + mật khẩu hệ thống sinh): khi Admin tạo tài khoản, hoặc khi Admin đổi email hộ NCC (cấp mật khẩu mới).
   * Bố cục dạng bảng, style inline để hiển thị đúng ở Gmail/Outlook.
   */
  sendAccountCredentials(to: string, password: string, reason: 'created' | 'emailChanged') {
    const created = reason === 'created';
    const copy = created
      ? {
          preheader: 'Thông tin đăng nhập tài khoản WebPlan của bạn.',
          title: 'Chào mừng bạn đến với WebPlan',
          intro: 'Tài khoản của bạn đã được tạo. Hãy dùng thông tin dưới đây để đăng nhập.',
          subject: 'Thông tin tài khoản WebPlan của bạn',
        }
      : {
          preheader: 'Email đăng nhập WebPlan của bạn đã được đổi, kèm mật khẩu mới.',
          title: 'Email đăng nhập đã được đổi',
          intro: 'Theo yêu cầu hỗ trợ, quản trị viên WebPlan đã đổi email đăng nhập tài khoản của bạn sang địa chỉ này và cấp mật khẩu mới. Mật khẩu cũ không còn dùng được.',
          subject: 'Email đăng nhập WebPlan đã được đổi – mật khẩu mới',
        };
    // || chứ không ??: biến môi trường để trống ("") cũng phải lấy giá trị dự phòng
    const loginUrl = `${(process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173').trim()}/login`;
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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe6;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(22,29,29,.08)">
        <tr><td style="background:${ink};padding:28px 32px">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#ffffff;line-height:1">Web<i style="color:#d4b068">Plan.</i></div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:3px;color:#9aa5a5">WEDDING PLANNER</div>
        </td></tr>
        <tr><td style="padding:32px 32px 8px">
          <h1 style="margin:0 0 12px;font-size:22px;color:${ink}">${esc(copy.title)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4a4a45">${esc(copy.intro)}</p>
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
    const text = `${copy.intro}

Email đăng nhập: ${to}
Mật khẩu: ${password}
Đăng nhập: ${loginUrl}

Bạn có thể đổi mật khẩu sau khi đăng nhập. Không chia sẻ email này cho người khác.`;
    return this.send(to, copy.subject, html, text);
  }

  /** Báo mật khẩu vừa được đổi (thực tế các hệ thống đều gửi), để chủ tài khoản phát hiện nếu không phải mình đổi. */
  sendPasswordChanged(to: string, name: string) {
    const at = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    const html = `<!doctype html>
<html lang="vi"><body style="margin:0;padding:24px 12px;background:#f4efe6;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#161d1d;padding:24px 32px;font-family:Georgia,serif;font-size:26px;color:#ffffff">Web<i style="color:#d4b068">Plan.</i></td></tr>
    <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;color:#4a4a45">
      <h1 style="margin:0 0 12px;font-size:20px;color:#161d1d">Mật khẩu đã được thay đổi</h1>
      <p style="margin:0 0 12px">Chào ${esc(name || to)}, mật khẩu tài khoản WebPlan <b>${esc(to)}</b> vừa được đổi lúc ${esc(at)}.</p>
      <p style="margin:0">Nếu không phải bạn thực hiện, hãy liên hệ quản trị viên WebPlan ngay để được hỗ trợ khóa và lấy lại tài khoản.</p>
    </td></tr>
    <tr><td style="background:#faf7f0;padding:16px 32px;text-align:center;font-size:12px;color:#8a8170">Email được gửi tự động từ hệ thống WebPlan, vui lòng không trả lời.</td></tr>
  </table>
</body></html>`;
    const text = `Mật khẩu tài khoản WebPlan ${to} vừa được đổi lúc ${at}.
Nếu không phải bạn thực hiện, hãy liên hệ quản trị viên WebPlan ngay.`;
    return this.send(to, 'Mật khẩu tài khoản WebPlan đã được thay đổi', html, text);
  }

  /** Mã OTP xác minh email: đăng ký tài khoản cặp đôi hoặc đổi email đăng nhập. */
  sendOtp(to: string, otp: string, minutes: number, purpose: 'register' | 'changeEmail') {
    const action = purpose === 'register' ? 'hoàn tất đăng ký tài khoản WebPlan' : `đổi email đăng nhập WebPlan sang <b>${esc(to)}</b>`;
    const html = this.notice(
      purpose === 'register' ? 'Xác minh email đăng ký' : 'Xác minh email mới',
      `<p style="margin:0 0 12px">Mã xác minh để ${action}:</p>
      <p style="margin:0 0 12px;font-family:Consolas,'Courier New',monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:#161d1d">${esc(otp)}</p>
      <p style="margin:0">Mã có hiệu lực trong ${minutes} phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`,
    );
    const text = `Mã xác minh WebPlan của bạn: ${otp}
Mã có hiệu lực trong ${minutes} phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.`;
    return this.send(to, purpose === 'register' ? 'Mã xác minh đăng ký WebPlan' : 'Mã xác minh đổi email WebPlan', html, text);
  }

  /** Báo về email CŨ rằng email đăng nhập vừa được đổi, để chủ tài khoản phát hiện nếu không phải mình đổi. */
  sendEmailChanged(to: string, newEmail: string, byAdmin: boolean) {
    const at = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    const masked = newEmail.replace(/^(.{1,2})[^@]*(@.*)$/, '$1***$2');
    const who = byAdmin ? 'theo yêu cầu hỗ trợ, quản trị viên WebPlan đã đổi' : 'đã được đổi';
    const html = this.notice(
      'Email đăng nhập đã được thay đổi',
      `<p style="margin:0 0 12px">Email đăng nhập tài khoản WebPlan <b>${esc(to)}</b> ${who} sang <b>${esc(masked)}</b> lúc ${esc(at)}. Từ giờ email này không còn dùng để đăng nhập.</p>
      <p style="margin:0">Nếu không phải bạn yêu cầu, hãy liên hệ quản trị viên WebPlan ngay để được hỗ trợ khóa và lấy lại tài khoản.</p>`,
    );
    const text = `Email đăng nhập tài khoản WebPlan ${to} ${who} sang ${masked} lúc ${at}.
Nếu không phải bạn yêu cầu, hãy liên hệ quản trị viên WebPlan ngay.`;
    return this.send(to, 'Email đăng nhập WebPlan đã được thay đổi', html, text);
  }

  /** Khung email thông báo ngắn (logo, tiêu đề, nội dung HTML đã escape sẵn). */
  private notice(title: string, body: string) {
    return `<!doctype html>
<html lang="vi"><body style="margin:0;padding:24px 12px;background:#f4efe6;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#161d1d;padding:24px 32px;font-family:Georgia,serif;font-size:26px;color:#ffffff">Web<i style="color:#d4b068">Plan.</i></td></tr>
    <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;color:#4a4a45">
      <h1 style="margin:0 0 12px;font-size:20px;color:#161d1d">${esc(title)}</h1>
      ${body}
    </td></tr>
    <tr><td style="background:#faf7f0;padding:16px 32px;text-align:center;font-size:12px;color:#8a8170">Email được gửi tự động từ hệ thống WebPlan, vui lòng không trả lời.</td></tr>
  </table>
</body></html>`;
  }
}
