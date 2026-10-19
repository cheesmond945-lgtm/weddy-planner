import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'talk' | 'wait' | 'done' | 'warn' | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-line text-ink',
  talk: 'bg-accent-soft text-primary',
  wait: 'bg-[color-mix(in_srgb,var(--gold)_16%,var(--surface))] text-gold',
  done: 'bg-sage-soft text-sage',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
}

/** Nhãn trạng thái (.badge trong prototype). */
export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-[5px] rounded-pill px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  )
}
