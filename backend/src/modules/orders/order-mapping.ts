/*
 * Ánh xạ đơn hàng trong CSDL sang hợp đồng của frontend (docs/api/orders.md).
 *
 * CSDL có mô hình đơn giản hơn prototype: mỗi đơn chỉ có MỘT lần đặt cọc theo phần trăm (qua cổng thanh toán),
 * phần còn lại khách trả ngoài hệ thống; không có phiên bản đơn, phương án điều chỉnh hay minh chứng thanh toán.
 * Vì vậy: versions luôn có tối đa 1 phiên bản, adjustments rỗng, installments luôn là 2 đợt (cọc + còn lại).
 */
import type { Prisma } from '../../generated/prisma/client';

export const ORDER_INCLUDE = {
  order_items: { orderBy: { id: 'asc' as const } },
  payments: true,
  order_revisions: { orderBy: { created_date: 'desc' as const } },
  invoices: true,
  weddings: { select: { user_id: true } },
  vendor_profiles: { select: { id: true, user_id: true } },
} satisfies Prisma.ordersInclude;

export type OrderRow = Prisma.ordersGetPayload<{ include: typeof ORDER_INCLUDE }>;

/** Ngày thuần (cột @db.Date) -> "YYYY-MM-DD". */
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** Thời điểm (timestamptz) -> "YYYY-MM-DD" theo giờ Việt Nam. */
export const ymdVN = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
/** "YYYY-MM-DD" -> cuối ngày giờ Việt Nam. */
export const endOfDayVN = (s: string) => new Date(`${s}T23:59:00+07:00`);

export type ServiceOrderStatus = 'DRAFT' | 'AWAITING_CONFIRMATION' | 'REVISION_REQUESTED' | 'CONFIRMED' | 'CANCELLED';
export type OrderPaymentStatus = 'UNPAID' | 'AWAITING_DEPOSIT' | 'DEPOSIT_PAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERPAID';

const STATUS_OUT: Record<string, ServiceOrderStatus> = {
  Draft: 'DRAFT',
  Pending: 'AWAITING_CONFIRMATION',
  NeedRevision: 'REVISION_REQUESTED',
  Deposited: 'CONFIRMED',
  Completed: 'CONFIRMED',
  Expired: 'CANCELLED',
  Cancelled: 'CANCELLED',
};

export const serviceStatusOf = (status: string): ServiceOrderStatus => STATUS_OUT[status] ?? 'DRAFT';
export const paymentStatusOf = (status: string): OrderPaymentStatus => (status === 'Completed' ? 'PAID' : status === 'Deposited' ? 'DEPOSIT_PAID' : 'UNPAID');

export interface OrderContentDto {
  customerName: string;
  customerPhone: string;
  eventDate: string;
  note: string | null;
  lines: { id: string; packageId: string | null; name: string; unit: string; quantity: number; unitPrice: number; isPolicyFee: boolean }[];
  installments: { id: string; name: string; rate: number | null; amount: number; dueDate: string; method: 'VNPAY' | 'BANK_TRANSFER' | 'CASH'; note: string | null }[];
}

export function contentOf(o: OrderRow): OrderContentDto {
  const total = Number(o.total_amount);
  const deposit = Number(o.deposit_amount);
  const percent = Number(o.deposit_percent);
  return {
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    eventDate: ymd(o.event_date),
    note: o.note,
    lines: o.order_items.map((i) => ({
      id: i.id,
      packageId: null,
      name: i.item_name,
      unit: i.unit,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      isPolicyFee: false,
    })),
    installments: [
      {
        id: 'deposit',
        name: 'Đợt 1 – Đặt cọc',
        rate: percent,
        amount: deposit,
        dueDate: o.deposit_due_date ? ymdVN(o.deposit_due_date) : ymd(o.event_date),
        method: 'VNPAY',
        note: null,
      },
      { id: 'final', name: 'Đợt 2 – Thanh toán còn lại', rate: Math.round((100 - percent) * 100) / 100, amount: total - deposit, dueDate: ymd(o.event_date), method: 'CASH', note: null },
    ],
  };
}

