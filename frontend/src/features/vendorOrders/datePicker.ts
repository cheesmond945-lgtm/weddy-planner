/*
 * Lịch chọn ngày cho việc chi tiết (popover "Đổi ngày"): các ô ngày của một tháng và trạng thái từng ô. Hàm thuần, dùng lưới tháng có sẵn
 * (features/calendar/monthGrid.ts, tuần bắt đầu thứ Hai). Ngày là "YYYY-MM-DD", tháng là "YYYY-MM".
 */
import { monthGrid, monthOf } from '../calendar/monthGrid.ts'

export interface PickerDay {
  date: string
  /** Ngày trong tháng (1..31) để vẽ */
  day: number
  /** Thuộc tháng đang xem (ô đệm đầu / cuối lưới thì false) */
  inMonth: boolean
  /** Trước hôm nay hoặc sau ngày thực hiện + 120: mờ, không bấm được */
  disabled: boolean
  /** Ngày hiện tại của việc (tô đặc) */
  selected: boolean
  isToday: boolean
  /** Ngày thực hiện của đơn (chấm nhỏ) */
  isEvent: boolean
}

export interface PickerOptions {
  /** Ngày hiện tại của việc */
  value: string
  today: string
  /** Ngày thực hiện của đơn; rỗng nếu không biết */
  eventDate: string
  /** Ngày sớm nhất chọn được (hôm nay) */
  min: string
  /** Ngày muộn nhất chọn được (ngày thực hiện + 120); không có thì không giới hạn */
  max?: string
}

export function pickerDays(month: string, o: PickerOptions): PickerDay[] {
  return monthGrid(month).map((g) => ({
    date: g.date,
    day: Number(g.date.slice(8, 10)),
    inMonth: g.inMonth,
    disabled: g.date < o.min || (!!o.max && g.date > o.max),
    selected: g.date === o.value,
    isToday: g.date === o.today,
    isEvent: !!o.eventDate && g.date === o.eventDate,
  }))
}

/** Còn tháng trước để lùi tới (tháng của ngày sớm nhất chọn được là tháng cuối cùng). */
export interface PopoverPlacement {
  top: number
  left: number
}

/**
 * Vị trí (position: fixed) của lịch so với nút mở: mép PHẢI lịch thẳng mép phải nút, kẹp trong khung nhìn (cách mép 8px);
 * lật lên trên nút khi phía dưới không đủ chỗ mà phía trên đủ.
 */
export function placePopover(anchor: { top: number; bottom: number; right: number }, view: { width: number; height: number }, size: { width: number; height: number }): PopoverPlacement {
  const gap = 6
  const margin = 8
  const up = view.height - anchor.bottom < size.height + margin + gap && anchor.top > size.height + margin + gap
  return {
    top: up ? anchor.top - size.height - gap : anchor.bottom + gap,
    left: Math.max(margin, Math.min(view.width - size.width - margin, anchor.right - size.width)),
  }
}

export const canGoPrev = (month: string, min: string) => monthOf(min) < month

/** Còn tháng sau để tiến tới (không giới hạn nếu không có ngày muộn nhất). */
export const canGoNext = (month: string, max?: string) => !max || month < monthOf(max)
