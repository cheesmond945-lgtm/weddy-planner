/**
 * Chế độ thử thanh toán: chỉ bật khi PAYMENT_DEMO_MODE đúng bằng "true".
 * Bật thì cặp đôi (đặt cọc) và nhà cung cấp (hoa hồng) có nút "Tôi đã thanh toán" để ghi nhận ngay, không cần chuyển tiền.
 * Tắt (xóa biến hoặc đặt khác "true") thì các API demo-confirm trả 404.
 */
export const demoPaymentEnabled = () => process.env.PAYMENT_DEMO_MODE === 'true';
