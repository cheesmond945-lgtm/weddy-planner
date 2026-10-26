import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AuthFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string
  error?: string
  hint?: ReactNode
}

/**
 * Ô nhập của trang đăng nhập / đăng ký: nhãn đậm, ô cao 44px bo góc.
 * type="password" thì có nút con mắt để hiện / ẩn mật khẩu.
 */
export function AuthField({ label, error, hint, type = 'text', className, ...props }: AuthFieldProps) {
  const id = useId()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full rounded-lg border border-input bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted-foreground',
            'transition-[border-color,box-shadow] focus:border-ring focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)] focus:outline-none',
            'aria-invalid:border-destructive',
            isPassword && 'pr-11',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={show}
            className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-ink"
          >
            {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        )}
      </div>
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

/** Nút chính rộng hết thẻ, chữ in hoa (như nút ĐĂNG NHẬP trong mẫu). */
export function AuthSubmit({ children, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="submit"
      className="mt-2 h-12 w-full rounded-lg bg-primary text-sm font-semibold tracking-[0.08em] text-primary-foreground uppercase shadow-pill transition-[filter,box-shadow] hover:brightness-105 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {children}
    </button>
  )
}
