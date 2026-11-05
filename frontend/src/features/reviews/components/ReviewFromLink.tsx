import { useSearchParams } from 'react-router'
import { ReviewDialog } from './ReviewDialog'

/**
 * Mở form đánh giá từ link "?review=<orderId>" (thông báo "Đơn … đã hoàn thành, chia sẻ cảm nhận", hoặc NCC phản hồi đánh giá).
 * Đặt một lần trong layout phía khách; đóng form thì bỏ tham số khỏi địa chỉ.
 */
export function ReviewFromLink() {
  const [params, setParams] = useSearchParams()
  const orderId = params.get('review')
  if (!orderId) return null
  return (
    <ReviewDialog
      orderId={orderId}
      onClose={() =>
        setParams(
          (p) => {
            const next = new URLSearchParams(p)
            next.delete('review')
            return next
          },
          { replace: true },
        )
      }
    />
  )
}
