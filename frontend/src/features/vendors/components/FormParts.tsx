import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Ô nhập, ô chọn cao 40px viền đậm như .form-field input trong prototype NCC. Dùng kèm Input hoặc <select>. */
export const controlClass =
  'h-10 w-full min-w-0 rounded-sm border border-line-strong bg-surface px-3 py-0 text-[13.5px] text-ink placeholder:text-muted-foreground focus:border-gold focus:outline-2 focus:outline-offset-0 focus:outline-gold/25 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted-foreground disabled:opacity-100'

/** Khối "Thông tin doanh nghiệp", "Ảnh cơ sở"... (.form-section trong prototype NCC). */
export function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-4">
        <h2 className="font-sans text-[17px] font-semibold tracking-normal">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

interface FieldProps {
  label: ReactNode
  error?: string
  hint?: ReactNode
  /** Chiếm cả hàng trong lưới 2 cột */
  full?: boolean
  /** Bọc bằng <div> thay vì <label> (khi bên trong có nhiều nút, ví dụ ô chọn quận) */
  group?: boolean
  className?: string
  children: ReactNode
}

/** Nhãn + ô chọn + gợi ý/lỗi, cùng kiểu với FormField (FormField chỉ bọc được Input). */
export function Field({ label, error, hint, full, group, className, children }: FieldProps) {
  const Comp = group ? 'div' : 'label'
  return (
    <Comp className={cn('grid min-w-0 content-start', full && 'col-span-full', className)}>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
      {error ? (
        <span role="alert" data-field-error className="mt-1.5 text-[13px] text-destructive">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 text-[13px] text-muted-foreground">{hint}</span>
      )}
    </Comp>
  )
}

const NOTICE_TONES = {
  ok: 'bg-sage-soft text-sage',
  warn: 'bg-gold-soft text-gold-ink',
  info: 'bg-info-soft text-info',
}

/** Thông báo đầu trang (.notice trong prototype NCC). */
export function Notice({ tone = 'ok', title, children }: { tone?: keyof typeof NOTICE_TONES; title: ReactNode; children?: ReactNode }) {
  return (
    <div role="status" className={cn('mb-4 flex items-start gap-2.5 rounded-[9px] px-3.5 py-3 text-[13.5px]', NOTICE_TONES[tone])}>
      {tone === 'ok' ? <Check className="mt-0.5 size-4 flex-none" /> : <i aria-hidden className="mt-1.5 size-2 flex-none rounded-full bg-current" />}
      <div className="min-w-0 flex-1">
        {title}
        {children && <div className="mt-1 opacity-85">{children}</div>}
      </div>
    </div>
  )
}
