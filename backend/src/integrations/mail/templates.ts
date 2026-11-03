const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Khung chung của email OTP (tiếng Việt, kèm bản chữ thuần cho trình đọc thư không hiện HTML). */
function otpEmail(opts: { subject: string; name: string; otp: string; minutes: number; intro: string; ignoreNote: string }) {
  const { subject, name, otp, minutes, intro, ignoreNote } = opts;
  const text = [
    `Chào ${name},`,
    '',
    `${intro}: ${otp}`,
    `Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này cho bất kỳ ai.`,
    '',
    ignoreNote,
  ].join('\n');

  const html = `<!doctype html>
<html lang="vi"><body style="margin:0;padding:24px;background:#faf7f2;font-family:Arial,Helvetica,sans-serif;color:#29231d">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #eadfd0;border-radius:16px">
    <tr><td style="padding:28px 32px 8px;text-align:center">
      <div style="font-size:12px;letter-spacing:3px;color:#ae8131;font-weight:bold">WEDDY PLANNER</div>
      <div style="font-family:Georgia,serif;font-size:26px;color:#ae8131;font-weight:bold;margin-top:6px">WEBPLAN</div>
    </td></tr>
    <tr><td style="padding:16px 32px 28px">
      <p style="margin:0 0 12px">Chào ${escape(name)},</p>
      <p style="margin:0 0 16px">${intro}:</p>
      <div style="font-size:32px;letter-spacing:10px;font-weight:bold;text-align:center;background:#f5ebd8;border-radius:12px;padding:14px 0;color:#29231d">${otp}</div>
      <p style="margin:16px 0 0;font-size:14px;color:#756a5d">Mã có hiệu lực trong ${minutes} phút. Không chia sẻ mã này cho bất kỳ ai.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#948a7c">${ignoreNote}</p>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

/** Email gửi mã OTP đăng ký. */
export function registerOtpEmail(name: string, otp: string, minutes: number) {
  return otpEmail({
    subject: `${otp} là mã xác thực đăng ký WebPlan`,
    name,
    otp,
    minutes,
    intro: 'Mã xác thực đăng ký tài khoản WebPlan của bạn là',
    ignoreNote: 'Nếu bạn không đăng ký WebPlan, hãy bỏ qua email này.',
  });
}

/** Email gửi mã OTP đặt lại mật khẩu. */
export function resetPasswordOtpEmail(name: string, otp: string, minutes: number) {
  return otpEmail({
    subject: `${otp} là mã đặt lại mật khẩu WebPlan`,
    name,
    otp,
    minutes,
    intro: 'Mã đặt lại mật khẩu tài khoản WebPlan của bạn là',
    ignoreNote: 'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu hiện tại vẫn giữ nguyên.',
  });
}
