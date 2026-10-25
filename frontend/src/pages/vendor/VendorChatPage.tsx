import { VendorChatView } from '@/features/vendorChat/components/VendorChatView'

/** Tin nhắn: trao đổi với khách, lập đơn và gửi lại đơn ngay trong cuộc trò chuyện. */
export default function VendorChatPage() {
  return (
    <>
      <h1 className="sr-only">Tin nhắn</h1>
      <VendorChatView />
    </>
  )
}
