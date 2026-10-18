import { useId, type ComponentProps, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'

interface FormFieldProps extends Omit<ComponentProps<typeof Input>, 'id'> {
  label: string
  error?: string
  hint?: ReactNode
}

/** Nhãn + ô nhập + gợi ý/lỗi, theo .field trong prototype. */
export function FormField({ label, error, hint, ...inputProps }: FormFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
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
