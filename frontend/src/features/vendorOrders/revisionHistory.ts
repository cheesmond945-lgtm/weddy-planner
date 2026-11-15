import type { OrderRevision, RevisionChangeType } from '@/types/vendorOrder'

/** Một bước trong thẻ lịch sử: khách gửi yêu cầu, hoặc NCC sửa đơn. */
export interface HistoryStep {
  /** ISO */
  date: string
  note: string | null
  changes: RevisionChangeType[]
}

/** Một thẻ "Lịch sử chỉnh sửa": yêu cầu của khách (nếu có) và lần NCC sửa đáp ứng yêu cầu đó (nếu đã sửa). */
export interface HistoryEntry {
  id: string
  revisionType: OrderRevision['revisionType']
  status: OrderRevision['status']
  /** Thời điểm của thẻ (lúc NCC sửa; chưa sửa thì lúc khách gửi), ISO */
  at: string
  request: HistoryStep | null
  edit: HistoryStep | null
  oldTotal: number
  newTotal: number | null
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN)
/** Hai mốc ghi trong cùng một lần lưu (cùng transaction) cách nhau vài mili giây */
const SAME_SAVE_MS = 5_000

/**
 * Ghép dòng OrderRevisions thành thẻ lịch sử (mới nhất trước). Dữ liệu không đổi, chỉ cách hiển thị:
 * - Sau cọc, NCC sửa đơn khi khách đang có yêu cầu: backend đánh dấu yêu cầu Applied VÀ tạo thêm một dòng của NCC trong cùng lần lưu.
 *   Hai dòng này ghép thành một thẻ (khớp theo thời điểm áp dụng); tổng lấy theo dòng của NCC (thay đổi thật).
 * - Dòng của NCC (tạo và áp dụng cùng lúc) không có yêu cầu đi kèm: thẻ chỉ có phần NCC sửa.
 * - Trước cọc: một dòng duy nhất; có lời nhắn là yêu cầu của khách đã được NCC xử lý, không lời nhắn là NCC tự sửa.
 * - Yêu cầu đang chờ / bị từ chối: thẻ chỉ có phần khách yêu cầu.
 */
export function revisionHistory(revisions: readonly OrderRevision[]): HistoryEntry[] {
  const isVendorEdit = (r: OrderRevision) => r.revisionType === 'AfterDeposit' && r.status === 'Applied' && Math.abs(ms(r.appliedDate) - ms(r.createdDate)) < SAME_SAVE_MS
  const step = (r: OrderRevision, date: string): HistoryStep => ({ date, note: r.requestNote, changes: r.changes })
  const used = new Set<string>()
  const out: HistoryEntry[] = []

  for (const r of revisions) {
    if (used.has(r.id)) continue
    used.add(r.id)
    const base = { id: r.id, revisionType: r.revisionType, status: r.status, oldTotal: r.oldTotalAmount, newTotal: r.newTotalAmount }

    if (r.revisionType === 'BeforeDeposit') {
      const applied = r.status === 'Applied' && r.appliedDate
      out.push({
        ...base,
        at: applied ? r.appliedDate! : r.createdDate,
        request: r.requestNote || r.changes.length ? step(r, r.createdDate) : null,
        edit: applied ? { date: r.appliedDate!, note: null, changes: [] } : null,
      })
      continue
    }

    if (isVendorEdit(r)) {
      // Yêu cầu của khách được áp dụng trong cùng lần NCC lưu (nếu có)
      const req = revisions.find((x) => !used.has(x.id) && x.revisionType === 'AfterDeposit' && x.status === 'Applied' && !isVendorEdit(x) && Math.abs(ms(x.appliedDate) - ms(r.appliedDate)) < SAME_SAVE_MS)
      if (req) used.add(req.id)
      out.push({ ...base, at: r.appliedDate!, request: req ? step(req, req.createdDate) : null, edit: step(r, r.appliedDate!) })
      continue
    }

    // Yêu cầu sau cọc: đang chờ, bị từ chối, hoặc đã áp dụng nhưng không tìm thấy dòng của NCC đi kèm
    const vendor = r.status === 'Applied' ? revisions.find((x) => !used.has(x.id) && isVendorEdit(x) && Math.abs(ms(x.appliedDate) - ms(r.appliedDate)) < SAME_SAVE_MS) : undefined
    if (vendor) {
      used.add(vendor.id)
      out.push({ ...base, oldTotal: vendor.oldTotalAmount, newTotal: vendor.newTotalAmount, at: vendor.appliedDate!, request: step(r, r.createdDate), edit: step(vendor, vendor.appliedDate!) })
    } else {
      out.push({ ...base, at: r.status === 'Applied' && r.appliedDate ? r.appliedDate : r.createdDate, request: step(r, r.createdDate), edit: r.status === 'Applied' && r.appliedDate ? { date: r.appliedDate, note: null, changes: [] } : null })
    }
  }
  return out.sort((a, b) => ms(b.at) - ms(a.at))
}
