import type { OrderStatus } from '@/types/order'
import type { PlanItem } from '@/types/wedding'

export interface QuickReply {
  label: string
  text: string
}

interface Context {
  /** Đơn mới nhất với NCC; null khi chưa có đơn */
  order: { orderCode: string; status: OrderStatus } | null
  categorySlug: string
  /** Gói của NCC đang có trong kế hoạch */
  packageName?: string | null
}

/**
 * Câu nhắn soạn sẵn ở khung chat theo giai đoạn với NCC: chưa có đơn (chi phí phát sinh, ưu đãi, lịch, xem thực tế), chờ cọc (hỏi về đơn,
 * gia hạn, chỉnh đơn), đã cọc (hẹn trao đổi, chốt chi tiết, phần còn lại), hoàn thành (cảm ơn, hóa đơn).
 * Đơn hết hạn / đã hủy coi như chưa có đơn, hết hạn thì có thêm "Gửi lại đơn".
 */
export function quickReplies({ order, categorySlug, packageName }: Context): QuickReply[] {
  const code = order?.orderCode
  switch (order?.status) {
    case 'Pending':
      return [
        { label: 'Hỏi về đơn', text: `Mình cần hỏi thêm về đơn ${code} trước khi đặt cọc ạ.` },
        { label: 'Xin gia hạn cọc', text: `Bên mình gia hạn thời gian đặt cọc đơn ${code} giúp mình thêm ít ngày được không ạ?` },
        { label: 'Muốn chỉnh đơn', text: `Mình muốn điều chỉnh một số nội dung trong đơn ${code} ạ.` },
      ]
    case 'NeedRevision':
      return [
        { label: 'Hỏi tiến độ chỉnh đơn', text: `Đơn ${code} bên mình chỉnh sửa xong chưa ạ?` },
        { label: 'Bổ sung yêu cầu', text: `Mình muốn bổ sung thêm yêu cầu cho đơn ${code} ạ.` },
      ]
    case 'Deposited':
      return [
        { label: 'Hẹn lịch trao đổi', text: 'Mình muốn hẹn lịch trao đổi chi tiết cho ngày cưới ạ. Bên mình có khung giờ nào phù hợp không?' },
        { label: 'Chốt chi tiết ngày cưới', text: 'Bên mình xác nhận giúp mình lại các hạng mục và giờ giấc trong ngày cưới nhé.' },
        { label: 'Hỏi phần còn lại', text: 'Cho mình hỏi phần còn lại thanh toán khi nào và bằng cách nào ạ?' },
      ]
    case 'Completed':
      return [
        { label: 'Gửi lời cảm ơn', text: 'Cảm ơn bên mình đã đồng hành cùng ngày cưới của tụi mình!' },
        { label: 'Xin hóa đơn', text: `Bên mình gửi giúp mình hóa đơn của đơn ${code} được không ạ?` },
        ...(categorySlug === 'chup-anh' ? [{ label: 'Hỏi ngày nhận ảnh', text: 'Cho mình hỏi khi nào tụi mình nhận được ảnh ạ?' }] : []),
      ]
    default:
      return [
        ...(order?.status === 'Expired' ? [{ label: 'Gửi lại đơn', text: `Đơn ${code} đã hết hạn đặt cọc, bên mình gửi lại đơn giúp mình được không ạ?` }] : []),
        // Giá từng gói đã có trên trang: hỏi thứ trang chưa nói (chi phí phát sinh, ưu đãi)
        { label: 'Hỏi chi phí phát sinh', text: `${packageName ? `Gói ${packageName}` : 'Gói dịch vụ bên mình'} có chi phí phát sinh nào ngoài giá niêm yết không ạ?` },
        { label: 'Hỏi ưu đãi', text: 'Hiện bên mình có ưu đãi nào cho ngày cưới của mình không ạ?' },
        { label: 'Hỏi lịch trống', text: 'Cho mình hỏi bên mình còn lịch trống vào ngày cưới của mình không ạ?' },
        categorySlug === 'nha-hang'
          ? { label: 'Đặt lịch tham quan', text: 'Mình muốn đặt lịch qua tham quan sảnh và tư vấn trực tiếp. Bên mình có khung giờ nào phù hợp không ạ?' }
          : { label: 'Xin ảnh thực tế', text: 'Bên mình gửi giúp mình thêm ảnh thực tế các buổi gần đây được không ạ?' },
      ]
  }
}


/**
 * Tên gói để nhắc trong câu soạn sẵn: chỉ gói khách tự chọn hoặc gói trong đơn NCC gửi.
 * Gói dự kiến do hệ thống tự tính, khách có thể chưa xem, nên không viết "mình đang quan tâm gói…".
 */
export function chosenPackageName(item: Pick<PlanItem, 'package'> | null | undefined): string | null {
  const p = item?.package
  return p && (p.source === 'SELECTED' || p.source === 'ORDER') && !p.unavailable ? p.name : null
}
