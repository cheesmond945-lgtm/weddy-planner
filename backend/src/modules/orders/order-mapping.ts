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
import { orderVersionOf } from './order-rules';
import { restPaymentOf } from './rest-payment';

export const ORDER_INCLUDE = {
  order_items: { orderBy: { id: 'asc' as const }, include: { service_packages: { select: { id: true, name: true } } } },
  payments: true,
  order_revisions: { orderBy: { created_date: 'desc' as const }, include: { order_revision_changes: true } },
  invoices: { orderBy: { created_date: 'asc' as const } },
  weddings: { select: { user_id: true, wedding_date: true } },
  vendor_profiles: { select: { id: true, user_id: true, status: true, business_name: true, service_categories: { select: { id: true, name: true } } } },
  service_packages: { select: { id: true, name: true } },
  /** Việc thanh toán phần còn lại 'PAY:<orderId>': Done = NCC đã nhận tiền mặt đợt 2 (rest-payment.ts) */
  timeline_tasks: { where: { task_code: { startsWith: 'PAY:' } }, select: { status: true, completed_date: true } },
} satisfies Prisma.ordersInclude;

export type OrderRow = Prisma.ordersGetPayload<{ include: typeof ORDER_INCLUDE }>;

/**
 * Đã chạy prisma/manual/2026-11-02-02-order-adjustments.sql (main.ts gọi lúc khởi động): đọc kèm yêu cầu đổi số khách.
 * Chưa chạy thì không thêm để câu truy vấn không lỗi.
 */
export function enableOrderAdjustments() {
  (ORDER_INCLUDE as Record<string, unknown>).order_adjustments = { orderBy: { created_date: 'desc' } };
}

type AdjustmentRow = {
  id: string;
  old_guest_count: number | null;
  new_guest_count: number;
  old_tables: number;
  new_tables: number;
  old_amount: unknown;
  new_amount: unknown;
  extra_deposit: unknown;
  status: string;
  note: string | null;
  created_date: Date;
  applied_date: Date | null;
};

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
  const cancel = o as unknown as {
    cancel_reason?: string | null;
    guest_count?: number | null;
    cancel_requested_date?: Date | null;
    cancel_request_note?: string | null;
    order_adjustments?: AdjustmentRow[];
  };
  const sent = o.status !== 'Draft';
  const cat = o.vendor_profiles!.service_categories!;
  return {
    id: o.id,
    /** Dấu vân tay nội dung đơn: form sửa gửi lại để chặn lưu đè khi đơn đã đổi ở nơi khác (orderVersionOf) */
    version: orderVersionOf(o),
    orderCode: o.order_code,
    conversationId,
    serviceId: o.vendor_profiles!.id,
    vendorName: o.vendor_profiles!.business_name!,
    category: { id: cat.id, slug: categorySlug(cat.name), name: cat.name },
    /** Sảnh (gói) của đơn, Trung tâm tiệc cưới (docs/LICH_BAN_SANH.md); null với dịch vụ khác và đơn cũ */
    package: o.service_packages ? { id: o.service_packages.id, name: o.service_packages.name ?? '' } : null,
    status: o.status,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    eventDate: ymd(o.event_date),
    /** Ngày cưới của khách (null nếu chưa có), để form đơn điền sẵn và thẻ đơn báo khi ngày thực hiện lệch */
    weddingDate: ymd(o.weddings?.wedding_date ?? null) || null,
    items: o.order_items.map((i) => ({
      id: i.id,
      itemName: i.item_name,
      unit: i.unit,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      amount: Number(i.amount),
      /** Gói dịch vụ của dòng (quy trình của gói sinh việc chi tiết khi cọc); null: dòng không gắn gói */
      packageId: i.package_id ?? null,
      packageName: i.service_packages?.name ?? null,
    })),
    totalAmount: Number(o.total_amount),
    /** Đợt 2 (phần còn lại, tiền mặt): Pending | Received | NotApplicable (đơn chưa cọc / hết hạn / đã hủy) */
    restPayment: restPaymentOf({ status: o.status, total: Number(o.total_amount), deposit: Number(o.deposit_amount) }, o.timeline_tasks[0] ?? null),
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
    /** Số khách của đơn tiệc (sau lần đổi số khách gần nhất); null với đơn cũ / dịch vụ khác */
    guestCount: cancel.guest_count ?? null,
    /** Khách yêu cầu hủy đơn đã cọc, chờ NCC xác nhận; null khi không có */
    cancelRequest: cancel.cancel_requested_date ? { requestedDate: cancel.cancel_requested_date.toISOString(), note: cancel.cancel_request_note ?? null } : null,
    /** Yêu cầu đổi số khách, mới nhất trước (status: AwaitingVendor, AwaitingDeposit, Applied, Rejected) */
    guestChanges: (cancel.order_adjustments ?? []).map((a) => ({
      id: a.id,
      oldGuestCount: a.old_guest_count,
      newGuestCount: a.new_guest_count,
      oldTables: a.old_tables,
      newTables: a.new_tables,
      oldAmount: Number(a.old_amount),
      newAmount: Number(a.new_amount),
      extraDeposit: Number(a.extra_deposit),
      status: a.status,
      note: a.note,
      createdDate: a.created_date.toISOString(),
      appliedDate: a.applied_date ? a.applied_date.toISOString() : null,
    })),
    createdDate: (o.created_date ?? new Date(0)).toISOString(),
  };
}

export type OrderDto = ReturnType<typeof toOrderDto>;
