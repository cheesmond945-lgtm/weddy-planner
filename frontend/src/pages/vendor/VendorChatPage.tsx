import { PageTitle } from '@/components/PageTitle'
import { VendorChatView } from '@/features/vendorChat/components/VendorChatView'

/** Tin nhắn: trao đổi với khách, lập đơn và gửi lại đơn ngay trong cuộc trò chuyện. */
export default function VendorChatPage() {
  return (
    <>
      <PageTitle title="Tin nhắn" description="Trao đổi với khách, lập đơn và gửi lại đơn ngay trong cuộc trò chuyện." />
      <VendorChatView />
    </>
  )
}
