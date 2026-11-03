/**
 * Đổi số khách của đơn tiệc đã cọc (không DB, không Nest). Unit test: backend/test/order-adjustment-rules.test.cjs.
 * Đặc tả: docs/api/orders.md, mục "Đổi số khách khi tiệc đã cọc".
 *
 * - Chỉ trong hạn: hôm nay ≤ ngày thực hiện − GUEST_CHANGE_CUTOFF_DAYS.
 * - Kiểm tra sức chứa của sảnh.
 * - Giá trị đơn mới = giá trị cũ − dòng tiền bàn + đơn giá lúc đặt × max(số bàn mới, số bàn tối thiểu); số bàn tối thiểu
 *   không vượt số bàn đã thỏa thuận trong đơn.
 * - Cọc bổ sung = EXTRA_DEPOSIT_RATE × phần tăng; giảm khách thì không hoàn cọc (giá trị đơn không thấp hơn số đã cọc).
 */
import { GUEST_CHANGE_CUTOFF_DAYS } from '../weddings/allocation.config';
import { GUESTS_PER_TABLE } from '../weddings/budget.config';

/** Tỷ lệ cọc bổ sung trên phần tăng của giá trị đơn */
export const EXTRA_DEPOSIT_RATE = 0.1;

export interface TableLine {
  /** Đơn giá/bàn lúc đặt */
  unitPrice: number;
  /** Số bàn đang tính tiền */
  quantity: number;
  amount: number;
}

export interface GuestChangeInput {
  orderTotal: number;
  deposit: number;
  table: TableLine;
  minTables: number | null;
  /** Sức chứa của sảnh; null khi không ghi */
  capacity: number | null;
  oldGuestCount: number | null;
  newGuestCount: number;
  /** YYYY-MM-DD */
  eventDate: string;
  today: string;
}

export type GuestChangeQuote =
  | {
      ok: true;
      oldTables: number;
      newTables: number;
      /** Số bàn tính tiền = max(số bàn mới, tối thiểu) */
      chargedTables: number;
      oldAmount: number;
      newAmount: number;
      extraDeposit: number;
      /** Hạn cuối gửi yêu cầu (YYYY-MM-DD) */
      deadline: string;
    }
  | { ok: false; code: 'INVALID' | 'SAME' | 'CUTOFF' | 'CAPACITY'; message: string };

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
const dmy = (d: string) => d.split('-').reverse().join('/');

/** Ngày cuối được gửi yêu cầu đổi số khách: ngày thực hiện − GUEST_CHANGE_CUTOFF_DAYS */
export function guestChangeDeadline(eventDate: string) {
  const d = new Date(`${eventDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - GUEST_CHANGE_CUTOFF_DAYS);
  return d.toISOString().slice(0, 10);
}

export function quoteGuestChange(i: GuestChangeInput): GuestChangeQuote {
  if (!Number.isInteger(i.newGuestCount) || i.newGuestCount < 1 || i.newGuestCount > 100000) return { ok: false, code: 'INVALID', message: 'Số khách là số nguyên từ 1.' };
  if (i.oldGuestCount !== null && i.newGuestCount === i.oldGuestCount) return { ok: false, code: 'SAME', message: 'Số khách mới trùng với số khách của đơn.' };
  const deadline = guestChangeDeadline(i.eventDate);
  if (i.today > deadline) {
    return { ok: false, code: 'CUTOFF', message: `Chỉ đổi số khách được đến hết ngày ${dmy(deadline)} (${GUEST_CHANGE_CUTOFF_DAYS} ngày trước ngày tổ chức). Bạn nhắn nhà cung cấp trong chat nhé.` };
  }
  if (i.capacity !== null && i.newGuestCount > i.capacity) {
    return { ok: false, code: 'CAPACITY', message: `Sảnh tối đa ${i.capacity.toLocaleString('vi-VN')} khách, không đủ cho ${i.newGuestCount.toLocaleString('vi-VN')} khách. Hãy trao đổi với nhà cung cấp để đổi sảnh.` };
  }
  const newTables = Math.max(1, Math.ceil(i.newGuestCount / GUESTS_PER_TABLE));
  // Tối thiểu của sảnh không vượt số bàn đã thỏa thuận trong đơn (sảnh tăng tối thiểu sau khi đặt, hoặc NCC đã nhận đơn ít bàn hơn)
  const floor = Math.min(i.minTables ?? 0, i.table.quantity);
  const chargedTables = Math.max(newTables, floor, 1);
  // Giảm khách không hoàn cọc: giá trị đơn không thấp hơn số đã cọc
  const newAmount = Math.max(i.deposit, Math.round(i.orderTotal - i.table.amount + i.table.unitPrice * chargedTables));
  const extraDeposit = Math.round(Math.max(0, newAmount - i.orderTotal) * EXTRA_DEPOSIT_RATE);
  return { ok: true, oldTables: i.table.quantity, newTables, chargedTables, oldAmount: i.orderTotal, newAmount, extraDeposit, deadline };
}

/** Dòng tiền bàn của đơn tiệc: dòng gắn đúng sảnh của đơn, không có thì dòng có đơn vị "bàn"/"mâm" */
export function tableLineOf<T extends { package_id?: string | null; unit?: string | null }>(items: T[], packageId: string | null) {
  return items.find((x) => packageId && x.package_id === packageId) ?? items.find((x) => /bàn|mâm/i.test(x.unit ?? '')) ?? null;
}

export { vnd as adjustmentMoney };
