/*
 * Đơn hàng trong CSDL -> DTO dùng chung cho cả cặp đôi và NCC (frontend/src/types/vendorOrder.ts, docs/api/orders.md).
 * Khách và NCC thấy cùng nội dung đơn (docs/api/THE_DON_HANG.md), chỉ khác nút. Trạng thái trả thô như CSDL
 * (Draft, Pending, NeedRevision, Deposited, Completed, Expired, Cancelled).
 *
 * CSDL: mỗi đơn chỉ có MỘT khoản trong hệ thống là tiền cọc (Payments); phần còn lại khách trả ngoài hệ thống.
 * Không có phiên bản đơn, đợt thanh toán tùy chỉnh hay phương án điều chỉnh.
 */
import type { Prisma } from '../../generated/prisma/client';
import { categorySlug } from '../catalog/services.service';

export const ORDER_INCLUDE = {
  order_items: { orderBy: { id: 'asc' as const } },
  payments: true,
  order_revisions: { orderBy: { created_date: 'desc' as const }, include: { order_revision_changes: true } },
  invoices: { orderBy: { created_date: 'asc' as const } },
  weddings: { select: { user_id: true, wedding_date: true } },
  vendor_profiles: { select: { id: true, user_id: true, business_name: true, service_categories: { select: { id: true, name: true } } } },
} satisfies Prisma.ordersInclude;

export type OrderRow = Prisma.ordersGetPayload<{ include: typeof ORDER_INCLUDE }>;

/** Ngày thuần (cột @db.Date) -> "YYYY-MM-DD". */
export const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
/** Thời điểm (timestamptz) -> "YYYY-MM-DD" theo giờ Việt Nam. */
export const ymdVN = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
/** Số ngày trả trễ so với hạn (ngày thanh toán theo giờ Việt Nam); null nếu chưa trả hoặc trả đúng hạn. */
export const lateDaysOf = (due: Date | null, paidAt: Date | null) => {
  if (!due || !paidAt) return null;
  const days = Math.round((Date.parse(`${ymdVN(paidAt)}T00:00:00Z`) - Date.parse(`${ymd(due)}T00:00:00Z`)) / 86_400_000);
  return days > 0 ? days : null;
};

const REVISION_CHANGE_ORDER = ['Item', 'Quantity', 'EventDate', 'Other'];

/**
 * Đơn dịch vụ cho cả hai phía. `serviceId` và `vendorName` để phía khách mở trang dịch vụ và hiện tên NCC;
 * `category` (lĩnh vực của NCC) để trang Kế hoạch của khách hiện đơn dưới đúng hạng mục.
 */
export function toOrderDto(o: OrderRow, conversationId: string) {
  const cancel = o as unknown as { cancel_reason?: string | null };
  const sent = o.status !== 'Draft';
  const cat = o.vendor_profiles!.service_categories!;
  return {
    id: o.id,
    orderCode: o.order_code,
    conversationId,
    serviceId: o.vendor_profiles!.id,
    vendorName: o.vendor_profiles!.business_name!,
    category: { id: cat.id, slug: categorySlug(cat.name), name: cat.name },
    status: o.status,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    eventDate: ymd(o.event_date),
    /** Ngày cưới của khách (null nếu chưa có), để form đơn điền sẵn và thẻ đơn báo khi ngày thực hiện lệch */
    weddingDate: ymd(o.weddings?.wedding_date ?? null) || null,
    items: o.order_items.map((i) => ({ id: i.id, itemName: i.item_name, unit: i.unit, quantity: i.quantity, unitPrice: Number(i.unit_price), amount: Number(i.amount) })),
    totalAmount: Number(o.total_amount),
    depositPercent: Number(o.deposit_percent),
    depositAmount: Number(o.deposit_amount),
    depositDueDate: o.deposit_due_date ? o.deposit_due_date.toISOString() : null,
    note: o.note,
    payment: sent
      ? { status: o.payments?.status === 'Paid' ? 'Paid' : 'Unpaid', paidDate: o.payments?.paid_date?.toISOString() ?? null, transactionCode: o.payments?.transaction_code ?? null }
      : null,
    revisions: o.order_revisions.map((r) => ({
      id: r.id,
      revisionType: r.revision_type,
      requestNote: r.request_note,
      changes: r.order_revision_changes.map((c) => c.change_type).sort((a, b) => REVISION_CHANGE_ORDER.indexOf(a) - REVISION_CHANGE_ORDER.indexOf(b)),
      oldTotalAmount: Number(r.old_total_amount),
      newTotalAmount: r.new_total_amount === null ? null : Number(r.new_total_amount),
      status: r.status,
      createdDate: (r.created_date ?? new Date(0)).toISOString(),
      appliedDate: r.applied_date ? r.applied_date.toISOString() : null,
    })),
    invoices: o.invoices.map((i) => ({ id: i.id, invoiceCode: i.invoice_code, type: i.type, createdDate: (i.created_date ?? new Date(0)).toISOString() })),
    completedDate: o.completed_date ? o.completed_date.toISOString() : null,
    cancelledDate: o.cancelled_date ? o.cancelled_date.toISOString() : null,
    cancelReason: cancel.cancel_reason ?? null,
    createdDate: (o.created_date ?? new Date(0)).toISOString(),
  };
}

export type OrderDto = ReturnType<typeof toOrderDto>;
