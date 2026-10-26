import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Gửi email qua SMTP (Gmail dùng Mật khẩu ứng dụng, không dùng mật khẩu tài khoản).
 * Cấu hình trong backend/.env: MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD, MAIL_FROM.
 * Chưa cấu hình đủ thì `isConfigured = false`, nơi gọi tự in nội dung ra log (môi trường dev).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.MAIL_HOST?.trim();
    const user = process.env.MAIL_USER?.trim();
    // Mật khẩu ứng dụng Gmail hiển thị dạng "abcd efgh ijkl mnop": bỏ khoảng trắng
    const pass = process.env.MAIL_PASSWORD?.replace(/\s+/g, '');
    const port = Number(process.env.MAIL_PORT) || 465;
    this.from = process.env.MAIL_FROM?.trim() || (user ? `WebPlan <${user}>` : 'WebPlan');

    if (!host || !user || !pass) {
      this.transporter = null;
      this.logger.warn('Chưa cấu hình MAIL_HOST / MAIL_USER / MAIL_PASSWORD: email sẽ chỉ in ra log.');
      return;
    }
    this.transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    this.transporter.verify().then(
      () => this.logger.log(`Kết nối SMTP ${host}:${port} thành công (${user}).`),
      (e: Error) => this.logger.error(`Không kết nối được SMTP ${host}:${port}: ${e.message}`),
    );
  }

  get isConfigured() {
    return this.transporter !== null;
  }

  /** Gửi một email. Trả true nếu gửi được, false nếu chưa cấu hình hoặc lỗi (đã ghi log). */
  async send(to: string, subject: string, html: string, text: string): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      return true;
    } catch (e) {
      this.logger.error(`Gửi email tới ${to} thất bại: ${(e as Error).message}`);
      return false;
    }
  }
}
