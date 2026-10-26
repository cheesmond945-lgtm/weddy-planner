/** Mẫu email gửi mã OTP đăng ký (tiếng Việt, kèm bản chữ thuần cho trình đọc thư không hiện HTML). */
export function registerOtpEmail(name: string, otp: string, minutes: number) {
  const subject = `${otp} là mã xác thực đăng ký WebPlan`;
  const text = [
    `Chào ${name},`,
    '',
    `Mã xác thực đăng ký tài khoản WebPlan của bạn là: ${otp}`,
    `Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này cho bất kỳ ai.`,
    '',
    'Nếu bạn không đăng ký WebPlan, hãy bỏ qua email này.',
  ].join('\n');

  const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const html = `<!doctype html>
<html lang="vi"><body style="margin:0;padding:24px;background:#faf7f2;font-family:Arial,Helvetica,sans-serif;color:#29231d">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #eadfd0;border-radius:16px">
    <tr><td style="padding:28px 32px 8px;text-align:center">
      <div style="font-size:12px;letter-spacing:3px;color:#ae8131;font-weight:bold">WEDDY PLANNER</div>
      <div style="font-family:Georgia,serif;font-size:26px;color:#ae8131;font-weight:bold;margin-top:6px">WEBPLAN</div>
    </td></tr>
    <tr><td style="padding:16px 32px 28px">
      <p style="margin:0 0 12px">Chào ${escape(name)},</p>
      <p style="margin:0 0 16px">Mã xác thực đăng ký tài khoản WebPlan của bạn là:</p>
      <div style="font-size:32px;letter-spacing:10px;font-weight:bold;text-align:center;background:#f5ebd8;border-radius:12px;padding:14px 0;color:#29231d">${otp}</div>
      <p style="margin:16px 0 0;font-size:14px;color:#756a5d">Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này cho bất kỳ ai.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#948a7c">Nếu bạn không đăng ký WebPlan, hãy bỏ qua email này.</p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}