/** Các thay đổi giữa hai nội dung đơn, dạng câu hiển thị (tin "gửi lại đơn"). */
export function contentChanges(prev: OrderContentDto, next: OrderContentDto): string[] {
  const out: string[] = [];
  const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
  if (prev.customerName !== next.customerName) out.push(`Tên khách: ${prev.customerName} → ${next.customerName}`);
  if (prev.customerPhone !== next.customerPhone) out.push(`Số điện thoại: ${prev.customerPhone} → ${next.customerPhone}`);
  if (prev.eventDate !== next.eventDate) out.push(`Ngày sự kiện: ${prev.eventDate} → ${next.eventDate}`);
  if ((prev.note ?? '') !== (next.note ?? '')) out.push('Ghi chú đơn đã thay đổi');
  const key = (l: { name: string }) => l.name.trim().toLowerCase();
  for (const n of next.lines) {
    const p = prev.lines.find((l) => key(l) === key(n));
    if (!p) out.push(`Thêm: ${n.name} (${n.quantity} ${n.unit})`);
    else {
      if (p.quantity !== n.quantity) out.push(`${n.name}: số lượng ${p.quantity} → ${n.quantity} ${n.unit}`);
      if (p.unitPrice !== n.unitPrice) out.push(`${n.name}: đơn giá ${money(p.unitPrice)} → ${money(n.unitPrice)}`);
    }
  }
  for (const p of prev.lines) if (!next.lines.some((l) => key(l) === key(p))) out.push(`Bỏ: ${p.name}`);
  const total = (c: OrderContentDto) => c.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  if (total(prev) !== total(next)) out.push(`Tổng tiền: ${money(total(prev))} → ${money(total(next))}`);
  const dp = prev.installments[0]?.rate;
  const dn = next.installments[0]?.rate;
  if (dp !== dn) out.push(`Tỷ lệ đặt cọc: ${dp}% → ${dn}%`);
  return out;
}

const latest = (...dates: (Date | null | undefined)[]) => new Date(Math.max(...dates.filter((d): d is Date => !!d).map((d) => d.getTime())));

