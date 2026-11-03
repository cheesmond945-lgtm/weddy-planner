/*
 * Ai "gửi" một tin, suy theo loại tin để hiển thị đúng cả với tin cũ lưu sai sender (không sửa CSDL):
 *   FinalInvoice (hóa đơn cuối do NCC xuất) → VENDOR; DepositReceipt (giấy xác nhận cọc) → SYSTEM; các tin khác giữ sender trong dữ liệu.
 * Dùng chung cho chat NCC, chat khách và xem trước tin cuối ở danh sách hội thoại.
 */
export type Sender = 'COUPLE' | 'VENDOR' | 'SYSTEM'

export function effectiveSender(m: { sender: Sender; type: string }): Sender {
  if (m.type === 'FinalInvoice') return 'VENDOR'
  if (m.type === 'DepositReceipt') return 'SYSTEM'
  return m.sender
}
