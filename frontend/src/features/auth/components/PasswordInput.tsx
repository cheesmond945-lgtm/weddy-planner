import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'

interface PasswordInputProps extends Omit<ComponentProps<typeof Input>, 'id' | 'type'> {
  label: string
  error?: string
}

/** Ô mật khẩu có nút hiện / ẩn, nhãn và dòng lỗi (cùng kiểu FormField). */
export function PasswordInput({ label, error, className, ...props }: PasswordInputProps) {
  const id = useId()
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} className={`pr-11 ${className ?? ''}`} {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-ink"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
