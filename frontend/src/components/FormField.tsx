import { useId, type ComponentProps, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FormFieldProps extends Omit<ComponentProps<typeof Input>, 'id'> {
  label: ReactNode
  error?: string
  hint?: ReactNode
  /** Icon nhỏ nằm trong ô, bên trái chữ */
  icon?: ReactNode
}

/** Nhãn + ô nhập + gợi ý/lỗi, theo .field trong prototype. */
export function FormField({ label, error, hint, icon, className, ...inputProps }: FormFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      {icon ? (
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-gold-700 [&_svg]:size-[18px]">
            {icon}
          </span>
          <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cn('pl-11', className)} {...inputProps} />
        </div>
      ) : (
        <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={className} {...inputProps} />
      )}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-[13px] text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/** Dòng lỗi chung của form (lỗi từ API), theo .err trong prototype. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-[13px] text-destructive">
      {message}
    </p>
  )
}
