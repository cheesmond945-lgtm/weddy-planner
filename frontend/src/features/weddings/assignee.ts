import type { AssigneeKind, TaskAssignee, WeddingMember } from '@/types/wedding'

/** Nhãn người phụ trách (P4). */
export const ASSIGNEE_LABEL: Record<Exclude<AssigneeKind, 'MEMBER'>, string> = { BRIDE: 'Cô dâu', GROOM: 'Chú rể', BOTH: 'Cả hai' }

export function assigneeLabel(a: Pick<TaskAssignee, 'kind' | 'name'> | null) {
  if (!a) return 'Chưa giao'
  return a.kind === 'MEMBER' ? (a.name ?? 'Người thân') : ASSIGNEE_LABEL[a.kind]
}

/**
 * Khóa lọc theo phụ trách trên URL Timeline (?giao=): bride, groom, both, none, hoặc userId của người thân.
 * Lọc "Cô dâu" gồm cả việc giao "Cả hai" (như prototype: việc chung của hai người đều hiện ở cả hai).
 */
export function assigneeKey(a: Pick<TaskAssignee, 'kind' | 'userId'> | null) {
  if (!a) return 'none'
  return a.kind === 'MEMBER' ? a.userId! : a.kind.toLowerCase()
}

export function matchAssignee(a: Pick<TaskAssignee, 'kind' | 'userId'> | null, key: string) {
  const k = assigneeKey(a)
  if (key === 'bride' || key === 'groom') return k === key || k === 'both'
  return k === key
}

/** Người thân có thể được giao việc: thành viên không phải owner, quan hệ Người thân (cô dâu/chú rể giao theo BRIDE/GROOM). */
export const relativeMembers = (members: WeddingMember[]) => members.filter((m) => m.role !== 'OWNER' && m.relation !== 'BRIDE' && m.relation !== 'GROOM')

export const memberName = (m: WeddingMember) => m.displayName || m.fullName
