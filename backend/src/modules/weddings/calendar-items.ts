/*
 * Lịch làm việc của NCC (docs/TIMELINE.md mục 9): gom ngày thực hiện của đơn và việc chi tiết của đơn đang thực hiện thành một danh sách
 * theo ngày. Hàm thuần: không đụng CSDL, không đọc đồng hồ. Ngày là chuỗi "YYYY-MM-DD".
 */
import { canTick, ownerOf, type TaskOwner } from './task-owner.ts';
import { templateOf } from './timeline-templates.ts';

/** Số ngày tối đa một lần hỏi lịch (đủ một lưới tháng 6 tuần). */
export const CALENDAR_MAX_DAYS = 100;

export interface CalendarOrder {
  id: string;
  code: string;
  status: string;
  eventDate: string;
  customerName: string;
}

export interface CalendarTask {
  id: string;
  /** Mã mẫu (task_code) */
  code: string | null;
  title: string;
  due: string;
  done: boolean;
  /** Đơn đang giữ việc */
  order: CalendarOrder;
}

export type CalendarItem =
  /** Ngày thực hiện của một đơn (chờ cọc, chờ chỉnh sửa, đã cọc, hoàn thành) */
  | { kind: 'ORDER'; id: string; orderId: string; orderCode: string; customerName: string; title: string; date: string; status: string; isDone: boolean }
  /** Việc chi tiết của đơn đã cọc */
  | { kind: 'TASK'; id: string; orderId: string; orderCode: string; customerName: string; title: string; date: string; isDone: boolean; owner: TaskOwner; canTick: boolean; overdue: boolean };

const ORDER_STATUSES = ['Pending', 'NeedRevision', 'Deposited', 'Completed'];

const ORDER_TITLE: Record<string, (code: string) => string> = {
  Pending: (c) => `Đơn ${c} (chờ cọc)`,
  NeedRevision: (c) => `Đơn ${c} (chờ chỉnh sửa)`,
  Deposited: (c) => `Thực hiện đơn ${c}`,
  Completed: (c) => `Đơn ${c} đã hoàn thành`,
};

/**
 * - Mỗi đơn có ngày thực hiện trong [from, to] thành một mốc ORDER.
 * - Việc chi tiết của đơn Deposited trong [from, to] thành TASK; việc "Ngày thực hiện" (EVENT) trùng đúng ngày thực hiện của đơn bị bỏ
 *   vì đã có mốc ORDER của ngày đó (tránh hai dòng cho một việc).
 * Sắp theo ngày; cùng ngày mốc ORDER đứng trước, rồi việc chưa xong trước việc đã xong.
 */
export function calendarItems(input: { orders: readonly CalendarOrder[]; tasks: readonly CalendarTask[]; from: string; to: string; today: string }): CalendarItem[] {
  const { from, to, today } = input;
  const inRange = (d: string) => d >= from && d <= to;
  const out: CalendarItem[] = [];

  for (const o of input.orders) {
    if (!ORDER_STATUSES.includes(o.status) || !inRange(o.eventDate)) continue;
    out.push({ kind: 'ORDER', id: o.id, orderId: o.id, orderCode: o.code, customerName: o.customerName, title: ORDER_TITLE[o.status](o.code), date: o.eventDate, status: o.status, isDone: o.status === 'Completed' });
  }

  for (const t of input.tasks) {
    if (t.order.status !== 'Deposited' || !inRange(t.due)) continue;
    if (templateOf(t.code)?.kind === 'EVENT' && t.due === t.order.eventDate) continue;
    const owner = ownerOf(t.code);
    out.push({
      kind: 'TASK',
      id: t.id,
      orderId: t.order.id,
      orderCode: t.order.code,
      customerName: t.order.customerName,
      title: t.title,
      date: t.due,
      isDone: t.done,
      owner,
      canTick: canTick('VENDOR', owner),
      overdue: !t.done && t.due < today,
    });
  }

  const rank = (i: CalendarItem) => (i.kind === 'ORDER' ? 0 : i.isDone ? 2 : 1);
  return out.sort((a, b) => a.date.localeCompare(b.date) || rank(a) - rank(b));
}
