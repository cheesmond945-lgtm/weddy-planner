import { UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { AssigneeKind, TaskAssignee, WeddingMember } from '@/types/wedding'
import { ASSIGNEE_LABEL, assigneeLabel, memberName } from '../assignee'

export interface AssigneeChoice {
  assignee: AssigneeKind | null
  assigneeUserId: string | null
}

/** Các lựa chọn phụ trách: Cô dâu, Chú rể, Cả hai, từng người thân, Chưa giao. */
export function assigneeChoices(relatives: WeddingMember[]): { key: string; label: string; value: AssigneeChoice }[] {
  return [
    ...(['BRIDE', 'GROOM', 'BOTH'] as const).map((k) => ({ key: k, label: ASSIGNEE_LABEL[k], value: { assignee: k, assigneeUserId: null } })),
    ...relatives.map((m) => ({ key: m.userId, label: memberName(m), value: { assignee: 'MEMBER' as const, assigneeUserId: m.userId } })),
    { key: 'none', label: 'Chưa giao', value: { assignee: null, assigneeUserId: null } },
  ]
}

const sameChoice = (a: TaskAssignee | null, v: AssigneeChoice) => (a?.kind ?? null) === v.assignee && (a?.userId ?? null) === v.assigneeUserId

/** Chip người phụ trách hoặc nút "Giao việc"; bấm mở menu nhỏ (P4). */
export function AssignMenu({
  assignee,
  relatives,
  readOnly,
  onPick,
}: {
  assignee: TaskAssignee | null
  relatives: WeddingMember[]
  readOnly: boolean
  onPick: (v: AssigneeChoice) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  if (readOnly) return assignee ? <span className="rounded-pill bg-accent-soft px-2.5 py-[3px] text-xs font-semibold text-gold-700">{assigneeLabel(assignee)}</span> : null

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1 rounded-pill px-2.5 py-[3px] text-xs font-semibold',
          assignee ? 'bg-accent-soft text-gold-700 hover:bg-accent' : 'border border-dashed border-line text-muted-foreground hover:border-primary hover:text-ink',
        )}
      >
        {!assignee && <UserPlus className="size-3.5" aria-hidden />}
        {assignee ? assigneeLabel(assignee) : 'Giao việc'}
      </button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-30 mt-1 min-w-[170px] rounded-md border border-line bg-surface py-1 shadow-[0_8px_24px_rgb(var(--shadow-rgb)/0.16)]">
          {assigneeChoices(relatives).map((c) => (
            <button
              key={c.key}
              type="button"
              role="menuitemradio"
              aria-checked={sameChoice(assignee, c.value)}
              onClick={() => {
                setOpen(false)
                if (!sameChoice(assignee, c.value)) onPick(c.value)
              }}
              className={cn('block w-full px-3.5 py-2 text-left text-sm hover:bg-accent-soft', sameChoice(assignee, c.value) && 'font-semibold text-gold-700')}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Hạn của việc: bấm để mở ô chọn ngày, chọn là lưu luôn (P4). */
export function DueButton({ label, value, min, max, className, readOnly, onPick }: { label: string; value: string; min: string; max: string; className?: string; readOnly: boolean; onPick: (date: string) => void }) {
  const [editing, setEditing] = useState(false)
  if (readOnly) return <span className={className}>{label}</span>
  if (editing) {
    return (
      <input
        type="date"
        aria-label="Đổi hạn"
        autoFocus
        min={min}
        max={max}
        defaultValue={value}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        onChange={(e) => {
          const v = e.target.value
          if (v && v >= min && v <= max && v !== value) {
            setEditing(false)
            onPick(v)
          }
        }}
        className="rounded-sm border border-input bg-surface px-2 py-1 text-[13px]"
      />
    )
  }
  return (
    <button type="button" title="Đổi hạn" onClick={() => setEditing(true)} className={cn('rounded-sm underline-offset-[3px] hover:underline', className)}>
      {label}
    </button>
  )
}
