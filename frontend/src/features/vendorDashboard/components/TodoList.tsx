import { CheckCircle2, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import type { TodoItem } from '../summary'

/** Việc cần làm, mỗi mục dẫn tới đúng chỗ xử lý (todo-block trong prototype NCC). */
export function TodoList({ items }: { items: TodoItem[] }) {
  return (
    <section className="rounded-md border border-line bg-surface px-5 pt-[18px] pb-2 shadow-portal">
      <h2 className="mb-1.5 font-sans text-[15px] font-semibold tracking-normal">Cần xử lý</h2>
      {items.length ? (
        <ul>
          {items.map((t) => (
            <li key={t.key} className="border-b border-line last:border-b-0">
              <Link to={t.href} className="group flex items-center gap-3 py-[13px] text-[13.5px]">
                <span
                  className={cn(
                    'grid h-7 min-w-7 flex-none place-items-center rounded-sm px-1.5 font-semibold tabular-nums',
                    t.urgent ? 'bg-warn-soft text-warn' : 'bg-(image:--gold-grad) text-gold-on',
                  )}
                >
                  {t.count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="group-hover:text-gold-ink">{t.label}</span>
                  {t.hint && <span className="block truncate text-[12px] text-muted-foreground">{t.hint}</span>}
                </span>
                <ChevronRight className="size-[15px] flex-none text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 py-4 text-[13.5px] text-muted-foreground">
          <CheckCircle2 className="size-4 text-sage" />
          Không có việc cần xử lý.
        </p>
      )}
    </section>
  )
}
