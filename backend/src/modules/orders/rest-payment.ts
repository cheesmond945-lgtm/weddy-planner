/*
 * Ghi nhận đợt 2 (phần còn lại, tiền mặt trả trực tiếp cho NCC) mà KHÔNG đổi cấu trúc CSDL (docs/THANH_TOAN_HIEN_TRANG.md, phương án A).
 *
 * Quy ước: việc timeline 'PAY:<orderId>' ở status Done = NCC đã nhận đủ tiền mặt phần còn lại, completed_date của việc = ngày nhận;
 * Waiting (hoặc Todo) = chưa nhận. Đơn cũ chưa có việc PAY: coi là chưa nhận; ghi nhận sẽ tự tạo việc.
 * Module không import Nest / Prisma client để test bằng hàm thuần và CSDL giả (RestDb).
 */
import { PAY_PREFIX, payCode, payDate } from '../weddings/timeline-rows.ts';

export type RestStatus = 'Pending' | 'Received' | 'NotApplicable';

export interface RestPayment {
  /** Số tiền đợt 2 = tổng − cọc */
  amount: number;
  /** NotApplicable: đơn chưa cọc / hết hạn / đã hủy */
  status: RestStatus;
  /** Ngày nhận (ISO) khi Received */
  receivedDate: string | null;
}

export interface PayTaskLike {
  status: string | null;
  completed_date: Date | null;
}

/** Trạng thái đợt 2 từ đơn và việc PAY (có thể không có). */
export function restPaymentOf(order: { status: string | null; total: number; deposit: number }, pay?: PayTaskLike | null): RestPayment {
  const amount = Math.max(0, order.total - order.deposit);
  if (order.status !== 'Deposited' && order.status !== 'Completed') return { amount, status: 'NotApplicable', receivedDate: null };
  if (pay?.status === 'Done') return { amount, status: 'Received', receivedDate: pay.completed_date ? pay.completed_date.toISOString() : null };
  return { amount, status: 'Pending', receivedDate: null };
}

export const isRestPayCode = (code: string | null | undefined) => !!code && code.startsWith(PAY_PREFIX);

/** Kéo / đổi việc PAY sang Done chính là ghi nhận đã nhận tiền mặt (cùng một đường xử lý, có thông báo). */
export const recordsRestPayment = (code: string | null | undefined, next: string) => isRestPayCode(code) && next === 'Done';

export interface RuleError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

/** Chặn xuất hóa đơn cuối khi chưa ghi nhận đã nhận tiền mặt đợt 2. */
export function finalInvoiceGate(rest: RestPayment): RuleError | null {
  return rest.status === 'Received'
    ? null
    : { code: 'REST_PAYMENT_NOT_RECORDED', message: `Hãy ghi nhận đã nhận ${money(rest.amount)} phần còn lại trước khi xuất hóa đơn cuối.`, status: 409, details: { amount: rest.amount } };
}

/**
 * Chặn "Bỏ ghi nhận" khi đơn đã xuất hóa đơn cuối: hóa đơn ghi "đã thanh toán tiền mặt" và không hủy hay xuất lại được,
 * nên bỏ ghi nhận sẽ làm hóa đơn và trạng thái đợt 2 mâu thuẫn nhau. `finalInvoiceCode` là mã hóa đơn cuối của đơn (null nếu chưa có).
 */
export function clearRestGate(finalInvoiceCode: string | null): RuleError | null {
  return finalInvoiceCode
    ? { code: 'REST_PAYMENT_HAS_FINAL_INVOICE', message: `Đơn đã xuất hóa đơn cuối ${finalInvoiceCode}, không thể bỏ ghi nhận đã nhận tiền.`, status: 409, details: { invoiceCode: finalInvoiceCode } }
    : null;
}

/**
 * Hoàn tất đơn: đã Received thì hoàn tất bình thường; chưa mà NCC gửi restReceived = true thì ghi nhận rồi hoàn tất cùng transaction ('record');
 * chưa mà không gửi thì 409 REST_PAYMENT_NOT_RECORDED kèm số tiền để giao diện hỏi lại.
 */
export function completeGate(rest: RestPayment, restReceived: unknown): 'ok' | 'record' | RuleError {
  if (rest.status === 'Received') return 'ok';
  if (restReceived === true) return 'record';
  return { code: 'REST_PAYMENT_NOT_RECORDED', message: `Bạn đã nhận đủ ${money(rest.amount)} phần còn lại chưa? Hãy ghi nhận trước khi hoàn tất.`, status: 409, details: { amount: rest.amount } };
}

/** Điều kiện các việc chi tiết còn mở mà hoàn thành đơn được đóng: mọi việc chưa Done TRỪ việc thanh toán phần còn lại (PAY:). */
export const closableDetailTasksWhere = (orderId: string) => ({
  order_id: orderId,
  task_type: 'Detail',
  status: { not: 'Done' },
  OR: [{ task_code: null }, { NOT: { task_code: { startsWith: PAY_PREFIX } } }],
});

/** Phần của Prisma (hoặc transaction) mà ghi nhận cần; khai báo kiểu method để PrismaService gán được. */
export interface RestDb {
  timeline_tasks: {
    findFirst(args: unknown): Promise<{ id: string; status: string | null } | null>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
}

export interface RestOrder {
  id: string;
  wedding_id: string | null;
  category_id: string | null;
  event_date: Date;
  vendorName: string;
}

/**
 * Ghi nhận đã nhận tiền mặt: việc PAY:<orderId> thành Done, completed_date = `now`. Chưa có việc (đơn cũ) thì tạo giống lúc cọc
 * (hạn = đúng ngày thực hiện). Trả true nếu có thay đổi (lần đầu), false nếu đã ghi nhận từ trước.
 */
export async function applyRestReceived(db: RestDb, order: RestOrder, now: Date): Promise<boolean> {
  const code = payCode(order.id);
  const existing = await db.timeline_tasks.findFirst({ where: { order_id: order.id, task_code: code }, select: { id: true, status: true } });
  if (existing) {
    if (existing.status === 'Done') return false;
    await db.timeline_tasks.update({ where: { id: existing.id }, data: { status: 'Done', completed_date: now } });
    return true;
  }
  if (!order.wedding_id) return false;
  await db.timeline_tasks.create({
    data: {
      wedding_id: order.wedding_id,
      category_id: order.category_id,
      order_id: order.id,
      title: `Thanh toán phần còn lại cho ${order.vendorName.trim() || 'nhà cung cấp'}`,
      scheduled_date: new Date(`${payDate(order.event_date.toISOString().slice(0, 10))}T00:00:00Z`),
      status: 'Done',
      completed_date: now,
      task_type: 'Detail',
      task_code: code,
      display_order: 1000,
    },
  });
  return true;
}

/** Bỏ ghi nhận: việc PAY đã Done về Waiting, xóa ngày nhận. Trả true nếu có việc được đổi. */
export async function clearRestReceived(db: RestDb, orderId: string): Promise<boolean> {
  const r = await db.timeline_tasks.updateMany({ where: { order_id: orderId, task_code: payCode(orderId), status: 'Done' }, data: { status: 'Waiting', completed_date: null } });
  return r.count > 0;
}
