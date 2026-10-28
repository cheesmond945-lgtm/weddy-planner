import { PartnerTermsDialog } from '@/features/vendors/components/PartnerTermsDialog'

/** TẠM THỜI: xem thử hộp thoại Điều khoản hợp tác với dữ liệu mẫu. Xóa cùng route /preview/terms sau khi xem xong. */
export default function TermsPreviewPage() {
  return <PartnerTermsDialog open onOpenChange={() => {}} vars={{ businessName: 'Công ty Mẫu', categoryName: 'Trang điểm', commissionRate: 10 }} />
}
