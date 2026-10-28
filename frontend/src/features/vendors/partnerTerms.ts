/** Điều khoản hợp tác dành cho đối tác Everly. Chỗ {{...}} do fillTerms điền theo hồ sơ NCC. */
export const TERMS_EFFECTIVE_DATE = '04/05/2026'

export interface TermsArticle {
  title: string
  /** Các đoạn văn của điều */
  paragraphs: string[]
  /** Danh sách gạch đầu dòng đi sau `paragraphs` (Điều 11) */
  bullets?: string[]
  /** Đoạn văn đi sau danh sách */
  after?: string[]
}

export const TERMS_INTRO =
  'Khi tích chọn “Tôi đã đọc và đồng ý Điều khoản hợp tác” và nộp hồ sơ, Đối tác {{TEN_DOANH_NGHIEP}} (loại dịch vụ: {{TEN_LOAI_DICH_VU}}) xác nhận đã đọc, hiểu và cam kết tuân thủ các điều khoản dưới đây.'

export const TERMS_ARTICLES: TermsArticle[] = [
  {
    title: 'Điều 1. Phí hoa hồng',
    paragraphs: [
      'Đối tác chiết khấu cho Everly {{TY_LE}}% trên giá trị đơn thực tế, theo tỷ lệ áp dụng cho loại dịch vụ {{TEN_LOAI_DICH_VU}}.',
      'Giá trị đơn thực tế là tổng giá trị cuối cùng của đơn trên Everly, sau mọi lần chỉnh sửa.',
      'Phí chỉ áp dụng khi khách hàng đã thanh toán hoàn tất cho Đối tác, tức là khi đơn chuyển sang trạng thái “Hoàn thành”. Đơn chuyển sang “Hoàn thành” khi Đối tác xác nhận sau ngày diễn ra sự kiện, hoặc khi hệ thống tự xác nhận sau 7 ngày kể từ ngày sự kiện.',
      'Đơn hết hạn cọc hoặc bị khách hủy không phát sinh hoa hồng.',
    ],
  },
  {
    title: 'Điều 2. Cam kết giá',
    paragraphs: [
      'Đối tác cam kết báo giá cho khách hàng từ Everly bằng hoặc tốt hơn mức giá niêm yết công khai trên Fanpage, Website hoặc tại cửa hàng của Đối tác.',
      'Tuyệt đối không kê giá hay tăng giá để bù trừ vào phí hoa hồng của nền tảng.',
      'Giá trên các gói dịch vụ đăng tại Everly phải là giá thật và được cập nhật khi có thay đổi.',
    ],
  },
  {
    title: 'Điều 3. Đảm bảo quyền lợi và khuyến mãi',
    paragraphs: [
      'Khách hàng từ Everly phải được áp dụng đầy đủ các khuyến mãi và quà tặng hiện hành mà Đối tác đang công bố công khai.',
      'Thay vào đó, Đối tác có thể cung cấp một ưu đãi độc quyền dành riêng cho người dùng Everly, với giá trị tương đương hoặc cao hơn.',
      'Tuyệt đối không cắt giảm ưu đãi của khách hàng với lý do khách đến từ Everly, hoặc để bù trừ vào phí hoa hồng.',
    ],
  },
  {
    title: 'Điều 4. Thanh toán hoa hồng',
    paragraphs: [
      'Everly lập bảng kê hoa hồng hằng tháng, gồm các đơn hoàn thành trong tháng.',
      'Đối tác chủ động đối soát và thanh toán toàn bộ hoa hồng của bảng kê chậm nhất ngày 25 của tháng kế tiếp, qua mã QR thanh toán trên hệ thống.',
      'Everly gửi thông báo nhắc trước hạn và khi bảng kê quá hạn.',
      'Nếu Đối tác cố tình không thanh toán hoa hồng, hoặc quá hạn thanh toán từ 15 ngày, Everly sẽ khóa tài khoản. Khi tài khoản bị khóa, các gói dịch vụ ngừng hiển thị và Đối tác không thể nhận đơn mới.',
    ],
  },
  {
    title: 'Điều 5. Giao dịch qua nền tảng',
    paragraphs: [
      'Với khách hàng tìm đến Đối tác qua Everly, mọi báo giá và chốt đơn phải được thực hiện qua hệ thống đơn của Everly.',
      'Đối tác không được lôi kéo khách hàng giao dịch ngoài nền tảng nhằm tránh phí hoa hồng.',
      'Nếu phát hiện vi phạm, Đối tác vẫn phải thanh toán hoa hồng cho giao dịch đó và có thể bị xử lý theo Điều 11.',
    ],
  },
  {
    title: 'Điều 6. Hồ sơ và giấy tờ pháp lý',
    paragraphs: [
      'Đối tác cam kết thông tin doanh nghiệp, mã số thuế, địa chỉ và giấy tờ cung cấp là thật, hợp lệ và còn hiệu lực.',
      'Khi có thay đổi, Đối tác phải cập nhật lại thông tin.',
      'Everly có quyền yêu cầu bổ sung giấy tờ.',
    ],
  },
  {
    title: 'Điều 7. Nội dung gói dịch vụ',
    paragraphs: [
      'Hình ảnh và mô tả gói dịch vụ phải đúng với dịch vụ thực tế Đối tác cung cấp.',
      'Đối tác phải sở hữu hoặc có quyền sử dụng hình ảnh đăng tải. Không được sử dụng hình ảnh của bên khác khi chưa được phép.',
      'Gói dịch vụ chỉ hiển thị với khách hàng sau khi được Everly duyệt.',
      'Everly có quyền yêu cầu chỉnh sửa nội dung sai lệch, phản cảm hoặc vi phạm pháp luật.',
    ],
  },
  {
    title: 'Điều 8. Thực hiện đơn và đặt cọc',
    paragraphs: [
      'Khi khách hàng đã đặt cọc, Đối tác có trách nhiệm thực hiện dịch vụ đúng hạng mục, đúng ngày và đúng chất lượng đã thỏa thuận trên đơn.',
      'Phần tiền còn lại do khách hàng thanh toán trực tiếp cho Đối tác. Khi khách hàng yêu cầu, Đối tác xuất hóa đơn cuối trên hệ thống.',
      'Mọi thay đổi về giá hoặc hạng mục sau khi khách cọc phải thực hiện qua chức năng chỉnh sửa đơn. Tổng giá trị mới không được thấp hơn số tiền khách đã cọc.',
    ],
  },
  {
    title: 'Điều 9. Giao tiếp với khách hàng',
    paragraphs: [
      'Đối tác phản hồi tin nhắn của khách hàng trong thời gian hợp lý, khuyến nghị trong vòng 24 giờ.',
      'Đối tác giao tiếp lịch sự và tôn trọng. Không spam, không quấy rối, không gửi nội dung không liên quan đến dịch vụ.',
    ],
  },
  {
    title: 'Điều 10. Bảo mật thông tin khách hàng',
    paragraphs: [
      'Thông tin khách hàng như họ tên, số điện thoại và ngày cưới chỉ được dùng để thực hiện đơn dịch vụ.',
      'Đối tác không được chia sẻ, bán hoặc sử dụng thông tin khách hàng cho mục đích quảng cáo khác khi chưa có sự đồng ý của khách hàng.',
      'Việc xử lý dữ liệu cá nhân phải tuân thủ quy định pháp luật về bảo vệ dữ liệu cá nhân.',
    ],
  },
  {
    title: 'Điều 11. Xử lý vi phạm',
    paragraphs: ['Tùy mức độ vi phạm, Everly có thể áp dụng một hoặc nhiều biện pháp sau:'],
    bullets: ['Nhắc nhở hoặc cảnh báo.', 'Khóa tài khoản.'],
    after: ['Khi bị khóa tài khoản, Đối tác vẫn phải hoàn thành các đơn khách đã đặt cọc và thanh toán đủ hoa hồng còn nợ.'],
  },
  {
    title: 'Điều 12. Thay đổi điều khoản và tỷ lệ hoa hồng',
    paragraphs: [
      'Everly có thể cập nhật điều khoản hoặc tỷ lệ hoa hồng và sẽ thông báo cho Đối tác ít nhất 30 ngày trước khi áp dụng.',
      'Tỷ lệ mới chỉ áp dụng cho các đơn hoàn thành sau ngày hiệu lực.',
      'Việc Đối tác tiếp tục sử dụng nền tảng sau ngày hiệu lực được xem là đồng ý với nội dung cập nhật.',
    ],
  },
  {
    title: 'Điều 13. Chấm dứt hợp tác',
    paragraphs: [
      'Khi muốn dừng hợp tác, Đối tác liên hệ với Everly để được ẩn hồ sơ khỏi nền tảng.',
      'Trước khi dừng hợp tác, Đối tác phải hoàn thành các đơn đã nhận cọc và thanh toán đủ hoa hồng còn nợ.',
    ],
  },
  {
    title: 'Điều 14. Vai trò của Everly',
    paragraphs: [
      'Everly là nền tảng kết nối khách hàng với Đối tác, không phải bên cung cấp dịch vụ cưới.',
      'Tranh chấp về chất lượng dịch vụ do Đối tác và khách hàng tự giải quyết. Everly hỗ trợ cung cấp lịch sử đơn và tin nhắn làm căn cứ.',
    ],
  },
]

export interface TermsVars {
  /** VendorProfiles.BusinessName */
  businessName: string | null
  /** ServiceCategories.Name theo VendorProfiles.CategoryId */
  categoryName: string | null
  /** ServiceCategories.CommissionRate (%) */
  commissionRate: number | null
}

/** Điền {{TEN_DOANH_NGHIEP}}, {{TEN_LOAI_DICH_VU}}, {{TY_LE}}, {{NGAY_HIEU_LUC}}. Thiếu dữ liệu thì để dấu chấm lửng, không để lộ {{...}}. */
export function fillTerms(text: string, v: TermsVars) {
  return text
    .replaceAll('{{TEN_DOANH_NGHIEP}}', v.businessName?.trim() || '…')
    .replaceAll('{{TEN_LOAI_DICH_VU}}', v.categoryName || '…')
    .replaceAll('{{TY_LE}}', v.commissionRate === null ? '…' : String(v.commissionRate))
    .replaceAll('{{NGAY_HIEU_LUC}}', TERMS_EFFECTIVE_DATE)
}
