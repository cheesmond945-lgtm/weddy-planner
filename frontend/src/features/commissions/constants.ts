import type { BadgeTone } from '@/components/Badge'

/** Hạn nộp: ngày 25 của tháng sau kỳ (CSDL mục 9.8). Tỷ lệ hoa hồng do backend tính, giao diện không tự tính. */
export const COMMISSION_DUE_DAY = 25

/** Trạng thái hiển thị của bảng kê: CSDL chỉ có Unpaid/Paid, hai trạng thái còn lại tính theo ngày hiện tại. */
export type StatementState = 'provisional' | 'unpaid' | 'overdue' | 'paid'

export const STATEMENT_STATE: Record<StatementState, { label: string; tone: BadgeTone }> = {
  provisional: { label: 'Đang tạm tính', tone: 'info' },
  unpaid: { label: 'Chưa nộp', tone: 'wait' },
  overdue: { label: 'Quá hạn', tone: 'warn' },
  paid: { label: 'Đã nộp', tone: 'done' },
}
