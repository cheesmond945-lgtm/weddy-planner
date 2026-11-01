/*
 * Việc NCC khai theo gói (tab "Công việc"): logic thuần của danh sách đang sửa trên màn.
 * Danh sách luôn xếp theo mốc (offsetDays tăng dần); trong cùng mốc giữ thứ tự mảng (= sort_order khi lưu).
 */
import type { PackageTask, PackageTaskOwner, SavePackageTasksRequest } from '@/types/vendorPackage'

export const MAX_TASKS = 40
export const MAX_TITLE = 255
export const MAX_NOTE = 500
export const MAX_BEFORE = 365
export const MAX_AFTER = 120

export const OWNER_LABEL: Record<PackageTaskOwner, string> = { VENDOR: 'Nhà cung cấp', CUSTOMER: 'Khách hàng', BOTH: 'Cả hai' }
/** Dòng phụ trong cột "Khách sẽ thấy sau khi đặt cọc" */
export const OWNER_CUSTOMER_VIEW: Record<PackageTaskOwner, string> = { VENDOR: 'Nhà cung cấp phụ trách', CUSTOMER: 'Khách chuẩn bị', BOTH: 'Làm cùng nhà cung cấp' }
export const OWNERS: PackageTaskOwner[] = ['VENDOR', 'CUSTOMER', 'BOTH']

/** Việc đang sửa: `key` ổn định cho React, `id` có khi việc đã lưu trong CSDL. */
export interface TaskDraft {
  key: string
  id?: string
  title: string
  note: string
  owner: PackageTaskOwner
  offsetDays: number
}

export const offsetLabel = (n: number) => (n < 0 ? `Trước ${-n} ngày` : n === 0 ? 'Đúng ngày thực hiện' : `Sau ${n} ngày`)

/** Xếp theo mốc, ổn định (cùng mốc giữ thứ tự cũ). */
export const sortByOffset = (list: TaskDraft[]): TaskDraft[] =>
  list
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t.offsetDays - b.t.offsetDays || a.i - b.i)
    .map((x) => x.t)

export const fromServer = (rows: PackageTask[]): TaskDraft[] =>
  sortByOffset(rows.map((r) => ({ key: r.id, id: r.id, title: r.title, note: r.note ?? '', owner: r.owner, offsetDays: r.offsetDays })))

let seq = 0
export const newKey = () => `new-${++seq}`

/** Thêm hoặc sửa một việc (theo key) rồi xếp lại theo mốc; việc mới của cùng mốc nằm sau các việc có sẵn. */
export function upsert(list: TaskDraft[], task: TaskDraft): TaskDraft[] {
  const exists = list.some((t) => t.key === task.key)
  return sortByOffset(exists ? list.map((t) => (t.key === task.key ? task : t)) : [...list, task])
}

export const remove = (list: TaskDraft[], key: string) => list.filter((t) => t.key !== key)

/** ↑ ↓ chỉ đổi chỗ giữa các việc CÙNG mốc. */
export function canMove(list: TaskDraft[], index: number, dir: -1 | 1): boolean {
  const other = list[index + dir]
  return !!other && other.offsetDays === list[index].offsetDays
}

export function move(list: TaskDraft[], index: number, dir: -1 | 1): TaskDraft[] {
  if (!canMove(list, index, dir)) return list
  const next = [...list]
  ;[next[index], next[index + dir]] = [next[index + dir], next[index]]
  return next
}

/** Nội dung gửi lên (PUT .../tasks): thứ tự mảng = sort_order. */
export const toRequest = (list: TaskDraft[]): SavePackageTasksRequest => ({
  tasks: list.map((t) => ({ ...(t.id && { id: t.id }), title: t.title.trim(), note: t.note.trim() || null, owner: t.owner, offsetDays: t.offsetDays })),
})

/** So với danh sách đã lưu: có thay đổi chưa lưu không (nội dung hoặc thứ tự). */
export const isDirty = (draft: TaskDraft[], saved: TaskDraft[]) => JSON.stringify(toRequest(draft)) !== JSON.stringify(toRequest(saved))

export function countByOwner(list: TaskDraft[]): Record<'ALL' | PackageTaskOwner, number> {
  return {
    ALL: list.length,
    VENDOR: list.filter((t) => t.owner === 'VENDOR').length,
    CUSTOMER: list.filter((t) => t.owner === 'CUSTOMER').length,
    BOTH: list.filter((t) => t.owner === 'BOTH').length,
  }
}

export type OffsetKind = 'before' | 'on' | 'after'
export const offsetKindOf = (n: number): OffsetKind => (n < 0 ? 'before' : n === 0 ? 'on' : 'after')

/** days: chữ người dùng nhập ("" khi chọn "Đúng ngày"). Trả lỗi theo ô; hợp lệ thì trả offsetDays. */
export function validateTask(input: { title: string; note: string; kind: OffsetKind; days: string }): { title?: string; note?: string; days?: string; offsetDays?: number } {
  const errors: { title?: string; note?: string; days?: string } = {}
  const title = input.title.trim()
  if (!title) errors.title = 'Vui lòng nhập tên công việc.'
  else if (title.length > MAX_TITLE) errors.title = `Tối đa ${MAX_TITLE} ký tự.`
  if (input.note.trim().length > MAX_NOTE) errors.note = `Tối đa ${MAX_NOTE} ký tự.`
  let offsetDays = 0
  if (input.kind !== 'on') {
    const n = Number(input.days)
    const max = input.kind === 'before' ? MAX_BEFORE : MAX_AFTER
    if (!input.days.trim() || !Number.isInteger(n) || n < 1 || n > max) errors.days = `Nhập số ngày nguyên từ 1 đến ${max}.`
    else offsetDays = input.kind === 'before' ? -n : n
  }
  return Object.keys(errors).length ? errors : { offsetDays }
}
