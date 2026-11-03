import { cn } from '@/lib/utils'
import { splitTitle } from '../taskTitle'

/** Tên việc đậm; ghi chú (tách từ "tên — ghi chú" khi hiển thị) là dòng nhỏ bên dưới. */
export function TaskTitle({ title, as: Tag = 'p', className, noteClassName }: { title: string; as?: 'p' | 'div'; className?: string; noteClassName?: string }) {
  const { title: name, note } = splitTitle(title)
  return (
    <>
      <Tag className={className}>{name}</Tag>
      {note && <Tag className={cn('mt-0.5 text-[12.5px] leading-snug font-normal text-muted-foreground [overflow-wrap:anywhere]', noteClassName)}>{note}</Tag>}
    </>
  )
}
