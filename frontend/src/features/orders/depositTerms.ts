/** Điều khoản đặt dịch vụ dành cho khách hàng (cặp đôi). */
export interface DepositTermsArticle {
  title: string
  body: string
  /** Điều khách dễ bị ảnh hưởng nhất, hiện nhãn "Quan trọng" */
  key?: boolean
}

export const DEPOSIT_TERMS_INTRO = 'Khi tích chọn “Tôi đã đọc và đồng ý Điều khoản đặt dịch vụ” và bấm “Thanh toán cọc”, bạn xác nhận đã đọc, hiểu và đồng ý với các điều khoản dưới đây.'

export const DEPOSIT_TERMS_ARTICLES: DepositTermsArticle[] = [
  {
    title: 'Điều 1. Hủy đơn sau khi đặt cọc',
    key: true,
    body: 'Sau khi thanh toán cọc thành công, nếu bạn hủy đơn thì khoản cọc sẽ không được hoàn lại. Đơn chuyển sang trạng thái “Đã hủy” và các công việc liên quan trong timeline sẽ bị xóa.',
  },
  {
    title: 'Điều 2. Kiểm tra đơn trước khi cọc',
    body: 'Bạn có trách nhiệm kiểm tra kỹ hạng mục, số lượng, đơn giá, ngày thực hiện và tổng tiền trước khi thanh toán. Nếu thấy chưa đúng, hãy bấm “Yêu cầu chỉnh sửa” thay vì thanh toán.',
  },
  {
    title: 'Điều 3. Hạn thanh toán cọc',
    body: 'Đơn có hiệu lực thanh toán trong 24 giờ kể từ lúc nhà cung cấp gửi. Quá hạn, đơn tự động hết hạn và bạn cần nhắn nhà cung cấp gửi lại đơn mới.',
  },
  {
    title: 'Điều 4. Cách thanh toán',
    body: 'Thanh toán bằng chuyển khoản qua mã QR hiển thị trên đơn, đúng số tiền và giữ nguyên nội dung chuyển khoản. Chuyển sai số tiền hoặc sửa nội dung có thể khiến hệ thống không tự xác nhận được. Everly chỉ ghi nhận các khoản cọc thanh toán qua hệ thống. Khoản chuyển trực tiếp cho nhà cung cấp ngoài nền tảng không được Everly ghi nhận hay hỗ trợ.',
  },
  {
    title: 'Điều 5. Số tiền cọc cố định',
    body: 'Sau khi cọc, tỷ lệ và số tiền cọc không thay đổi, kể cả khi đơn được chỉnh sửa sau đó.',
  },
  {
    title: 'Điều 6. Chỉnh sửa đơn sau khi cọc',
    key: true,
    body: 'Bạn vẫn có thể yêu cầu đổi hạng mục, số lượng hoặc ngày thực hiện. Nhà cung cấp có quyền chấp nhận hoặc từ chối. Tổng giá trị đơn sau chỉnh sửa không được thấp hơn số tiền đã cọc, và phần cọc không được hoàn lại dù đơn giảm giá trị.',
  },
  {
    title: 'Điều 7. Thanh toán phần còn lại',
    body: 'Phần còn lại (tổng đơn trừ tiền cọc) bạn thanh toán trực tiếp cho nhà cung cấp theo thỏa thuận giữa hai bên. Bạn có thể yêu cầu nhà cung cấp xuất hóa đơn cuối sau khi dịch vụ hoàn thành.',
  },
]
