/*
 * Yêu cầu chỉnh sửa đơn tiệc cưới (đơn có sảnh): sảnh, ngày và số bàn ràng buộc nhau nên khách sửa chung một khối
 * (ReviseOrderDialog). Hàm thuần, có test: sảnh nào chọn được, tạm tính, cảnh báo, loại thay đổi và lời nhắn tự sinh.
 */
import type { RevisionChangeType } from '@/types/vendorOrder'

/** Mỗi bàn 10 khách (khớp backend GUESTS_PER_TABLE) */
export const GUESTS_PER_TABLE = 10

export interface HallLike {
  id: string
  name: string
  price: number
  capacity?: number | null
  minTables?: number | null
}

export interface VenueCurrent {
  hallId: string
  date: string
  tables: number
  /** Các dòng khác trọn gói (không theo bàn): giữ nguyên khi đổi */
  otherFixed: number
  /** Tổng đơn giá các dòng khác TÍNH THEO BÀN (vd thực đơn / bàn): nhân theo số bàn mới */
  otherPerTable: number
  total: number
  /** Tiền cọc đã nộp (0 khi chưa cọc): tổng mới không được thấp hơn */
  deposit: number
  /** Ngày cưới của khách (nhắc đổi cho khớp khi đổi ngày tiệc) */
  weddingDate: string | null
  /** Số khách dự kiến của đám cưới (nhắc khi số bàn không đủ chỗ) */
  guestCount: number | null
}

export interface VenueWanted {
  hallId: string
  date: string
  tables: number
}

/** Số bàn tối đa của sảnh theo sức chứa (khách), null khi sảnh không ghi sức chứa */
export const maxTables = (h: HallLike) => (h.capacity ? Math.floor(h.capacity / GUESTS_PER_TABLE) : null)

/** Khoảng số bàn của sảnh để hiện cho khách (đơn vị bàn, tránh lẫn "khách" với "bàn"): "20 – 40 bàn", "từ 20 bàn", "tối đa 40 bàn" */
export function tableRange(h: HallLike): string | null {
  const max = maxTables(h)
  if (h.minTables && max) return `${h.minTables} – ${max} bàn`
  if (h.minTables) return `từ ${h.minTables} bàn`
  if (max) return `tối đa ${max} bàn`
  return null
}

/**
 * Sảnh có chọn được với số bàn và ngày đang nhập không; lý do khi không. `busy`: sảnh kín ngày đó (không tính chính đơn này).
 * Sảnh đang dùng với đúng số bàn đang có thì luôn hợp lệ về số bàn (đã chốt trước khi NCC sửa sức chứa / tối thiểu); chỉ xét lại khi đổi số bàn.
 */
export function hallOption(h: HallLike, tables: number, busy: boolean, keep?: { currentHallId: string; currentTables: number }): { ok: boolean; reason: string | null } {
  if (busy) return { ok: false, reason: 'đã kín ngày này' }
  if (keep && h.id === keep.currentHallId && tables === keep.currentTables) return { ok: true, reason: null }
  const max = maxTables(h)
  if (max !== null && tables > max) return { ok: false, reason: `chỉ chứa tối đa ${max} bàn` }
  if (h.minTables && tables < h.minTables) return { ok: false, reason: `tối thiểu ${h.minTables} bàn` }
  return { ok: true, reason: null }
}

/** Tạm tính tổng mới theo giá niêm yết: số bàn × (giá bàn của sảnh + các dòng khác tính theo bàn) + các dòng trọn gói giữ nguyên. */
export const estimateTotal = (hall: HallLike, tables: number, cur: VenueCurrent) => tables * (hall.price + cur.otherPerTable) + cur.otherFixed

export interface VenueNotice {
  /** error: chặn gửi; warn: chỉ nhắc */
  level: 'error' | 'warn'
  text: string
}

const dmy = (s: string) => s.split('-').reverse().join('/')

/** Nhắc và chặn ngoài phần chọn sảnh: tổng mới thấp hơn cọc (chặn), ngày khác ngày cưới, số bàn ít hơn số khách dự kiến (nhắc). */
export function venueNotices(cur: VenueCurrent, want: VenueWanted, estimate: number | null, fmtMoney: (n: number) => string): VenueNotice[] {
  const out: VenueNotice[] = []
  if (estimate !== null && cur.deposit > 0 && estimate < cur.deposit) out.push({ level: 'error', text: `Tạm tính ${fmtMoney(estimate)} thấp hơn tiền cọc đã nộp ${fmtMoney(cur.deposit)}. Tăng số bàn hoặc chọn sảnh khác.` })
  if (cur.weddingDate && want.date !== cur.date && want.date !== cur.weddingDate) {
    out.push({ level: 'warn', text: `Ngày cưới của bạn đang là ${dmy(cur.weddingDate)}. Sau khi nhà hàng đổi ngày tiệc, nhớ đổi ngày cưới cho khớp.` })
  }
  if (cur.guestCount && want.tables > 0 && want.tables * GUESTS_PER_TABLE < cur.guestCount) {
    out.push({ level: 'warn', text: `${want.tables} bàn ≈ ${want.tables * GUESTS_PER_TABLE} chỗ, ít hơn ${cur.guestCount} khách dự kiến.` })
  }
  return out
}

/** Loại thay đổi tự đánh dấu theo những gì khách đã sửa (khách không phải tick). */
export function venueChanges(cur: VenueCurrent, want: VenueWanted): RevisionChangeType[] {
  const out: RevisionChangeType[] = []
  if (want.hallId !== cur.hallId) out.push('Item')
  if (want.tables !== cur.tables) out.push('Quantity')
  if (want.date !== cur.date) out.push('EventDate')
  return out
}

/** Lời nhắn tự sinh cho NCC: chỉ ghi phần đã đổi, kèm tạm tính khi đổi sảnh hoặc số bàn; `unchecked`: chưa kiểm tra được lịch sảnh. */
export function venueNote(cur: VenueCurrent, want: VenueWanted, hall: HallLike | undefined, fmtMoney: (n: number) => string, unchecked = false): string {
  const parts: string[] = []
  if (want.hallId !== cur.hallId && hall) parts.push(`Đổi sang ${hall.name}`)
  if (want.tables !== cur.tables) parts.push(`${cur.tables} → ${want.tables} bàn`)
  if (want.date !== cur.date) parts.push(`dời ngày ${dmy(cur.date)} → ${dmy(want.date)}`)
  if (hall && (want.hallId !== cur.hallId || want.tables !== cur.tables)) parts.push(`tạm tính ${fmtMoney(estimateTotal(hall, want.tables, cur))} (giá niêm yết)`)
  if (unchecked) parts.push('chưa kiểm tra được lịch sảnh, nhờ nhà hàng xác nhận')
  return parts.join('; ')
}

/** Thứ tự hiện sảnh: đang dùng trước, rồi sảnh chọn được, sảnh không chọn được (mờ) ở cuối; giữ thứ tự gốc trong mỗi nhóm. */
export function sortHalls<T extends { id: string }>(halls: readonly T[], currentId: string, ok: (h: T) => boolean): T[] {
  const rank = (h: T) => (h.id === currentId ? 0 : ok(h) ? 1 : 2)
  return halls.map((h, i) => ({ h, i })).sort((a, b) => rank(a.h) - rank(b.h) || a.i - b.i).map((x) => x.h)
}