/** Đơn phía NCC (kiểu ServiceOrder của frontend). */
export function toServiceOrder(o: OrderRow, conversationId: string, cancelReason: string | null) {
  const content = contentOf(o);
  const status = serviceStatusOf(o.status);
  const total = Number(o.total_amount);
  const deposit = Number(o.deposit_amount);
  const paidDeposit = o.payments?.status === 'Paid';
  const request = o.status === 'NeedRevision' ? o.order_revisions.find((r) => r.status === 'Requested') : undefined;
  const createdAt = o.created_date;

  const payments: {
    id: string;
    installmentId: string;
    installmentName: string;
    amount: number;
    paidAt: string;
    method: 'VNPAY' | 'BANK_TRANSFER' | 'CASH';
    plannedMethod: 'VNPAY' | 'BANK_TRANSFER' | 'CASH';
    recordedBy: 'SYSTEM' | 'VENDOR';
    proofFile: null;
    note: null;
  }[] = [];
  if (paidDeposit) {
    payments.push({
      id: o.payments!.id,
      installmentId: 'deposit',
      installmentName: content.installments[0].name,
      amount: deposit,
      paidAt: (o.payments!.paid_date ?? createdAt).toISOString(),
      method: 'VNPAY',
      plannedMethod: 'VNPAY',
      recordedBy: 'SYSTEM',
      proofFile: null,
      note: null,
    });
  }
  if (o.status === 'Completed') {
    payments.push({
      id: `final-${o.id}`,
      installmentId: 'final',
      installmentName: content.installments[1].name,
      amount: total - deposit,
      paidAt: (o.completed_date ?? createdAt).toISOString(),
      method: 'CASH',
      plannedMethod: 'CASH',
      recordedBy: 'VENDOR',
      proofFile: null,
      note: null,
    });
  }

  const history: { at: string; text: string }[] = [{ at: createdAt.toISOString(), text: 'Tạo đơn' }];
  if (status !== 'DRAFT') history.push({ at: createdAt.toISOString(), text: 'Gửi đơn cho khách' });
  for (const r of [...o.order_revisions].reverse()) {
    history.push({ at: r.created_date.toISOString(), text: `Khách yêu cầu chỉnh sửa${r.request_note ? `: ${r.request_note}` : ''}` });
    if (r.applied_date) history.push({ at: r.applied_date.toISOString(), text: 'Đã cập nhật và gửi lại đơn' });
  }
  if (paidDeposit) history.push({ at: (o.payments!.paid_date ?? createdAt).toISOString(), text: `Đã nhận cọc ${deposit.toLocaleString('vi-VN')}đ` });
  if (o.completed_date) history.push({ at: o.completed_date.toISOString(), text: 'Đã thu đủ, hoàn thành đơn' });
  if (o.cancelled_date) history.push({ at: o.cancelled_date.toISOString(), text: o.status === 'Expired' ? 'Đơn hết hạn đặt cọc' : 'Đơn đã hủy' });
  history.sort((a, b) => a.at.localeCompare(b.at));

  return {
    id: o.id,
    code: o.order_code,
    conversationId,
    status,
    paymentStatus: paymentStatusOf(o.status),
    versions: status === 'DRAFT' ? [] : [{ version: 1, sentAt: createdAt.toISOString(), content, changes: [] as string[], fromAdjustmentId: null }],
    draft: status === 'DRAFT' ? { kind: 'NEW' as const, baseVersion: null, content, savedAt: createdAt.toISOString() } : null,
    revisionRequest: request ? { version: 1, note: request.request_note ?? '', requestedAt: request.created_date.toISOString() } : null,
    adjustmentRequest: null,
    payments,
    adjustments: [] as unknown[],
    totalAmount: total,
    paidAmount: payments.reduce((s, p) => s + p.amount, 0),
    history,
    cancellation:
      o.status === 'Cancelled' || o.status === 'Expired'
        ? { reason: cancelReason ?? (o.status === 'Expired' ? 'Hết hạn đặt cọc' : ''), cancelledAt: (o.cancelled_date ?? createdAt).toISOString() }
        : null,
    createdAt: createdAt.toISOString(),
    updatedAt: latest(createdAt, o.completed_date, o.cancelled_date, o.payments?.paid_date, o.order_revisions[0]?.created_date).toISOString(),
  };
}

export type CoupleOrderStatus = 'SENT' | 'REVISION_REQUESTED' | 'PAID' | 'CANCELLED';

export const coupleStatusOf = (status: string): CoupleOrderStatus =>
  status === 'Deposited' || status === 'Completed' ? 'PAID' : status === 'NeedRevision' ? 'REVISION_REQUESTED' : status === 'Cancelled' || status === 'Expired' ? 'CANCELLED' : 'SENT';

/** Đơn phía cặp đôi (kiểu Order của frontend). */
export function toCoupleOrder(o: OrderRow, conversationId: string) {
  const request = o.status === 'NeedRevision' ? o.order_revisions.find((r) => r.status === 'Requested') : undefined;
  return {
    id: o.id,
    code: o.order_code,
    planItemId: o.vendor_profiles.id,
    serviceId: o.vendor_profiles.id,
    conversationId,
    packageName: o.order_items[0]?.item_name ?? '',
    serviceDate: ymd(o.event_date),
    totalAmount: Number(o.total_amount),
    depositAmount: Number(o.deposit_amount),
    status: coupleStatusOf(o.status),
    revisionNote: request?.request_note ?? null,
    paidAt: o.payments?.status === 'Paid' && o.payments.paid_date ? o.payments.paid_date.toISOString() : null,
  };
}
