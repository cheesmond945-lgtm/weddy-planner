import { DepositTermsDialog } from '@/features/orders/components/DepositTermsDialog'

/** TẠM THỜI: xem thử hộp thoại Điều khoản đặt dịch vụ. Xóa cùng route /preview/deposit-terms sau khi xem xong. */
export default function DepositTermsPreviewPage() {
  return <DepositTermsDialog open onOpenChange={() => {}} />
}
