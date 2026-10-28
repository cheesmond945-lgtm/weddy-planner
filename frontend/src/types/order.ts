/*
 * Đơn dịch vụ phía khách dùng CHUNG kiểu với phía NCC (types/vendorOrder.ts, docs/api/orders.md, docs/THE_DON_PHIA_KHACH.md):
 * 7 trạng thái thô của CSDL, nhiều hạng mục, tỷ lệ cọc, hạn cọc, lịch sử chỉnh sửa, chứng từ.
 * Hợp đồng thanh toán: docs/api/payments.md
 */
export type { Invoice, InvoiceType, Order, OrderItem, OrderRevision, OrderStatus, RevisionChangeType } from './vendorOrder'

export type PaymentMethod = 'VNPAY_QR' | 'VNPAY_ATM' | 'INTERNATIONAL_CARD'

export interface PaymentCreated {
  paymentId: string
  /** Chuyển trình duyệt tới địa chỉ này (cổng VNPay) */
  paymentUrl: string
}
